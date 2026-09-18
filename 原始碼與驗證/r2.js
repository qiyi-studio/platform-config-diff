/* ==========================================================================
   平台差異快查 — 單一檔案版
   所有資料只留在這台裝置的瀏覽器（localStorage），不會上傳到任何地方。
   ========================================================================== */
"use strict";

/* ---------- 內建資料（來自「示範資料表（设置、后台、手机）.xlsx」） ---------- */
var BUILTIN = /*__DATA__*/null;

/* ---------- 小工具 ---------- */
var $ = function (s) { return document.querySelector(s); };
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function toast(msg) {
  var t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { t.classList.remove("on"); }, 2200);
}
function cellClean(s) {
  return String(s == null ? "" : s)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------- 繁 → 簡 折疊（讓打繁體也找得到簡體資料） ---------- */
/* 一繁一簡成對寫，肉眼就能核對。只做繁→簡單向（一個簡體常對到多個繁體）。 */
var T2S_PAIRS = /*__PAIRS__*/"";
var T2S = (function () {
  var m = {}, i;
  for (i = 0; i + 1 < T2S_PAIRS.length; i += 2) {
    if (T2S_PAIRS[i] !== T2S_PAIRS[i + 1]) m[T2S_PAIRS[i]] = T2S_PAIRS[i + 1];
  }
  return m;
})();
function fold(s) {
  s = String(s == null ? "" : s);
  var out = "", i, c, cc;
  for (i = 0; i < s.length; i++) {
    c = s[i]; cc = s.charCodeAt(i);
    if (cc >= 0xFF01 && cc <= 0xFF5E) c = String.fromCharCode(cc - 0xFEE0);
    else if (cc === 0x3000) c = " ";
    else if (T2S[c]) c = T2S[c];
    out += c;
  }
  return out.toLowerCase();
}
var PUNCT = /[\s、，。；：！？…—–\-_/\\|()\[\]{}<>【】「」『』《》〈〉"'“”‘’*#~`^$%@+=,.;:!?]+/g;
function bare(s) { return fold(s).replace(PUNCT, ""); }

/* ==========================================================================
   格子內容 → 狀態
   原表的寫法：V／v／✓＝有；X／x／N＝沒有；空白＝沒寫；其餘一律當「有說明」。
   ⚠ 「V（一个帐号仅能绑定一个）」這種是「有，而且有附註」，
      算成「有」但把文字照樣顯示出來 —— 只看顏色會漏掉括號裡的限制。
   ========================================================================== */
function kindOf(v) {
  var t = String(v == null ? "" : v).replace(/\s/g, "");
  if (!t) return "blank";
  if (/^[VvＶ✓✔○●]$/.test(t)) return "yes";
  if (/^[XxＸ×✕✖NnＮ]$/.test(t)) return "no";
  if (/^(有|可|支援|支持|開放|开放)$/.test(t)) return "yes";
  if (/^(无|無|沒有|没有|不支援|不支持|無此功能|无此功能|不提供|未開放|未开放)$/.test(t)) return "no";
  return "note";
}
var KIND = {
  yes:   { label: "有",   cls: "k-yes",   badge: "kb-yes" },
  no:    { label: "沒有", cls: "k-no",    badge: "kb-no" },
  note:  { label: "說明", cls: "k-note",  badge: "kb-note" },
  blank: { label: "未填", cls: "k-blank", badge: "kb-blank" }
};
function showText(v, k) {
  if (k === "blank") return "（原表這一格是空的）";
  if (k === "no" && String(v).replace(/\s/g, "").length <= 2) return "沒有這個功能";
  return v;
}

/* ==========================================================================
   搜尋
   功能名稱都很短，所以名稱走「模糊比對」，比不到才去翻格子內容。
   ========================================================================== */
function fuzzy(hay, q) {
  if (!q) return 0;
  if (!hay) return -1;
  if (hay === q) return 1000;
  if (hay.indexOf(q) === 0) return 900 - Math.min(hay.length, 40);
  var p = hay.indexOf(q);
  if (p > 0) return 800 - p * 2 - Math.min(hay.length, 40) * 0.2;
  var i = 0, j = 0, first = -1, prev = -1, gaps = 0;
  while (i < hay.length && j < q.length) {
    if (hay.charAt(i) === q.charAt(j)) {
      if (first < 0) first = i;
      if (prev >= 0 && i - prev > 1) gaps += (i - prev - 1);
      prev = i; j++;
    }
    i++;
  }
  if (j < q.length) return -1;
  return 500 - gaps * 4 - first * 2 - Math.min(hay.length, 40) * 0.2;
}
/* 把命中的字標起來（bare 會刪標點，所以逐字對回原位置） */
function hilite(raw, q) {
  raw = String(raw == null ? "" : raw);
  if (!q || !raw) return esc(raw);
  var i, mark = [], pos = [], b = "";
  for (i = 0; i < raw.length; i++) mark[i] = false;
  for (i = 0; i < raw.length; i++) {
    var f = fold(raw[i]);
    PUNCT.lastIndex = 0;
    if (PUNCT.test(f)) { PUNCT.lastIndex = 0; continue; }
    PUNCT.lastIndex = 0;
    b += f; pos.push(i);
  }
  var at = b.indexOf(q), k;
  if (at >= 0) {
    while (at >= 0) {
      for (k = at; k < at + q.length && k < pos.length; k++) mark[pos[k]] = true;
      at = b.indexOf(q, at + 1);
    }
  } else {
    var j = 0;
    for (i = 0; i < b.length && j < q.length; i++) {
      if (b.charAt(i) === q.charAt(j)) { mark[pos[i]] = true; j++; }
    }
    if (j < q.length) return esc(raw);
  }
  var out = "", on = false;
  for (i = 0; i < raw.length; i++) {
    if (mark[i] && !on) { out += "<mark>"; on = true; }
    if (!mark[i] && on) { out += "</mark>"; on = false; }
    out += esc(raw[i]);
  }
  return out + (on ? "</mark>" : "");
}

/* ==========================================================================
   把相同的平台併成一組 —— 這是這個工具的重點
   「哪些平台一樣、哪些不一樣」比「八個平台各印一遍」好讀太多。
   ========================================================================== */
function groupsOf(vals, plats) {
  var order = [], byVal = {};
  vals.forEach(function (v, i) {
    var key = String(v);
    if (byVal[key] === undefined) { byVal[key] = { v: v, ps: [] }; order.push(key); }
    byVal[key].ps.push(plats[i]);
  });
  return order.map(function (k) {
    var g = byVal[k];
    return { v: g.v, ps: g.ps, kind: kindOf(g.v) };
  });
}

/* ==========================================================================
   貼上的表格 → 資料
   ========================================================================== */
function splitTable(text, delim) {
  var s = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  var rows = [], row = [], cell = "", i = 0, q = false, c;
  while (i < s.length) {
    c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
      cell += c; i++; continue;
    }
    if (c === '"' && cell === "") { q = true; i++; continue; }
    if (c === delim) { row.push(cell); cell = ""; i++; continue; }
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += c; i++;
  }
  row.push(cell); rows.push(row);
  return rows.filter(function (r) {
    return r.some(function (x) { return String(x).trim() !== ""; });
  });
}

/* 剪貼簿 HTML（合併儲存格的正解：純文字只有左上角有值，救不回來） */
function htmlCellText(s) {
  return String(s == null ? "" : s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}
function parseHtmlGrid(html) {
  var tm = /<table[\s\S]*?<\/table>/i.exec(String(html || ""));
  if (!tm) return null;
  var rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, rm, raw = [];
  while ((rm = rowRe.exec(tm[0]))) {
    var cellRe = /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi, cm, cells = [];
    while ((cm = cellRe.exec(rm[1]))) {
      var att = cm[1] || "";
      var rs = /rowspan\s*=\s*"?'?(\d+)/i.exec(att);
      var cs = /colspan\s*=\s*"?'?(\d+)/i.exec(att);
      cells.push({
        t: htmlCellText(cm[2]),
        rs: rs ? Math.max(1, parseInt(rs[1], 10)) : 1,
        cs: cs ? Math.max(1, parseInt(cs[1], 10)) : 1
      });
    }
    raw.push(cells);
  }
  if (!raw.length) return null;
  var grid = [], taken = {}, r, k, c, i, j;
  for (r = 0; r < raw.length; r++) if (!grid[r]) grid[r] = [];
  for (r = 0; r < raw.length; r++) {
    c = 0;
    for (k = 0; k < raw[r].length; k++) {
      while (taken[r + "," + c]) c++;
      for (i = 0; i < raw[r][k].rs; i++) {
        for (j = 0; j < raw[r][k].cs; j++) {
          if (!grid[r + i]) grid[r + i] = [];
          grid[r + i][c + j] = raw[r][k].t;
          taken[(r + i) + "," + (c + j)] = 1;
        }
      }
      c += raw[r][k].cs;
    }
  }
  for (r = 0; r < grid.length; r++)
    for (c = 0; c < grid[r].length; c++) if (grid[r][c] === undefined) grid[r][c] = "";
  grid = grid.filter(function (row) {
    return row.some(function (x) { return String(x).trim() !== ""; });
  });
  return grid.length ? grid : null;
}

/* 找表頭列：第一格空白（或寫「功能」之類）、右邊是一排短短的平台代號 */
function findHeader(rows) {
  var i, j, r, cand, best = null;
  for (i = 0; i < Math.min(8, rows.length); i++) {
    r = rows[i];
    cand = [];
    for (j = 1; j < r.length; j++) {
      var v = cellClean(r[j]).replace(/\s/g, "");
      if (!v) { if (cand.length) break; else continue; }
      if (v.length > 8) { cand = []; break; }      /* 太長 → 不是代號列 */
      cand.push({ col: j, name: v });
    }
    if (cand.length >= 2 && (!best || cand.length > best.plats.length)) {
      best = { row: i, plats: cand };
    }
  }
  return best;
}

/* 解析貼上的內容。回傳 {ok, plats, secs, items, msg} */
function parsePasted(text, opt) {
  opt = opt || {};
  var rows;
  if (opt.grid && opt.grid.length) rows = opt.grid;
  else rows = splitTable(text, text.indexOf("\t") >= 0 ? "\t" : ",");
  if (!rows || rows.length < 2) return { ok: false, msg: "看起來不像表格，至少要有標題列＋一列資料。" };

  var hd = findHeader(rows);
  if (!hd) return { ok: false, msg: "找不到平台代號那一列。第一列要是「（空白）＋MF＋ME＋…」這種格式，整張表一起複製進來。" };

  var plats = hd.plats.map(function (p) { return p.name; });
  var cols = hd.plats.map(function (p) { return p.col; });
  var secs = [], items = [], sec = "";

  for (var i = hd.row + 1; i < rows.length; i++) {
    var r = rows[i];
    var nm = cellClean(r[0]).replace(/\s+/g, " ");
    var vals = cols.map(function (c) { return cellClean(r[c]); });
    var hasVal = vals.some(function (v) { return v !== ""; });

    /* 只有第一格有字 → 分節標題 */
    if (!hasVal) {
      if (nm) { sec = nm; if (secs.indexOf(sec) < 0) secs.push(sec); }
      continue;
    }
    /* 沒名稱、或與上一筆同名 → 接在上一筆後面（原表把一個功能拆成兩列） */
    var prev = items.length ? items[items.length - 1] : null;
    if (prev && (!nm || nm === prev.n)) {
      prev.vals = prev.vals.map(function (v, k) {
        return (v && vals[k]) ? v + "\n" + vals[k] : (v || vals[k]);
      });
      continue;
    }
    if (!nm) continue;
    if (sec && secs.indexOf(sec) < 0) secs.push(sec);
    items.push({ sec: sec, n: nm, vals: vals });
  }

  if (!items.length) return { ok: false, msg: "有讀到平台代號，但下面沒有任何功能項目。" };
  return { ok: true, plats: plats, secs: secs, items: items };
}

/* ---------- 匯出 ---------- */
function tsvCell(v) {
  var s = String(v == null ? "" : v);
  return /[\t\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
