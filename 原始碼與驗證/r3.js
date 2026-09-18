
/* ==========================================================================
   狀態與儲存
   ========================================================================== */
var K_DATA = "pdiff.data.v1", K_UI = "pdiff.ui.v1";
var DATA = null, MODE = "fn", PLAT = "", SEC = "*", Q = "", QB = "", DIFFONLY = false, PAGE = 40;
/* 一打開先不要列結果 —— 等使用者打字或點了分類／平台再顯示。不記進 localStorage。 */
var SHOWALL = false;

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

/* 內建資料是「字串池 ＋ 索引」，這裡攤平回一般物件 */
function decodeBuiltin() {
  if (!BUILTIN || !BUILTIN.i) return null;
  return {
    src: "builtin", at: BUILTIN.at || "",
    plats: BUILTIN.p.slice(), secs: BUILTIN.sec.slice(),
    items: BUILTIN.i.map(function (x) {
      return { sec: BUILTIN.sec[x.s] || "", n: x.n, vals: x.c.map(function (k) { return BUILTIN.v[k]; }) };
    })
  };
}
function loadAll() {
  var raw = lsGet(K_DATA), d = null;
  if (raw) { try { d = JSON.parse(raw); } catch (e) { d = null; } }
  if (!d || !d.items || !d.items.length) d = decodeBuiltin();
  DATA = d || { src: "builtin", at: "", plats: [], secs: [], items: [] };
  DATA.items.forEach(function (it, i) { it._i = i; });
  try {
    var u = JSON.parse(lsGet(K_UI) || "{}");
    if (u.mode) MODE = u.mode;
    if (u.sec) SEC = u.sec;
    if (u.plat) PLAT = u.plat;
    if (typeof u.diff === "boolean") DIFFONLY = u.diff;
  } catch (e) {}
  if (DATA.plats.indexOf(PLAT) < 0) PLAT = DATA.plats[0] || "";
}
function saveUI() { lsSet(K_UI, JSON.stringify({ mode: MODE, sec: SEC, plat: PLAT, diff: DIFFONLY })); }

/* ==========================================================================
   查詢
   ========================================================================== */
function isDiff(it) {
  for (var i = 1; i < it.vals.length; i++) if (it.vals[i] !== it.vals[0]) return true;
  return false;
}
function hayOf(it) {
  if (!it._hay) it._hay = bare([it.n, it.sec, it.vals.join(" ")].join(" "));
  return it._hay;
}
function nameBare(it) {
  if (!it._nb) it._nb = bare(it.n);
  return it._nb;
}

function currentList() {
  var out = [];
  DATA.items.forEach(function (it) {
    if (SEC !== "*" && it.sec !== SEC) return;
    if (DIFFONLY && !isDiff(it)) return;
    var score = 0;
    if (QB) {
      var s = fuzzy(nameBare(it), QB);
      if (s < 0) {
        /* 名稱比不到 → 翻格子內容，但排在名稱命中的後面 */
        if (hayOf(it).indexOf(QB) < 0) return;
        s = -500;
      }
      score = s;
    }
    out.push({ it: it, s: score });
  });
  if (QB) out.sort(function (a, b) { return b.s - a.s || a.it._i - b.it._i; });
  return out;
}

/* ==========================================================================
   畫面
   ========================================================================== */
