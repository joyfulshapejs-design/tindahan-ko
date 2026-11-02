(function () {
  "use strict";

  /* ---------- Storage ---------- */
  var KEY_PRODUCTS = "sari_products_v1";
  var KEY_SALES = "sari_sales_v1";
  var KEY_LOSSES = "sari_losses_v1";
  var KEY_SETTINGS = "sari_settings_v1";
  var KEY_GUARD = "sari_pinguard_v1";       // wrong-PIN counter, so guessing gets slower
  var DAY_MS = 86400000;
  var APP_VERSION = "3.1";                  // keep in step with CACHE in sw.js
  var STORAGE_LIMIT = 5000000;              // browsers allow roughly 5 MB of saved text per website

  var CATEGORIES = ["Vegetables", "Leafy Greens", "Roots & Spices", "Canned Goods", "Others"];

  // How each product can be sold. Kilos can be fractions (0.5 kg); everything else is whole numbers.
  var UNITS = {
    kilo:   { short: "kg",     per: "kilo",   decimal: true,  step: 0.25, option: "kilo (kg)" },
    piece:  { short: "pc",     per: "piece",  decimal: false, step: 1,    option: "piece" },
    bundle: { short: "bundle", per: "bundle", decimal: false, step: 1,    option: "bundle (tali)" },
    pack:   { short: "pack",   per: "pack",   decimal: false, step: 1,    option: "pack" },
    can:    { short: "can",    per: "can",    decimal: false, step: 1,    option: "can (lata)" }
  };

  var V = "Vegetables", L = "Leafy Greens", R = "Roots & Spices", C = "Canned Goods", O = "Others";
  // name, category, cost, selling price, starting stock, unit, [low-stock alert, default 5]
  var SEED = [
    ["Kamatis (Tomato)", V, 60, 80, 15, "kilo"], ["Talong (Eggplant)", V, 50, 70, 12, "kilo"],
    ["Ampalaya (Bitter Gourd)", V, 60, 85, 10, "kilo"], ["Sitaw (String Beans)", V, 12, 18, 20, "bundle"],
    ["Okra", V, 50, 70, 8, "kilo"], ["Upo (Bottle Gourd)", V, 25, 40, 12, "piece"],
    ["Kalabasa (Squash)", V, 25, 38, 15, "kilo"], ["Sayote", V, 30, 45, 10, "kilo"],
    ["Repolyo (Cabbage)", V, 45, 65, 12, "kilo"], ["Pipino (Cucumber)", V, 40, 60, 8, "kilo"],
    ["Patola (Sponge Gourd)", V, 45, 65, 8, "kilo"], ["Baguio Beans", V, 80, 110, 8, "kilo"],
    ["Sili Haba (Finger Chili)", V, 100, 150, 4, "kilo", 2], ["Bell Pepper", V, 150, 210, 4, "kilo", 2],
    ["Mais (Corn)", V, 8, 12, 30, "piece", 10], ["Broccoli", V, 130, 180, 4, "kilo", 2],
    ["Cauliflower", V, 120, 170, 4, "kilo", 2], ["Labanos (Radish)", V, 35, 50, 8, "kilo"],

    ["Kangkong", L, 8, 12, 30, "bundle"], ["Pechay", L, 10, 15, 30, "bundle"],
    ["Mustasa", L, 10, 15, 20, "bundle"], ["Malunggay", L, 8, 12, 25, "bundle"],
    ["Saluyot", L, 8, 12, 15, "bundle"], ["Alugbati", L, 8, 12, 15, "bundle"],
    ["Talbos ng Kamote", L, 8, 12, 20, "bundle"], ["Sibuyang Dahon (Spring Onion)", L, 10, 15, 20, "bundle"],
    ["Pechay Baguio", L, 50, 75, 8, "kilo"], ["Lettuce", L, 90, 130, 5, "kilo", 3],

    ["Sibuyas Pula (Red Onion)", R, 100, 135, 15, "kilo"], ["Sibuyas Puti (White Onion)", R, 90, 125, 8, "kilo"],
    ["Bawang (Garlic)", R, 120, 165, 8, "kilo"], ["Luya (Ginger)", R, 90, 130, 5, "kilo", 3],
    ["Patatas (Potato)", R, 70, 95, 15, "kilo"], ["Carrots", R, 60, 85, 12, "kilo"],
    ["Kamote (Sweet Potato)", R, 35, 50, 10, "kilo"], ["Gabi (Taro)", R, 50, 70, 8, "kilo"],
    ["Singkamas (Jicama)", R, 30, 45, 8, "kilo"], ["Kalamansi", R, 60, 90, 5, "kilo", 3],
    ["Sili Labuyo (Bird's Eye Chili)", R, 160, 240, 2, "kilo", 1], ["Tanglad (Lemongrass)", R, 8, 12, 15, "bundle"],

    ["555 Sardines Tomato", C, 17, 22, 15, "can"], ["Ligo Sardines", C, 17, 22, 15, "can"],
    ["Argentina Corned Beef 150g", C, 32, 40, 10, "can"], ["San Marino Corned Tuna 150g", C, 30, 37, 10, "can"],
    ["Century Tuna Flakes", C, 28, 35, 10, "can"], ["Delimondo Corned Beef", C, 28, 35, 6, "can"],
    ["Reno Liver Spread", C, 17, 22, 10, "can"], ["Del Monte Tomato Sauce 200g", C, 14, 18, 10, "pack"],

    ["Egg", O, 8, 10, 60, "piece", 12], ["Rice", O, 48, 55, 25, "kilo"]
  ];

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { alert("Could not save. Your device storage may be full or blocked."); }
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function makeSeedProducts() {
    return SEED.map(function (s) {
      return { id: uid(), name: s[0], category: s[1], cost: s[2], price: s[3], stock: s[4], unit: s[5], low: s[6] === undefined ? 5 : s[6] };
    });
  }

  var products = load(KEY_PRODUCTS, null);
  if (!products) {
    products = makeSeedProducts();
    save(KEY_PRODUCTS, products);
  }
  var sales = load(KEY_SALES, []);
  var losses = load(KEY_LOSSES, []);        // spoiled / thrown-away stock
  var settings = load(KEY_SETTINGS, { storeName: "Tindahan Ko" });

  /* ---------- Helpers ---------- */
  function peso(n) { return "₱" + (Math.round(n * 100) / 100).toFixed(2); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Products and records saved before units existed count as "piece".
  function unitOf(x) { return UNITS[x && x.unit] || UNITS.piece; }
  function fmtNum(n) { return String(parseFloat(round2(n).toFixed(2))); }
  function fmtQty(q, unitKey) {
    var u = UNITS[unitKey] || UNITS.piece;
    if (u === UNITS.kilo) return fmtNum(q) + " kg";
    return fmtNum(q) + " " + u.short + (q === 1 ? "" : "s");
  }
  // Reads a typed quantity for product p. Returns NaN unless it is valid (kilos may be fractions, others whole).
  function parseQty(p, raw) {
    var q = parseFloat(raw);
    if (isNaN(q) || q <= 0) return NaN;
    if (!unitOf(p).decimal) return q % 1 === 0 ? q : NaN;
    q = round2(q);
    return q > 0 ? q : NaN;
  }
  function allCategories() {
    var cats = CATEGORIES.slice();
    products.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
    return cats;
  }
  function profitPer(p) { return p.price - p.cost; }
  function marginPct(p) { return p.price > 0 ? (profitPer(p) / p.price) * 100 : 0; }
  function isToday(ts) {
    var d = new Date(ts), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  function profitToday(productId) {
    return sales.reduce(function (sum, s) {
      return s.productId === productId && !s.voided && isToday(s.ts) ? sum + (s.price - s.cost) * s.qty : sum;
    }, 0);
  }
  function lossValue(list) {
    return list.reduce(function (sum, l) { return l.voided ? sum : sum + l.cost * l.qty; }, 0);
  }
  function stockStatus(p) {
    if (p.stock <= 0) return { cls: "out", text: "Out of stock" };
    if (p.stock <= p.low) return { cls: "low", text: "Low: " + fmtQty(p.stock, p.unit) + " left" };
    return { cls: "ok", text: fmtQty(p.stock, p.unit) + " in stock" };
  }
  // extra: optional extra lines (HTML) shown inside the green box
  function profitHtml(profit, margin, unitKey, extra) {
    var loss = profit < 0;
    var per = (UNITS[unitKey] || UNITS.piece).per;
    return '<div class="profit-box' + (loss ? " loss" : "") + '">' +
      (loss
        ? "<div>⚠️ You lose <b>" + peso(-profit) + "</b> per " + per + "</div>"
        : "<div>You earn <b>" + peso(profit) + "</b> per " + per + "</div>") +
      "<div>That's <b>" + Math.round(margin * 10) / 10 + "%</b> margin</div>" +
      (extra || "") + "</div>";
  }

  /* ---------- Navigation ---------- */
  var TABS = [
    { id: "home", ico: "🏠", label: "Home" },
    { id: "sell", ico: "🛒", label: "Sell" },
    { id: "products", ico: "📦", label: "Products" },
    { id: "reorder", ico: "📋", label: "Reorder" },
    { id: "reports", ico: "📊", label: "Reports" },
    { id: "settings", ico: "⚙️", label: "Settings" }
  ];
  var currentTab = "home";
  var search = "";
  var catFilter = "All";

  function renderNav() {
    document.getElementById("nav").innerHTML = TABS.map(function (t) {
      return '<button data-tab="' + t.id + '" class="' + (t.id === currentTab ? "active" : "") + '">' +
        '<span class="ico">' + t.ico + "</span>" + t.label + "</button>";
    }).join("");
  }
  document.getElementById("nav").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]");
    if (!b) return;
    currentTab = b.dataset.tab;
    render();
  });

  function render() {
    document.getElementById("storeTitle").textContent = "🏪 " + settings.storeName;
    $("lockBtn").hidden = !settings.pin;
    renderNav();
    if (currentTab === "home") renderHome();
    else if (currentTab === "products") renderProducts();
    else if (currentTab === "sell") renderSell();
    else if (currentTab === "reorder") renderReorder();
    else if (currentTab === "reports") renderReports();
    else if (currentTab === "settings") renderSettings();
  }

  /* ---------- Products screen ---------- */
  function renderProducts() {
    var view = document.getElementById("view");
    view.onclick = null;
    view.innerHTML =
      '<div class="toolbar">' +
        '<input id="q" type="search" placeholder="🔍 Search products" value="' + esc(search) + '">' +
        '<button class="btn" id="btnAdd">+ Add</button>' +
      "</div>" +
      '<div class="chips" id="chips"></div>' +
      '<div id="list"></div>';

    var chips = ["All"].concat(allCategories());
    document.getElementById("chips").innerHTML = chips.map(function (c) {
      return '<button class="chip' + (c === catFilter ? " active" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");

    document.getElementById("q").addEventListener("input", function (e) {
      search = e.target.value;
      renderList();
    });
    document.getElementById("btnAdd").addEventListener("click", function () { openForm(null); });
    document.getElementById("chips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      catFilter = b.dataset.cat;
      renderProducts();
    });
    document.getElementById("list").addEventListener("click", onListClick);
    renderList();
  }

  function renderList() {
    var q = search.trim().toLowerCase();
    var shown = products.filter(function (p) {
      return (catFilter === "All" || p.category === catFilter) &&
             (!q || p.name.toLowerCase().indexOf(q) !== -1);
    });
    var list = document.getElementById("list");
    if (!shown.length) {
      list.innerHTML = '<div class="empty">No products found.<br>Tap <b>+ Add</b> to add one.</div>';
      return;
    }
    list.innerHTML = allCategories().map(function (cat) {
      var items = shown.filter(function (p) { return p.category === cat; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
      if (!items.length) return "";
      return '<h2 class="cat">' + esc(cat) + " (" + items.length + ")</h2>" + items.map(cardHtml).join("");
    }).join("");
  }

  function cardHtml(p) {
    var st = stockStatus(p);
    var today = profitToday(p.id);
    return '<div class="card" data-id="' + p.id + '">' +
      '<div class="card-top"><div>' +
        '<div class="name">' + esc(p.name) + "</div>" +
        '<div class="prices">Bought ' + peso(p.cost) + " · Sells " + peso(p.price) + " per " + unitOf(p).per + "</div>" +
      '</div><span class="badge ' + st.cls + '">' + st.text + "</span></div>" +
      profitHtml(profitPer(p), marginPct(p), p.unit, "<div>Profit from this today: <b>" + peso(today) + "</b></div>") +
      '<div class="card-actions">' +
        '<button class="btn small ghost" data-act="edit">✏️ Edit</button>' +
        '<button class="btn small ghost" data-act="spoil">🥬 Spoiled</button>' +
        '<button class="btn small ghost" data-act="del">🗑 Delete</button>' +
      "</div></div>";
  }

  function onListClick(e) {
    var btn = e.target.closest("button[data-act]");
    if (!btn) return;
    var id = btn.closest(".card").dataset.id;
    var p = products.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (btn.dataset.act === "edit") openForm(p);
    if (btn.dataset.act === "spoil") openSpoil(p);
    if (btn.dataset.act === "del") {
      if (confirm('Delete "' + p.name + '"?\nThis cannot be undone.')) {
        products = products.filter(function (x) { return x.id !== id; });
        save(KEY_PRODUCTS, products);
        renderList();
      }
    }
  }

  /* ---------- Add / Edit form ---------- */
  var editingId = null;
  var $ = function (id) { return document.getElementById(id); };

  $("fUnit").innerHTML = Object.keys(UNITS).map(function (k) {
    return '<option value="' + k + '">' + esc(UNITS[k].option) + "</option>";
  }).join("");

  function formUnit() { return $("fUnit").value; }

  function syncUnitLabels() {
    var u = UNITS[formUnit()] || UNITS.piece;
    $("lblCost").textContent = "(magkano binili, per " + u.per + ")";
    $("lblSell").textContent = "(magkano ibinebenta, per " + u.per + ")";
    $("lblStock").textContent = "(in " + (u === UNITS.kilo ? "kilos" : u.short + "s") + ")";
    $("lblLow").textContent = "(low stock, in " + (u === UNITS.kilo ? "kilos" : u.short + "s") + ")";
  }

  function openForm(p) {
    editingId = p ? p.id : null;
    $("sheetTitle").textContent = p ? "Edit product" : "Add product";
    $("fName").value = p ? p.name : "";
    var cats = allCategories();
    $("fCat").innerHTML = cats.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("");
    $("fCat").value = p ? p.category : (catFilter !== "All" ? catFilter : cats[0]);
    $("fUnit").value = p ? (UNITS[p.unit] ? p.unit : "piece") : "kilo";
    $("fCost").value = p ? p.cost : "";
    $("fSell").value = p ? p.price : "";
    $("fStock").value = p ? p.stock : "";
    $("fLow").value = p ? p.low : 5;
    syncUnitLabels();
    updateLiveCalc();
    $("overlay").classList.add("open");
    $("fName").focus();
  }
  function closeForm() { $("overlay").classList.remove("open"); }

  function updateLiveCalc() {
    var cost = parseFloat($("fCost").value), price = parseFloat($("fSell").value);
    if (isNaN(cost) || isNaN(price)) { $("liveCalc").innerHTML = ""; return; }
    var p = { cost: cost, price: price };
    $("liveCalc").innerHTML = profitHtml(profitPer(p), marginPct(p), formUnit());
  }
  ["fCost", "fSell"].forEach(function (id) { $(id).addEventListener("input", updateLiveCalc); });
  $("fUnit").addEventListener("change", function () { syncUnitLabels(); updateLiveCalc(); });

  $("btnCancel").addEventListener("click", closeForm);
  $("overlay").addEventListener("click", function (e) { if (e.target === $("overlay")) closeForm(); });

  $("btnSave").addEventListener("click", function () {
    var name = $("fName").value.trim();
    var unit = formUnit();
    var decimal = UNITS[unit].decimal;
    var cost = parseFloat($("fCost").value);
    var price = parseFloat($("fSell").value);
    var stock = parseFloat($("fStock").value);
    var low = parseFloat($("fLow").value);

    if (!name) return alert("Please type the product name.");
    if (isNaN(cost) || cost < 0) return alert("Please enter the cost price (magkano binili).");
    if (isNaN(price) || price < 0) return alert("Please enter the selling price (magkano ibinebenta).");
    if (isNaN(stock) || stock < 0) stock = 0;
    if (isNaN(low) || low < 0) low = 5;
    stock = decimal ? round2(stock) : Math.round(stock);
    low = decimal ? round2(low) : Math.round(low);

    var data = { name: name, category: $("fCat").value, unit: unit, cost: cost, price: price, stock: stock, low: low };
    if (editingId) {
      products = products.map(function (p) { return p.id === editingId ? Object.assign({}, p, data) : p; });
    } else {
      data.id = uid();
      products.push(data);
    }
    save(KEY_PRODUCTS, products);
    closeForm();
    renderProducts();
  });

  /* ---------- Spoilage (Itapon) ---------- */
  var spoilingId = null;

  function currentSpoilProduct() {
    return products.filter(function (x) { return x.id === spoilingId; })[0];
  }
  function openSpoil(p) {
    spoilingId = p.id;
    $("spoilName").textContent = "🥬 Spoiled: " + p.name;
    $("spoilInfo").textContent = "In stock now: " + fmtQty(p.stock, p.unit) + " · cost " + peso(p.cost) + " per " + unitOf(p).per;
    $("lblSpQty").textContent = unitOf(p).decimal ? "How many kilos spoiled?" : "How many spoiled?";
    $("spQty").value = "";
    $("spQty").step = unitOf(p).decimal ? "any" : "1";
    $("spQty").inputMode = unitOf(p).decimal ? "decimal" : "numeric";
    $("spReason").value = "Nabulok (rotten)";
    $("spNote").value = "";
    updateSpoilCalc();
    $("spoilOverlay").classList.add("open");
    $("spQty").focus();
  }
  function closeSpoil() { $("spoilOverlay").classList.remove("open"); spoilingId = null; }

  function updateSpoilCalc() {
    var p = currentSpoilProduct();
    if (!p) return;
    var q = parseQty(p, $("spQty").value);
    var ok = false, html;
    if (isNaN(q)) {
      html = '<div class="sell-warn" style="font-size:16px">' + (unitOf(p).decimal ? "Enter how many kilos." : "Enter a whole number.") + "</div>";
    } else if (q > p.stock) {
      html = '<div class="sell-warn" style="font-size:16px">You only have ' + fmtQty(p.stock, p.unit) + " in stock.</div>";
    } else {
      ok = true;
      html = "Loss: " + peso(p.cost * q);
    }
    $("spoilCalc").innerHTML = html;
    $("spoilConfirm").disabled = !ok;
  }
  $("spQty").addEventListener("input", updateSpoilCalc);
  $("spoilCancel").addEventListener("click", closeSpoil);
  $("spoilOverlay").addEventListener("click", function (e) { if (e.target === $("spoilOverlay")) closeSpoil(); });
  $("spoilConfirm").addEventListener("click", function () {
    var p = currentSpoilProduct();
    if (!p) return;
    var q = parseQty(p, $("spQty").value);
    if (isNaN(q) || q > p.stock) return;
    var note = $("spNote").value.trim();
    p.stock = round2(p.stock - q);
    losses.push({
      id: uid(), productId: p.id, name: p.name, unit: p.unit || "piece", qty: q, cost: p.cost,
      reason: $("spReason").value + (note ? ": " + note : ""), ts: Date.now()
    });
    save(KEY_PRODUCTS, products);
    save(KEY_LOSSES, losses);
    closeSpoil();
    toast("Recorded: " + fmtQty(q, p.unit) + " " + p.name + " spoiled — lost " + peso(p.cost * q));
    renderList();
  });

  /* ---------- Home screen ---------- */
  var MAX_ALERTS = 8;

  function renderHome() {
    $("view").onclick = null;
    var todays = sales.filter(function (s) { return !s.voided && isToday(s.ts); });
    var revenue = 0, profit = 0;
    todays.forEach(function (s) {
      revenue += s.price * s.qty;
      profit += (s.price - s.cost) * s.qty;
    });
    var spoiledToday = lossValue(losses.filter(function (l) { return isToday(l.ts); }));

    var needs = products.filter(function (p) { return p.stock <= p.low; })
      .sort(function (a, b) { return a.stock - b.stock || a.name.localeCompare(b.name); });

    var alertsHtml;
    if (!needs.length) {
      alertsHtml = '<div class="all-good">✓ Everything is well stocked</div>';
    } else {
      alertsHtml = needs.slice(0, MAX_ALERTS).map(function (p) {
        var st = stockStatus(p);
        return '<div class="alert-row"><span class="aname">' + esc(p.name) + '</span>' +
          '<span class="badge ' + st.cls + '">' + st.text + "</span></div>";
      }).join("");
      if (needs.length > MAX_ALERTS) {
        alertsHtml += '<div class="prices">…and ' + (needs.length - MAX_ALERTS) + " more items running low</div>";
      }
    }

    var staleBackup = (sales.length > 0 || losses.length > 0) && (!settings.lastBackup || Date.now() - settings.lastBackup > 7 * DAY_MS);
    var backupNote = staleBackup
      ? '<div class="backup-note">💾 ' + (settings.lastBackup ? "No backup in over a week." : "You haven't backed up yet.") +
        ' <button class="btn small" id="goBackup">Back up now</button></div>'
      : "";

    var fullNote = storageNearlyFull()
      ? '<div class="backup-note">🗄 Storage is almost full. <button class="btn small" id="goStorage">See details</button></div>'
      : "";

    $("view").innerHTML = backupNote + fullNote +
      '<div class="stats">' +
        '<div class="stat wide"><div class="label">💰 Total sales today</div><div class="num">' + peso(revenue) + "</div></div>" +
        '<div class="stat profit' + (profit < 0 ? " loss" : "") + '"><div class="label">📈 Profit today</div><div class="num">' + peso(profit) + "</div></div>" +
        '<div class="stat"><div class="label">🧾 Sales recorded</div><div class="num">' + todays.length + "</div></div>" +
        (spoiledToday > 0
          ? '<div class="stat span2 spoil"><div class="label">🥬 Spoiled today (lost)</div><div class="num">' + peso(spoiledToday) + "</div></div>"
          : "") +
      "</div>" +
      '<h2 class="alerts-title">⚠️ Running low' + (needs.length ? " (" + needs.length + ")" : "") + "</h2>" +
      alertsHtml +
      '<button class="btn sell-now" id="goSell">🛒 Record a sale</button>';

    $("goSell").addEventListener("click", function () { currentTab = "sell"; render(); });
    if (staleBackup) $("goBackup").addEventListener("click", function () { currentTab = "settings"; render(); });
    if (fullNote) $("goStorage").addEventListener("click", function () { currentTab = "settings"; render(); });
  }

  /* ---------- Settings screen ---------- */
  var BACKUP_MARKER = "tindahan-ko-backup";

  function renderSettings() {
    $("view").onclick = null;
    var last = settings.lastBackup
      ? new Date(settings.lastBackup).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
      : "Never";
    $("view").innerHTML =
      '<div class="card"><h2 class="alerts-title" style="margin-top:0">🏪 Store name</h2>' +
        '<input id="setName" maxlength="40" value="' + esc(settings.storeName) + '">' +
        '<button class="btn" id="saveName" style="margin-top:10px">Save name</button></div>' +
      pinCardHtml() +
      storageCardHtml() +
      '<div class="card"><h2 class="alerts-title" style="margin-top:0">💾 Backup</h2>' +
        '<div class="prices">Last backup: <b>' + esc(last) + "</b></div>" +
        '<p>Saves your products, sales, spoilage and history in one file. Keep it somewhere safe, like sending it to yourself.</p>' +
        '<div class="card-actions"><button class="btn" id="btnExport">⬇ Download backup</button>' +
        '<button class="btn ghost" id="btnImport">⬆ Restore backup</button></div>' +
        '<input type="file" id="fileImport" accept=".json,application/json" hidden></div>' +
      '<div class="card"><h2 class="alerts-title" style="margin-top:0">📊 Spreadsheet</h2>' +
        "<p>Download your numbers to open in Excel or Google Sheets. This is for reading and printing only. It is not a backup and can't be restored.</p>" +
        '<div class="card-actions">' +
        '<button class="btn ghost small" data-csv="products">⬇ Products</button>' +
        '<button class="btn ghost small" data-csv="sales">⬇ Sales</button>' +
        '<button class="btn ghost small" data-csv="spoilage">⬇ Spoilage</button></div></div>' +
      '<div class="card"><h2 class="alerts-title" style="margin-top:0">⚠️ Start over</h2>' +
        "<p>Erases all sales, spoilage and history and puts the starting product list back. Download a backup first.</p>" +
        '<button class="btn danger" id="btnReset">Reset everything</button></div>' +
      '<div class="prices" style="text-align:center;margin-top:8px">Tindahan Ko · version ' + APP_VERSION + "</div>";

    $("saveName").addEventListener("click", function () {
      settings.storeName = $("setName").value.trim() || "Tindahan Ko";
      save(KEY_SETTINGS, settings);
      render();
      toast("✓ Store name saved");
    });
    $("btnExport").addEventListener("click", exportBackup);
    $("btnImport").addEventListener("click", function () { $("fileImport").click(); });
    $("fileImport").addEventListener("change", importBackup);
    $("btnReset").addEventListener("click", resetAll);
    $("view").onclick = function (e) {
      var b = e.target.closest("button[data-csv]");
      if (b) return exportCsv(b.dataset.csv);
      var p = e.target.closest("button[data-pin]");
      if (p) pinAction(p.dataset.pin);
    };
  }

  /* ----- storage meter ----- */
  function storageUsed() {
    var total = 0;
    [KEY_PRODUCTS, KEY_SALES, KEY_LOSSES, KEY_SETTINGS, KEY_GUARD].forEach(function (k) {
      try {
        var v = localStorage.getItem(k);
        if (v) total += k.length + v.length;
      } catch (e) { /* storage blocked: count nothing */ }
    });
    return total;
  }
  function storageNearlyFull() { return storageUsed() / STORAGE_LIMIT >= 0.8; }
  function fmtSize(chars) {
    return chars < 1048576 ? Math.max(1, Math.round(chars / 1024)) + " KB" : (chars / 1048576).toFixed(1) + " MB";
  }
  function storageCardHtml() {
    var used = storageUsed();
    var pct = Math.min(100, used / STORAGE_LIMIT * 100);
    var avg = sales.length ? JSON.stringify(sales).length / sales.length : 141;
    var room = Math.max(0, Math.floor((STORAGE_LIMIT - used) / (avg + 1)));
    var level = pct >= 85 ? "bad" : pct >= 60 ? "warn" : "good";
    return '<div class="card"><h2 class="alerts-title" style="margin-top:0">🗄 Storage used</h2>' +
      '<div><b>' + fmtSize(used) + "</b> of about 5 MB (" + (pct < 1 ? "less than 1" : Math.round(pct)) + "%)</div>" +
      '<div class="meter ' + level + '"><span style="width:' + Math.max(1, pct) + '%"></span></div>' +
      '<div class="prices">' + products.length + " products · " + sales.length + " sales · " + losses.length + " spoilage entries</div>" +
      '<div class="prices">Room for about ' + room.toLocaleString() + " more sales.</div>" +
      (pct >= 80
        ? '<p style="color:var(--bad);font-weight:700">Almost full. Download a backup now. New sales may stop saving when it is full.</p>'
        : "") + "</div>";
  }

  /* ----- spreadsheet export (CSV) ----- */
  function csvCell(v) {
    if (typeof v === "number") return String(round2(v));
    var s = String(v === undefined || v === null ? "" : v);
    // Stop a typed name like "=1+1" from running as a formula when opened in a spreadsheet.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csvDate(ts) {
    var d = new Date(ts), p = function (n) { return String(n).padStart(2, "0"); };
    return [d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()), p(d.getHours()) + ":" + p(d.getMinutes())];
  }
  function csvRows(kind) {
    var unit = function (x) { return unitOf(x).per; };
    if (kind === "products") {
      return [["Name", "Category", "Sold per", "Cost price", "Selling price", "Profit per unit", "Margin %", "Stock", "Low-stock alert"]]
        .concat(products.slice().sort(function (a, b) { return a.category.localeCompare(b.category) || a.name.localeCompare(b.name); })
          .map(function (p) {
            return [p.name, p.category, unit(p), p.cost, p.price, profitPer(p), Math.round(marginPct(p) * 10) / 10, p.stock, p.low];
          }));
    }
    if (kind === "sales") {
      return [["Date", "Time", "Product", "Quantity", "Sold per", "Price each", "Cost each", "Total sales", "Profit", "Status", "Void reason"]]
        .concat(sales.slice().sort(function (a, b) { return a.ts - b.ts; }).map(function (s) {
          var d = csvDate(s.ts);
          return [d[0], d[1], s.name, s.qty, unit(s), s.price, s.cost, s.price * s.qty, (s.price - s.cost) * s.qty,
            s.voided ? "VOIDED" : "Counted", s.voidReason || ""];
        }));
    }
    return [["Date", "Time", "Product", "Quantity", "Unit", "Cost each", "Money lost", "Reason", "Status"]]
      .concat(losses.slice().sort(function (a, b) { return a.ts - b.ts; }).map(function (l) {
        var d = csvDate(l.ts);
        return [d[0], d[1], l.name, l.qty, unit(l), l.cost, l.cost * l.qty, l.reason || "", l.voided ? "UNDONE" : "Counted"];
      }));
  }
  function exportCsv(kind) {
    var rows = csvRows(kind);
    // The leading BOM makes Excel show ₱ and Filipino letters correctly.
    var text = "﻿" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date();
    a.href = url;
    a.download = "tindahan-" + kind + "-" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast(rows.length > 1 ? "✓ Spreadsheet downloaded" : "Downloaded — nothing recorded yet, only the headings");
  }

  function exportBackup() {
    var data = {
      app: BACKUP_MARKER, version: 2, exportedAt: Date.now(),
      settings: { storeName: settings.storeName },   // never put the PIN in a backup file
      products: products, sales: sales, losses: losses
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var d = new Date();
    a.href = url;
    a.download = "tindahan-backup-" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    settings.lastBackup = Date.now();
    save(KEY_SETTINGS, settings);
    renderSettings();
    toast("✓ Backup downloaded");
  }

  function validBackup(d) {
    if (!d || d.app !== BACKUP_MARKER || !Array.isArray(d.products) || !Array.isArray(d.sales)) return false;
    if (d.losses !== undefined && !Array.isArray(d.losses)) return false;
    var num = function (v) { return typeof v === "number" && isFinite(v); };
    return d.products.every(function (p) {
      return p && typeof p.name === "string" && num(p.cost) && num(p.price) && num(p.stock);
    }) && d.sales.every(function (s) {
      return s && typeof s.productId === "string" && num(s.qty) && num(s.price) && num(s.cost) && num(s.ts);
    }) && (d.losses || []).every(function (l) {
      return l && typeof l.productId === "string" && num(l.qty) && num(l.cost) && num(l.ts);
    });
  }

  function importBackup(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (err) { data = null; }
      if (!validBackup(data)) {
        alert("That file is not a valid backup from this app. Nothing was changed.");
        e.target.value = "";
        return;
      }
      if (!confirm("Replace ALL current data with this backup?\n\n" + data.products.length + " products, " + data.sales.length + " sales.\nThis cannot be undone.")) {
        e.target.value = "";
        return;
      }
      products = data.products.map(function (p) {
        return {
          id: typeof p.id === "string" ? p.id : uid(), name: p.name,
          category: typeof p.category === "string" ? p.category : "Others",
          unit: UNITS[p.unit] ? p.unit : "piece",
          cost: p.cost, price: p.price, stock: Math.max(0, p.stock),
          low: typeof p.low === "number" && isFinite(p.low) ? p.low : 5
        };
      });
      sales = data.sales;
      losses = data.losses || [];
      var name = data.settings && typeof data.settings.storeName === "string" ? data.settings.storeName.trim() : "";
      settings = { storeName: name || "Tindahan Ko", lastBackup: settings.lastBackup, pin: settings.pin };
      save(KEY_PRODUCTS, products);
      save(KEY_SALES, sales);
      save(KEY_LOSSES, losses);
      save(KEY_SETTINGS, settings);
      render();
      toast("✓ Backup restored");
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm("Erase ALL sales, spoilage and history, and put back the starting product list?\n\nThis cannot be undone. Have you downloaded a backup?")) return;
    if (!confirm("Last check: really erase everything?")) return;
    products = makeSeedProducts();
    sales = [];
    losses = [];
    save(KEY_PRODUCTS, products);
    save(KEY_SALES, sales);
    save(KEY_LOSSES, losses);
    render();
    toast("Everything was reset");
  }

  /* ---------- Reports screen ---------- */
  var reportRange = "today";
  var TOP_N = 10;

  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }

  function reportChips() {
    return '<div class="chips">' +
      [["today", "Today"], ["week", "This week"], ["history", "History"]].map(function (r) {
        return '<button class="chip' + (reportRange === r[0] ? " active" : "") + '" data-range="' + r[0] + '">' + r[1] + "</button>";
      }).join("") + "</div>";
  }

  function bindReports() {
    $("view").onclick = function (e) {
      var v = e.target.closest("button[data-void]");
      if (v) {
        var s = sales.filter(function (x) { return x.id === v.dataset.void; })[0];
        if (s) openVoid(s);
        return;
      }
      var u = e.target.closest("button[data-unspoil]");
      if (u) {
        undoSpoil(u.dataset.unspoil);
        return;
      }
      var b = e.target.closest(".chip[data-range]");
      if (!b) return;
      reportRange = b.dataset.range;
      renderReports();
    };
  }

  function undoSpoil(id) {
    var l = losses.filter(function (x) { return x.id === id; })[0];
    if (!l || l.voided) return;
    if (!confirm("Undo this? " + fmtQty(l.qty, l.unit) + " " + l.name + " will be put back in stock.")) return;
    l.voided = true;
    l.voidedAt = Date.now();
    var p = products.filter(function (x) { return x.id === l.productId; })[0];
    if (p) p.stock = round2(p.stock + l.qty);
    save(KEY_PRODUCTS, products);
    save(KEY_LOSSES, losses);
    toast("Undone" + (p ? " — put back in stock" : " (product no longer exists, stock not changed)"));
    renderHistory();
  }

  function renderHistory() {
    var fmt = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
    var entries = sales.map(function (s) { return { kind: "sale", e: s }; })
      .concat(losses.map(function (l) { return { kind: "loss", e: l }; }))
      .sort(function (a, b) { return b.e.ts - a.e.ts; }).slice(0, 100);
    var html = reportChips() + '<div class="prices" style="margin-bottom:10px">Every sale and spoilage, newest first. Voided ones stay here for reference.</div>';
    if (!entries.length) {
      html += '<div class="empty">Nothing recorded yet.</div>';
    } else {
      html += entries.map(function (x) {
        var s = x.e, isLoss = x.kind === "loss";
        var when = new Date(s.ts).toLocaleString(undefined, fmt);
        var title = isLoss
          ? "🥬 " + fmtQty(s.qty, s.unit) + " " + esc(s.name)
          : fmtQty(s.qty, s.unit) + " " + esc(s.name);
        var main = '<div class="rank-info"><div class="aname">' + title + '</div><div class="prices">' + esc(when) +
          (isLoss ? ' · <span class="badge spoil">SPOILED</span>' : "") + "</div>";
        if (isLoss && !s.voided && s.reason) main += '<div class="prices">' + esc(s.reason) + "</div>";
        if (s.voided) {
          main += '<div class="prices"><span class="badge out">' + (isLoss ? "UNDONE" : "VOIDED") + "</span> " +
            esc(new Date(s.voidedAt).toLocaleString(undefined, fmt)) +
            (!isLoss && s.voidReason ? " · " + esc(s.voidReason) : "") + "</div>";
        }
        main += "</div>";
        var money = isLoss ? "lost " + peso(s.cost * s.qty) : peso(s.price * s.qty);
        var btn = s.voided ? "" : (isLoss
          ? '<button class="btn small ghost" data-unspoil="' + s.id + '">Undo</button>'
          : '<button class="btn small ghost" data-void="' + s.id + '">Void</button>');
        return '<div class="rank-row' + (isLoss ? " loss" : "") + (s.voided ? " voided" : "") + '">' + main +
          '<div class="rank-money">' + money + "<br>" + btn + "</div></div>";
      }).join("");
    }
    $("view").innerHTML = html;
    bindReports();
  }

  function renderReports() {
    if (reportRange === "history") { renderHistory(); return; }
    var isWeek = reportRange === "week";
    var from = isWeek ? startOfDay(Date.now() - 6 * DAY_MS) : startOfDay(Date.now());
    var inRange = sales.filter(function (s) { return !s.voided && s.ts >= from; });
    var spoiled = lossValue(losses.filter(function (l) { return l.ts >= from; }));

    var revenue = 0, profit = 0, byProduct = {};
    inRange.forEach(function (s) {
      var rev = s.price * s.qty, prof = (s.price - s.cost) * s.qty;
      revenue += rev; profit += prof;
      var key = s.productId;
      if (!byProduct[key]) byProduct[key] = { name: s.name, unit: s.unit, qty: 0, revenue: 0, profit: 0 };
      byProduct[key].qty += s.qty;
      byProduct[key].revenue += rev;
      byProduct[key].profit += prof;
    });
    // Best sellers by money earned, since kilos, bundles and cans can't be compared by count.
    var ranked = Object.keys(byProduct).map(function (k) { return byProduct[k]; })
      .sort(function (a, b) { return b.revenue - a.revenue || b.profit - a.profit || a.name.localeCompare(b.name); });

    var label = isWeek ? "Last 7 days" : "Today";
    var html = reportChips() +
      '<div class="stats">' +
        '<div class="stat wide"><div class="label">💰 Sales — ' + label + " (" + inRange.length + " sale" + (inRange.length === 1 ? "" : "s") + ')</div><div class="num">' + peso(revenue) + "</div></div>" +
        '<div class="stat profit' + (profit < 0 ? " loss" : "") + '"><div class="label">📈 Profit</div><div class="num">' + peso(profit) + "</div></div>" +
        '<div class="stat spoil"><div class="label">🥬 Spoiled (lost)</div><div class="num">' + peso(spoiled) + "</div></div>" +
      "</div>" +
      '<h2 class="alerts-title">🏆 Best sellers' + (isWeek ? " this week" : " today") + "</h2>";

    if (!ranked.length) {
      html += '<div class="empty">No sales yet' + (isWeek ? " in the last 7 days" : " today") + ".<br>Sales you record will show up here.</div>";
    } else {
      html += ranked.slice(0, TOP_N).map(function (r, i) {
        return '<div class="rank-row"><div class="rank-no">' + (i + 1) + "</div>" +
          '<div class="rank-info"><div class="aname">' + esc(r.name) + '</div><div class="prices">' + fmtQty(r.qty, r.unit) + " sold</div></div>" +
          '<div class="rank-money">' + peso(r.revenue) + "<br>earned <b>" + peso(r.profit) + "</b></div></div>";
      }).join("");
      html += '<div class="prices">Ranked by money taken in.' + (ranked.length > TOP_N ? " Showing the top " + TOP_N + " of " + ranked.length + " items." : "") + "</div>";
    }

    $("view").innerHTML = html;
    bindReports();
  }

  /* ----- void a sale (kept in history, stock goes back) ----- */
  var voidingId = null;
  function openVoid(s) {
    voidingId = s.id;
    $("voidName").textContent = "Void: " + fmtQty(s.qty, s.unit) + " " + s.name;
    $("voidInfo").textContent = peso(s.price * s.qty) + " · the stock will be put back";
    $("vReason").value = "Wrong item";
    $("vNote").value = "";
    $("voidOverlay").classList.add("open");
  }
  function closeVoid() { $("voidOverlay").classList.remove("open"); voidingId = null; }
  $("voidCancel").addEventListener("click", closeVoid);
  $("voidOverlay").addEventListener("click", function (e) { if (e.target === $("voidOverlay")) closeVoid(); });
  $("voidConfirm").addEventListener("click", function () {
    var s = sales.filter(function (x) { return x.id === voidingId; })[0];
    if (!s || s.voided) return closeVoid();
    var note = $("vNote").value.trim();
    s.voided = true;
    s.voidedAt = Date.now();
    s.voidReason = $("vReason").value + (note ? ": " + note : "");
    var p = products.filter(function (x) { return x.id === s.productId; })[0];
    if (p) p.stock = round2(p.stock + s.qty);
    save(KEY_PRODUCTS, products);
    save(KEY_SALES, sales);
    closeVoid();
    toast("Sale voided" + (p ? " — " + fmtQty(s.qty, s.unit) + " put back in stock" : " (product no longer exists, stock not changed)"));
    renderHistory();
  });

  /* ---------- Reorder (Pabili) screen ---------- */
  var restockingId = null;

  function renderReorder() {
    var needs = products.filter(function (p) { return p.stock <= p.low; });
    var dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    var html = '<h2 class="alerts-title" style="margin-top:0">📋 Pabili list</h2>' +
      '<div class="prices">' + esc(dateStr) + (needs.length ? " · " + needs.length + " item" + (needs.length > 1 ? "s" : "") : "") + "</div>";

    if (!needs.length) {
      html += '<div class="all-good" style="margin-top:16px">✓ Nothing to buy. Everything is well stocked.</div>';
    } else {
      allCategories().forEach(function (cat) {
        var items = needs.filter(function (p) { return p.category === cat; })
          .sort(function (a, b) { return a.stock - b.stock || a.name.localeCompare(b.name); });
        if (!items.length) return;
        html += '<h2 class="cat">' + esc(cat) + "</h2>" + items.map(function (p) {
          var st = stockStatus(p);
          return '<div class="alert-row" data-id="' + p.id + '">' +
            '<div><div class="aname">' + esc(p.name) + '</div><span class="badge ' + st.cls + '">' + st.text + "</span></div>" +
            '<button class="btn small" data-act="restock">✓ Restocked</button></div>';
        }).join("");
      });
    }
    $("view").innerHTML = html;
    $("view").onclick = function (e) {
      var b = e.target.closest("button[data-act=restock]");
      if (!b) return;
      var p = products.filter(function (x) { return x.id === b.closest(".alert-row").dataset.id; })[0];
      if (p) openRestock(p);
    };
  }

  function currentRestockProduct() {
    return products.filter(function (x) { return x.id === restockingId; })[0];
  }
  function openRestock(p) {
    restockingId = p.id;
    $("restockName").textContent = p.name;
    $("restockInfo").textContent = "Now: " + fmtQty(p.stock, p.unit) + " left · alert at " + fmtNum(p.low);
    $("lblRQty").textContent = unitOf(p).decimal ? "How many kilos did you buy?" : "How many did you buy?";
    $("rQty").step = unitOf(p).decimal ? "any" : "1";
    $("rQty").inputMode = unitOf(p).decimal ? "decimal" : "numeric";
    $("rQty").value = fmtNum(Math.max(p.low * 2 - p.stock, 1));
    updateRestockCalc();
    $("restockOverlay").classList.add("open");
  }
  function closeRestock() { $("restockOverlay").classList.remove("open"); restockingId = null; }

  function updateRestockCalc() {
    var p = currentRestockProduct();
    if (!p) return;
    var q = parseQty(p, $("rQty").value);
    var ok = !isNaN(q);
    $("restockConfirm").disabled = !ok;
    if (!ok) {
      $("restockCalc").textContent = "";
      $("restockNote").textContent = unitOf(p).decimal ? "Enter how many kilos you bought." : "Enter a whole number.";
      return;
    }
    var ns = round2(p.stock + q);
    $("restockCalc").textContent = "New stock: " + fmtQty(ns, p.unit);
    $("restockNote").textContent = ns <= p.low
      ? "Still at or below the alert number, so it will stay on the list."
      : "This will clear it from the list.";
  }
  $("rQty").addEventListener("input", updateRestockCalc);
  $("restockCancel").addEventListener("click", closeRestock);
  $("restockOverlay").addEventListener("click", function (e) { if (e.target === $("restockOverlay")) closeRestock(); });
  $("restockConfirm").addEventListener("click", function () {
    var p = currentRestockProduct();
    if (!p) return;
    var q = parseQty(p, $("rQty").value);
    if (isNaN(q)) return;
    p.stock = round2(p.stock + q);
    save(KEY_PRODUCTS, products);
    closeRestock();
    toast("✓ " + p.name + " restocked — now " + fmtQty(p.stock, p.unit));
    renderReorder();
  });

  /* ---------- Sell screen ---------- */
  var sellSearch = "";
  var sellCat = "All";
  var sellingId = null;
  var toastTimer = null;

  function renderSell() {
    $("view").onclick = null;
    $("view").innerHTML =
      '<div class="toolbar"><input id="sq" type="search" placeholder="🔍 What did they buy?" value="' + esc(sellSearch) + '"></div>' +
      '<div class="chips" id="schips"></div>' +
      '<div class="sell-grid" id="sgrid"></div>';

    $("schips").innerHTML = ["All"].concat(allCategories()).map(function (c) {
      return '<button class="chip' + (c === sellCat ? " active" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");

    $("sq").addEventListener("input", function (e) { sellSearch = e.target.value; renderSellList(); });
    $("schips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      sellCat = b.dataset.cat;
      renderSell();
    });
    $("sgrid").addEventListener("click", function (e) {
      var b = e.target.closest(".sell-item");
      if (!b || b.disabled) return;
      var p = products.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (p) openSell(p);
    });
    renderSellList();
  }

  function renderSellList() {
    var q = sellSearch.trim().toLowerCase();
    var shown = products.filter(function (p) {
      return (sellCat === "All" || p.category === sellCat) && (!q || p.name.toLowerCase().indexOf(q) !== -1);
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });

    $("sgrid").innerHTML = shown.length ? shown.map(function (p) {
      var low = p.stock > 0 && p.stock <= p.low;
      return '<button class="sell-item' + (low ? " low" : "") + '" data-id="' + p.id + '"' + (p.stock <= 0 ? " disabled" : "") + ">" +
        '<span class="sname">' + esc(p.name) + "</span>" +
        '<span class="sprice">' + peso(p.price) + " <small>/ " + unitOf(p).per + "</small></span>" +
        '<span class="sstock">' + (p.stock <= 0 ? "Out of stock" : fmtQty(p.stock, p.unit) + " left") + "</span></button>";
    }).join("") : '<div class="empty" style="grid-column:1/-1">No products found.</div>';
  }

  function openSell(p) {
    sellingId = p.id;
    var u = unitOf(p);
    $("sellName").textContent = p.name;
    $("sellInfo").textContent = peso(p.price) + " per " + u.per + " · " + fmtQty(p.stock, p.unit) + " in stock";
    $("lblSQty").textContent = u.decimal ? "How many kilos sold?" : "How many sold?";
    $("sQty").step = u.decimal ? "any" : "1";
    $("sQty").inputMode = u.decimal ? "decimal" : "numeric";
    $("sQty").value = u.decimal ? Math.min(1, p.stock) : 1;
    updateSellCalc();
    $("sellOverlay").classList.add("open");
  }
  function closeSell() { $("sellOverlay").classList.remove("open"); sellingId = null; }

  function currentSellProduct() {
    return products.filter(function (x) { return x.id === sellingId; })[0];
  }

  function updateSellCalc() {
    var p = currentSellProduct();
    if (!p) return;
    var q = parseQty(p, $("sQty").value);
    var ok = false, html;
    if (isNaN(q)) {
      html = '<div class="sell-warn">' + (unitOf(p).decimal ? "Enter how many kilos were sold." : "Enter a whole number.") + "</div>";
    } else if (q > p.stock) {
      html = '<div class="sell-warn">Only ' + fmtQty(p.stock, p.unit) + " left in stock.</div>";
    } else {
      ok = true;
      var profit = (p.price - p.cost) * q;
      html = '<div class="sell-total">Total: ' + peso(p.price * q) + "</div>" +
        '<div class="profit-box' + (profit < 0 ? " loss" : "") + '">' +
        (profit < 0 ? "You lose <b>" + peso(-profit) + "</b> on this sale" : "You earn <b>" + peso(profit) + "</b> on this sale") +
        "</div>";
    }
    $("sellCalc").innerHTML = html;
    $("sellConfirm").disabled = !ok;
  }

  function bumpQty(direction) {
    var p = currentSellProduct();
    if (!p) return;
    var step = unitOf(p).step;
    var q = parseFloat($("sQty").value);
    if (isNaN(q)) q = 0;
    q = round2(q + direction * step);
    q = Math.max(Math.min(step, p.stock), Math.min(p.stock, q));
    $("sQty").value = q;
    updateSellCalc();
  }
  $("qMinus").addEventListener("click", function () { bumpQty(-1); });
  $("qPlus").addEventListener("click", function () { bumpQty(1); });
  $("sQty").addEventListener("input", updateSellCalc);
  $("sellCancel").addEventListener("click", closeSell);
  $("sellOverlay").addEventListener("click", function (e) { if (e.target === $("sellOverlay")) closeSell(); });

  $("sellConfirm").addEventListener("click", function () {
    var p = currentSellProduct();
    if (!p) return;
    var q = parseQty(p, $("sQty").value);
    if (isNaN(q) || q > p.stock) return;
    p.stock = round2(p.stock - q);
    sales.push({ id: uid(), productId: p.id, name: p.name, unit: p.unit || "piece", qty: q, price: p.price, cost: p.cost, ts: Date.now() });
    save(KEY_PRODUCTS, products);
    save(KEY_SALES, sales);
    closeSell();
    toast("✓ Sold " + fmtQty(q, p.unit) + " " + p.name + " — " + peso(p.price * q));
    renderSellList();
  });

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.display = "none"; }, 2500);
  }

  /* ---------- PIN lock ---------- */
  // A PIN keeps casual snoopers out (kids, helpers, someone borrowing the phone). It is not
  // encryption: the phone's own screen lock is the real protection.
  var PIN_LEN = 4;
  var IDLE_MS = 2 * 60 * 1000;
  var locked = false;
  var lastActive = Date.now();
  var pad = null;

  function pinSupported() { return !!(window.crypto && window.crypto.subtle); }
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
  function newSalt() { return b64(crypto.getRandomValues(new Uint8Array(16))); }
  function hashPin(pin, saltB64) {
    var salt = Uint8Array.from(atob(saltB64), function (c) { return c.charCodeAt(0); });
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt, iterations: 150000, hash: "SHA-256" }, key, 256);
      }).then(b64);
  }
  function checkPin(pin) {
    return hashPin(pin, settings.pin.salt).then(function (h) { return h === settings.pin.hash; });
  }

  // After 5 wrong tries the app makes you wait, longer each time (30s, 1 min, 2 min ... up to 10 min).
  function guardState() { return load(KEY_GUARD, { fails: 0, until: 0 }); }
  function lockoutLeft() { return Math.max(0, Math.ceil((guardState().until - Date.now()) / 1000)); }
  function recordFail() {
    var g = guardState();
    g.fails += 1;
    if (g.fails >= 5) g.until = Date.now() + Math.min(600, 30 * Math.pow(2, g.fails - 5)) * 1000;
    save(KEY_GUARD, g);
  }
  function clearFails() { save(KEY_GUARD, { fails: 0, until: 0 }); }
  function waitMsg(s) { return "Too many wrong tries. Wait " + (s >= 60 ? Math.ceil(s / 60) + " min" : s + " seconds") + "."; }

  // The number pad. o = { title, sub, cancellable, forgot, msg, onSubmit(pin) -> promise of undefined or {msg} }
  function openPad(o) {
    pad = { pin: "", o: o, busy: false };
    $("pinTitle").textContent = o.title;
    $("pinSub").textContent = o.sub || "";
    $("pinMsg").textContent = o.msg || "";
    $("pinCancel").hidden = !o.cancellable;
    $("pinForgot").hidden = !o.forgot;
    $("pinOverlay").hidden = false;
    drawDots();
  }
  function closePad() { $("pinOverlay").hidden = true; pad = null; }
  function drawDots() {
    var html = "";
    for (var i = 0; i < PIN_LEN; i++) html += "<span" + (pad && i < pad.pin.length ? ' class="on"' : "") + "></span>";
    $("pinDots").innerHTML = html;
  }
  function padKey(k) {
    if (!pad || pad.busy) return;
    if (k === "back") pad.pin = pad.pin.slice(0, -1);
    else if (pad.pin.length < PIN_LEN) pad.pin += k;
    $("pinMsg").textContent = "";
    drawDots();
    if (pad.pin.length === PIN_LEN) submitPad();
  }
  function submitPad() {
    var p = pad;
    p.busy = true;
    Promise.resolve(p.o.onSubmit(p.pin)).then(function (res) {
      if (pad !== p) return;                  // the handler moved on to another screen
      p.busy = false;
      if (res && res.msg) { p.pin = ""; drawDots(); $("pinMsg").textContent = res.msg; }
    });
  }

  $("keypad").innerHTML = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map(function (k) {
    if (k === "") return '<button class="blank" tabindex="-1" aria-hidden="true"></button>';
    return '<button data-k="' + k + '" aria-label="' + (k === "back" ? "Delete" : k) + '">' + (k === "back" ? "⌫" : k) + "</button>";
  }).join("");
  $("keypad").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-k]");
    if (b) padKey(b.dataset.k);
  });
  $("pinCancel").addEventListener("click", closePad);
  document.addEventListener("keydown", function (e) {
    if (!pad) return;
    if (/^[0-9]$/.test(e.key)) padKey(e.key);
    else if (e.key === "Backspace") padKey("back");
    else if (e.key === "Escape" && pad.o.cancellable) closePad();
  });

  function closeAllSheets() {
    ["overlay", "sellOverlay", "restockOverlay", "voidOverlay", "spoilOverlay"].forEach(function (id) {
      $(id).classList.remove("open");
    });
  }

  function showUnlock() {
    locked = true;
    closeAllSheets();
    $("view").innerHTML = "";
    var left = lockoutLeft();
    openPad({
      title: "Enter your PIN", sub: settings.storeName, forgot: true, msg: left > 0 ? waitMsg(left) : "",
      onSubmit: function (pin) {
        if (!pinSupported()) return { msg: "This browser cannot check PINs. Open the app from its normal web address." };
        var wait = lockoutLeft();
        if (wait > 0) return { msg: waitMsg(wait) };
        return checkPin(pin).then(function (ok) {
          if (ok) { clearFails(); locked = false; closePad(); lastActive = Date.now(); render(); return; }
          recordFail();
          var w2 = lockoutLeft();
          return { msg: w2 > 0 ? waitMsg(w2) : "Wrong PIN. Try again." };
        });
      }
    });
  }

  function startSetPin(done, msg) {
    openPad({
      title: "Choose a 4-digit PIN", sub: "You will need it each time the app opens.", cancellable: true, msg: msg,
      onSubmit: function (first) {
        openPad({
          title: "Type it again", sub: "To make sure it is right.", cancellable: true,
          onSubmit: function (second) {
            if (second !== first) { startSetPin(done, "They did not match. Start again."); return; }
            var salt = newSalt();
            return hashPin(first, salt).then(function (hash) {
              settings.pin = { salt: salt, hash: hash };
              save(KEY_SETTINGS, settings);
              $("lockBtn").hidden = false;
              clearFails();
              closePad();
              lastActive = Date.now();
              toast("🔒 PIN is on");
              if (done) done();
            });
          }
        });
      }
    });
  }

  function verifyCurrentPin(next) {
    openPad({
      title: "Enter your current PIN", cancellable: true,
      onSubmit: function (pin) {
        var wait = lockoutLeft();
        if (wait > 0) return { msg: waitMsg(wait) };
        return checkPin(pin).then(function (ok) {
          if (ok) { clearFails(); closePad(); next(); return; }
          recordFail();
          var w2 = lockoutLeft();
          return { msg: w2 > 0 ? waitMsg(w2) : "Wrong PIN. Try again." };
        });
      }
    });
  }

  function pinCardHtml() {
    var body;
    if (!pinSupported()) {
      body = "<p>PIN lock is not available in this browser.</p>";
    } else if (!settings.pin) {
      body = "<p>Ask for a 4-digit PIN when the app opens, and again after 2 minutes of not using it.</p>" +
        '<button class="btn" data-pin="set">Set a PIN</button>';
    } else {
      body = "<p>🔒 PIN is on. It is asked when the app opens and after 2 minutes of not using it.</p>" +
        '<div class="card-actions"><button class="btn small" data-pin="lock">Lock now</button>' +
        '<button class="btn small ghost" data-pin="change">Change PIN</button>' +
        '<button class="btn small ghost" data-pin="off">Turn off</button></div>';
    }
    return '<div class="card"><h2 class="alerts-title" style="margin-top:0">🔒 PIN lock</h2>' + body + "</div>";
  }

  function pinAction(what) {
    if (what === "set") startSetPin(renderSettings);
    else if (what === "lock") showUnlock();
    else if (what === "change") verifyCurrentPin(function () { startSetPin(renderSettings); });
    else if (what === "off") verifyCurrentPin(function () {
      delete settings.pin;
      save(KEY_SETTINGS, settings);
      clearFails();
      render();
      toast("PIN turned off");
    });
  }

  $("lockBtn").addEventListener("click", showUnlock);

  // Forgot the PIN: the only way in is to erase this device's data, then restore a backup file.
  $("pinForgot").addEventListener("click", function () {
    if (!confirm("Forgot your PIN?\n\nThe only way in is to erase everything stored on this device (products, sales, spoilage and the PIN). You can then restore a backup file.\n\nErase everything?")) return;
    if (!confirm("Last check: erase everything and remove the PIN?")) return;
    [KEY_PRODUCTS, KEY_SALES, KEY_LOSSES, KEY_SETTINGS, KEY_GUARD].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    });
    location.reload();
  });

  // Auto-lock: after 2 minutes with no touch, click or key, and when coming back to the app after that long.
  ["pointerdown", "keydown", "touchstart", "scroll"].forEach(function (ev) {
    document.addEventListener(ev, function () { if (!locked) lastActive = Date.now(); }, { capture: true, passive: true });
  });
  function lockIfIdle() {
    if (settings.pin && !locked && Date.now() - lastActive >= IDLE_MS) showUnlock();
  }
  setInterval(lockIfIdle, 5000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) lockIfIdle(); });

  /* ---------- Start ---------- */
  if (settings.pin) showUnlock();
  else render();

  // Installable + works offline (needs the https address; skipped when opened as a plain file).
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* the app still works without it */ });
    });
  }
  // Ask the browser not to clear this app's data when the phone is low on space.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* ignore */ });
})();