function renderModes() {
  $("#mFn").className = MODE === "fn" ? "on" : "";
  $("#mPl").className = MODE === "pl" ? "on" : "";
  $("#platRow").style.display = MODE === "pl" ? "" : "none";
  $("#q").placeholder = MODE === "fn"
    ? "輸入功能名稱，例如：登入驗證、免運門檻、退貨、行動支付、公告"
    : "在這個平台裡找功能，例如：登入驗證、免運門檻、退貨";
}
function renderPlats() {
  var h = "";
  DATA.plats.forEach(function (p) {
    h += '<button class="chip' + (PLAT === p ? " on" : "") + '" data-plat="' + esc(p) + '">' + esc(p) + "</button>";
  });
  $("#plats").innerHTML = h;
}
function renderSecs() {
  var n = {};
  DATA.items.forEach(function (it) {
    if (DIFFONLY && !isDiff(it)) return;
    n[it.sec] = (n[it.sec] || 0) + 1;
  });
  var tot = 0;
  Object.keys(n).forEach(function (k) { tot += n[k]; });
  var h = '<button class="chip' + (SEC === "*" ? " on" : "") + '" data-sec="*">全部 <small>' + tot + "</small></button>";
  DATA.secs.forEach(function (s) {
    if (!n[s]) return;
    h += '<button class="chip' + (SEC === s ? " on" : "") + '" data-sec="' + esc(s) + '">' +
         esc(s) + " <small>" + n[s] + "</small></button>";
  });
  h += '<button class="chip tog' + (DIFFONLY ? " on" : "") + '" data-diff="1">' +
       (DIFFONLY ? "☑" : "☐") + " 只看有差異的</button>";
  $("#secs").innerHTML = h;
}

function pchips(ps, dim) {
  return ps.map(function (p) {
    return '<span class="pchip' + (dim ? " dim" : "") + '">' + esc(p) + "</span>";
  }).join("");
}

/* ── 模式一：查功能 ── */
function fnCardHtml(item) {
  var it = item.it, h = "";
  var gs = groupsOf(it.vals, DATA.plats);
  var diff = gs.length > 1;

  h += '<div class="card"><div class="cTop">';
  h += '<div class="cName">' + hilite(it.n, QB) + "</div>";
  if (it.sec) h += '<span class="secTag">' + esc(it.sec) + "</span>";
  h += '<span class="diffTag ' + (diff ? "d-diff" : "d-same") + '">' +
       (diff ? "有差異・" + gs.length + " 種" : "全平台相同") + "</span>";
  h += "</div>";

  gs.forEach(function (g, gi) {
    var k = KIND[g.kind];
    h += '<div class="grp ' + k.cls + '"><div class="gh">';
    h += pchips(g.ps, false);
    if (!diff) h += '<span class="allsame">（' + g.ps.length + " 個平台都一樣）</span>";
    h += '<span class="kbadge ' + k.badge + '">' + k.label + "</span>";
    h += "</div>";
    h += '<div class="gv">' + hilite(showText(g.v, g.kind), QB) + "</div>";
    h += "</div>";
  });
  h += "</div>";
  return h;
}

/* ── 模式二：查平台 ── */
function plRowHtml(item, pi) {
  var it = item.it, v = it.vals[pi], k = kindOf(v);
  var same = 0, i;
  for (i = 0; i < it.vals.length; i++) if (it.vals[i] === v) same++;
  var diff = isDiff(it);

  var h = '<div class="prow ' + KIND[k].cls + '">';
  h += '<div class="pn">' + hilite(it.n, QB) + "</div>";
  h += '<div class="pv">' + hilite(showText(v, k), QB) + "</div>";
  h += '<div class="side">';
  h += '<span class="kbadge ' + KIND[k].badge + '">' + KIND[k].label + "</span>";
  if (!diff) h += '<span class="dchip same">全平台相同</span>';
  else if (same === 1) h += '<span class="dchip">只有這個平台這樣</span>';
  else h += '<span class="dchip">與其他 ' + (same - 1) + " 個平台相同</span>";
  h += "</div></div>";
  return h;
}

function idleHtml() {
  return '<div class="empty"><b>先輸入功能名稱</b>' +
    "例如：登入驗證、免運門檻、退貨、行動支付、公告——打繁體也找得到簡體。<br>" +
    "也可以先點上面的分類，或切到「② 查平台」看某個平台的全部設定。" +
    '<div style="margin-top:14px"><button class="btn pri" id="showAll">📋 直接看全部 ' +
    DATA.items.length + ' 個功能</button></div></div>';
}

function render() {
  if (!QB && !SHOWALL) {
    $("#stat").innerHTML = "<span>共 <b>" + DATA.items.length + "</b> 個功能、" +
      DATA.plats.length + " 個平台，等你查</span>";
    $("#list").innerHTML = idleHtml();
    renderFoot();
    return;
  }
  var list = currentList();
  var pi = DATA.plats.indexOf(PLAT);
  var s = "";

  if (MODE === "fn") {
    var nd = list.filter(function (x) { return isDiff(x.it); }).length;
    s = "<span>找到 <b>" + list.length + "</b> 個功能</span>";
    s += "<span>・其中有差異 <b>" + nd + "</b> 個</span>";
  } else {
    s = "<span>平台 <b>" + esc(PLAT || "—") + "</b></span><span>・<b>" + list.length + "</b> 個功能</span>";
  }
  if (list.length > PAGE) s += "<span>・先顯示前 " + PAGE + " 個</span>";
  $("#stat").innerHTML = s;

  if (!list.length) {
    $("#list").innerHTML = '<div class="empty"><b>沒有找到符合的功能</b>' +
      "換個關鍵字，或把上面的分類切回「全部」。" +
      (DIFFONLY ? "<br>目前開著「只看有差異的」，全平台一樣的功能不會出現。" : "") + "</div>";
    renderFoot();
    return;
  }

  var shown = list.slice(0, PAGE), h = "", lastSec = null;
  if (MODE === "fn") {
    shown.forEach(function (x) { h += fnCardHtml(x); });
  } else {
    shown.forEach(function (x) {
      if (!QB && x.it.sec !== lastSec) {
        lastSec = x.it.sec;
        h += '<div class="secHd">' + esc(lastSec || "未分類") + "</div>";
      }
      h += plRowHtml(x, pi);
    });
  }
  if (list.length > PAGE) {
    h += '<div style="text-align:center;margin:8px 0 4px">' +
         '<button class="btn" id="more">▼ 再顯示 40 個（還有 ' + (list.length - PAGE) + "）</button></div>";
  }
  $("#list").innerHTML = h;
  renderFoot();
}

function renderFoot() {
  var src = DATA.src === "paste" ? "你貼上的資料" : "內建資料（從設定差異表匯入）";
  var nd = DATA.items.filter(isDiff).length;
  var h = "<div><b>資料來源：</b>" + esc(src) + (DATA.at ? "　" + esc(DATA.at) : "") +
          "　" + DATA.items.length + " 個功能 × " + DATA.plats.length + " 個平台" +
          "（有差異 " + nd + "、全平台相同 " + (DATA.items.length - nd) + "）</div>";
  h += "<div><b>顏色：</b>";
  ["yes", "no", "note", "blank"].forEach(function (k) {
    h += '<span class="kbadge ' + KIND[k].badge + '" style="margin:0 5px 4px 0">' + KIND[k].label + "</span>";
  });
  h += "有＝格子寫 V；沒有＝寫 X／N；說明＝格子裡是文字；未填＝原表是空的。</div>";
  h += "<div>資料只存在這台裝置的瀏覽器，關掉網頁不會消失，也不會上傳到任何地方。" +
       "<b>這裡放的是示範資料；換成自己的資料後，請依所屬單位的規定保管。</b></div>";
  h += '<div style="margin-top:8px"><button class="btn" id="btnReset">↩ 回復成內建資料</button> ' +
       '<button class="btn" id="btnWipe">🧹 清除這台裝置存的資料</button></div>';
  $("#foot").innerHTML = h;
}

/* ==========================================================================
   複製
   ========================================================================== */
function copyText(txt, okMsg) {
  function fallback() {
    var ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    toast(ok ? okMsg : "這個瀏覽器不給自動複製，請手動選取");
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function () { toast(okMsg); }, fallback);
  } else fallback();
}
/* ==========================================================================
   彈窗
   ========================================================================== */
function closeModal() { $("#modal").innerHTML = ""; }
function openModal(title, body, foot) {
  $("#modal").innerHTML =
    '<div class="mask" id="mask"><div class="modal">' +
    '<div class="mHd"><h2>' + title + '</h2><button class="x" id="mx">×</button></div>' +
    '<div class="mBd">' + body + "</div>" +
    (foot ? '<div class="mFt">' + foot + "</div>" : "") +
    "</div></div>";
  $("#mx").onclick = closeModal;
  $("#mask").onclick = function (e) { if (e.target.id === "mask") closeModal(); };
}

/* ---------- 匯出 ---------- */
function exportTsv(scope) {
  var items = DATA.items.filter(function (it) { return scope !== "diff" || isDiff(it); });
  var out = [[""].concat(DATA.plats).map(tsvCell).join("\t")];
  var lastSec = null;
  items.forEach(function (it) {
    if (it.sec && it.sec !== lastSec) {
      lastSec = it.sec;
      out.push([tsvCell(it.sec)].concat(DATA.plats.map(function () { return ""; })).join("\t"));
    }
    out.push([tsvCell(it.n)].concat(it.vals.map(tsvCell)).join("\t"));
  });
  return { text: out.join("\n"), n: items.length };
}
function openExport() {
  var body =
    '<div class="hint">產生 Tab 分隔的文字，複製後在試算表點第一格 <code>Ctrl+V</code> 就會落到各欄。' +
    "格式與原表一樣（第一列是平台代號、分類自成一列），有換行的欄位會用雙引號包起來。</div>" +
    '<div class="rowLabel" style="margin-top:10px">要匯出哪些</div>' +
    '<div class="radios"><label><input type="radio" name="xs" value="all" checked>全部功能</label>' +
    '<label><input type="radio" name="xs" value="diff">只有平台間有差異的</label></div>' +
    '<textarea class="big" id="xOut" readonly style="margin-top:10px;min-height:210px"></textarea>' +
    '<div class="prev" id="xInfo"></div>';
  openModal("⬇ 匯出 Tab 文字", body,
    '<button class="btn" id="xClose">關閉</button><button class="btn pri" id="xCopy">複製全部</button>');
  $("#xClose").onclick = closeModal;
  function refresh() {
    var scope = document.querySelector('input[name=xs]:checked').value;
    var r = exportTsv(scope);
    $("#xOut").value = r.text;
    $("#xInfo").textContent = "共 " + r.n + " 個功能 × " + DATA.plats.length + " 個平台。";
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name=xs]'),
    function (el) { el.onchange = refresh; });
  refresh();
  $("#xCopy").onclick = function () { copyText($("#xOut").value, "已複製，可以貼進試算表了"); };
}

/* ---------- 貼上／更新 ---------- */
var PGRID = null, PGRID_TXT = null;
function openPaste() {
  var body =
    '<div class="hint">在試算表按 <code>Ctrl+A</code> 選整張表 → <code>Ctrl+C</code> → 點下面的框 → <code>Ctrl+V</code>。' +
    "<b>第一列（平台代號那一列）一定要一起複製</b>，程式靠它認平台。<br>" +
    "從試算表直接貼上時，合併儲存格會一起正確帶進來。</div>" +
    '<textarea class="big" id="pTxt" placeholder="在這裡貼上表格…"></textarea>' +
    '<div class="prev" id="pPrev">還沒貼上資料。</div>';
  openModal("📋 貼上／更新資料", body,
    '<button class="btn" id="pCancel">取消</button><button class="btn pri" id="pOk" disabled>套用這份資料</button>');
  var ta = $("#pTxt"), tmr = null, RES = null;
  PGRID = null; PGRID_TXT = null;

  ta.addEventListener("paste", function (e) {
    var html = "";
    try { html = (e.clipboardData || window.clipboardData).getData("text/html") || ""; } catch (err) { html = ""; }
    PGRID = html ? parseHtmlGrid(html) : null;
    setTimeout(function () { PGRID_TXT = ta.value; preview(); }, 0);
  });
  ta.addEventListener("input", function () { clearTimeout(tmr); tmr = setTimeout(preview, 260); });
  $("#pCancel").onclick = closeModal;
  setTimeout(function () { ta.focus(); }, 60);

  function gridNow() { return (PGRID && PGRID_TXT === ta.value) ? PGRID : null; }

  function preview() {
    var txt = ta.value, prev = $("#pPrev");
    RES = null; $("#pOk").disabled = true;
    if (!txt.trim()) { prev.className = "prev"; prev.textContent = "還沒貼上資料。"; return; }
    var g = gridNow(), res;
    try { res = parsePasted(txt, { grid: g }); }
    catch (e) { res = { ok: false, msg: "解析時出錯了：" + e.message }; }
    if (!res.ok) { prev.className = "prev bad"; prev.innerHTML = "❌ " + esc(res.msg); return; }
    RES = res;
    var nd = res.items.filter(function (it) {
      for (var i = 1; i < it.vals.length; i++) if (it.vals[i] !== it.vals[0]) return true;
      return false;
    }).length;
    prev.className = "prev good";
    prev.innerHTML = "✅ 讀到了 <b>" + res.items.length + "</b> 個功能 × <b>" + res.plats.length + "</b> 個平台<br>" +
      "平台：" + esc(res.plats.join("、")) + "<br>" +
      "分類：" + esc(res.secs.join("、") || "（沒有分類列）") + "<br>" +
      "有差異的功能：" + nd + " 個" +
      (g ? '<br><b style="color:#1B8A4B">✔ 從試算表直接讀到合併儲存格，資料是精準還原的。</b>'
         : '<br><span style="color:#A6761A">這是純文字貼上；從試算表直接 Ctrl+C／Ctrl+V 會更準。</span>');
    $("#pOk").disabled = false;
  }

  $("#pOk").onclick = function () {
    if (!RES) return;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var d = new Date();
    DATA = {
      src: "paste",
      at: d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + " " +
          pad(d.getHours()) + ":" + pad(d.getMinutes()) + " 貼上",
      plats: RES.plats, secs: RES.secs, items: RES.items
    };
    DATA.items.forEach(function (it, i) { it._i = i; delete it._hay; delete it._nb; });
    if (!lsSet(K_DATA, JSON.stringify(DATA))) toast("瀏覽器儲存空間不足，這份資料只在這個分頁有效");
    if (DATA.plats.indexOf(PLAT) < 0) PLAT = DATA.plats[0] || "";
    SEC = "*"; saveUI(); closeModal();
    renderPlats(); renderSecs(); PAGE = 40; render();
    toast("已更新：" + DATA.items.length + " 個功能");
  };
}

/* ---------- 使用說明 ---------- */
function openHelp() {
  var body =
    '<div class="hint">' +
    "<p><b>兩種查法</b><br>" +
    "<b>① 查功能</b>：打功能名稱（例如「登入驗證」「免運門檻」「退貨」），會列出這個功能<b>各平台的差別</b>。" +
    "值一樣的平台會自動併成同一組，所以一眼就看得到「哪幾家一樣、哪幾家不一樣」。<br>" +
    "<b>② 查平台</b>：先點一個平台代號，再往下看它所有功能的設定，右邊會標「只有這個平台這樣」或「與其他 N 個平台相同」。</p>" +
    "<p><b>只看有差異的</b><br>分類那一排最後面有這顆。整張表有三分之一的功能是<b>八個平台完全一樣</b>的，" +
    "打開它就只剩真正有差別的，找差異快很多。</p>" +
    "<p><b>顏色</b></p><div class=\"lg\">" +
    ["yes", "no", "note", "blank"].map(function (k) {
      return '<span class="kbadge ' + KIND[k].badge + '">' + KIND[k].label + "</span>";
    }).join("") +
    "</div><p>有＝格子寫 V；沒有＝寫 X 或 N；說明＝格子裡是一段文字（會整段顯示）；未填＝原表那一格是空的。<br>" +
    "⚠️ 像「V（一個支付寶帳號只能綁一個）」這種<b>算「有」但底下的文字照樣顯示</b>——只看顏色會漏掉括號裡的限制。</p>" +
    "<p><b>搜尋</b><br>打繁體找得到簡體（打「門檻」會找到「门槛」）。" +
    "名稱找不到時會去翻格子內容，所以打「登入验证」也查得到。命中的字會用黃底標起來。</p>" +
    "<p><b>更新資料</b><br>原表有變動時按「📋 貼上／更新資料」重貼一次；" +
    "「⬇ 匯出」可以把目前資料變回 Tab 文字貼回試算表，也可以只匯出有差異的那些。</p>" +
    "<p><b>隱私</b><br>整個工具就是一個 HTML 檔，沒有連任何網路服務。資料只寫在這台裝置瀏覽器的 localStorage。</p>" +
    "</div>";
  openModal("❓ 使用說明", body, '<button class="btn pri" id="hOk">知道了</button>');
  $("#hOk").onclick = closeModal;
}

/* ==========================================================================
   事件
   ========================================================================== */
function bind() {
  var q = $("#q"), tmr = null;
  q.addEventListener("input", function () {
    clearTimeout(tmr);
    tmr = setTimeout(function () {
      Q = q.value; QB = bare(Q); PAGE = 40;
      $("#qClr").style.display = Q ? "" : "none";
      render();
    }, 130);
  });
  $("#qClr").onclick = function () {
    q.value = ""; Q = ""; QB = ""; this.style.display = "none"; PAGE = 40; render(); q.focus();
  };

  $("#mFn").onclick = function () { MODE = "fn"; PAGE = 40; saveUI(); renderModes(); render(); };
  $("#mPl").onclick = function () { MODE = "pl"; SHOWALL = true; PAGE = 40; saveUI(); renderModes(); render(); };

  $("#plats").addEventListener("click", function (e) {
    var b = e.target.closest("[data-plat]"); if (!b) return;
    PLAT = b.getAttribute("data-plat"); SHOWALL = true; PAGE = 40; saveUI(); renderPlats(); render();
  });
  $("#secs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sec],[data-diff]"); if (!b) return;
    if (b.getAttribute("data-diff")) DIFFONLY = !DIFFONLY;
    else SEC = b.getAttribute("data-sec");
    SHOWALL = true;
    PAGE = 40; saveUI(); renderSecs(); render();
  });

  $("#list").addEventListener("click", function (e) {
    if (e.target.closest("#more")) { PAGE += 40; render(); return; }
    if (e.target.closest("#showAll")) { SHOWALL = true; PAGE = 40; render(); }
  });

  $("#foot").addEventListener("click", function (e) {
    if (e.target.id === "btnReset") {
      if (!confirm("要把資料回復成內建的那一份嗎？\n（你貼上的那份會被清掉）")) return;
      lsDel(K_DATA); loadAll(); SEC = "*"; PAGE = 40;
      renderModes(); renderPlats(); renderSecs(); render(); toast("已回復成內建資料");
    }
    if (e.target.id === "btnWipe") {
      if (!confirm("要清掉這台裝置存的所有資料與設定嗎？\n（下次打開會回到內建資料）")) return;
      lsDel(K_DATA); lsDel(K_UI);
      MODE = "fn"; SEC = "*"; DIFFONLY = false; Q = ""; QB = "";
      $("#q").value = ""; $("#qClr").style.display = "none";
      loadAll(); PAGE = 40;
      renderModes(); renderPlats(); renderSecs(); render(); toast("已清除");
    }
  });

  $("#btnExport").onclick = openExport;
  $("#btnPaste").onclick = openPaste;
  $("#btnHelp").onclick = openHelp;

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
    if (e.key === "/" && document.activeElement !== q && !$("#mask")) { e.preventDefault(); q.focus(); }
  });
}

/* ---------- 啟動 ---------- */
loadAll();
renderModes();
renderPlats();
renderSecs();
render();
bind();
