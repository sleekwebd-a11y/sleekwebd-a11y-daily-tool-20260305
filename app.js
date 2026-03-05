const $ = (id) => document.getElementById(id);

const state = {
  people: ["You"],
  items: [
    { name: "Example item", price: 4.50, who: "You" }
  ],
  rawOcr: ""
};

function normalizePrice(s) {
  const cleaned = (s || "").replace(/[^\d,.\-]/g, "").replace(",", ".");
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? v : 0;
}

function parseReceiptTextToItems(text) {
  const lines = (text || "")
    .split(/\r?\n+/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/\s+/g, " "));

  const stopWords = ["total", "subtotal", "tax", "vat", "change", "cash", "card", "visa", "mastercard", "sum"];
  const priceRegex = /(-?\d{1,4}(?:[.,]\d{2}))/g;

  const items = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (stopWords.some(w => lower.includes(w))) continue;

    const matches = [...line.matchAll(priceRegex)];
    if (!matches.length) continue;

    const last = matches[matches.length - 1][1];
    const price = normalizePrice(last);
    if (!(price > 0 && price < 2000)) continue;

    // Item name = line minus the last matched price token
    const idx = line.lastIndexOf(last);
    let name = (idx >= 0 ? line.slice(0, idx) : line).trim();
    name = name.replace(/[-–—:]+$/, "").trim();
    if (name.length < 2) continue;

    items.push({ name, price, who: state.people[0] || "You" });
  }

  // De-dupe very similar repeats (basic)
  const seen = new Set();
  return items.filter(it => {
    const key = (it.name.toLowerCase().replace(/\W+/g, "") + "|" + it.price.toFixed(2));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 50);
}

function renderPeople() {
  const wrap = $("peopleChips");
  wrap.innerHTML = "";
  state.people.forEach(p => {
    const el = document.createElement("div");
    el.className = "chip";
    el.textContent = p;
    wrap.appendChild(el);
  });
}

function renderItems() {
  const body = $("itemsBody");
  body.innerHTML = "";

  state.items.forEach((it, i) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.value = it.name;
    nameInput.addEventListener("input", () => { it.name = nameInput.value; sync(); });
    tdName.appendChild(nameInput);

    const tdPrice = document.createElement("td");
    const priceInput = document.createElement("input");
    priceInput.inputMode = "decimal";
    priceInput.value = String(it.price ?? "");
    priceInput.addEventListener("input", () => { it.price = normalizePrice(priceInput.value); syncTotalsOnly(); });
    tdPrice.appendChild(priceInput);

    const tdWho = document.createElement("td");
    const sel = document.createElement("select");
    state.people.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      sel.appendChild(opt);
    });
    sel.value = it.who;
    sel.addEventListener("change", () => { it.who = sel.value; syncTotalsOnly(); });
    tdWho.appendChild(sel);

    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "iconBtn";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", () => {
      state.items.splice(i, 1);
      sync();
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdPrice);
    tr.appendChild(tdWho);
    tr.appendChild(tdDel);
    body.appendChild(tr);
  });
}

function computeTotals() {
  const per = Object.fromEntries(state.people.map(p => [p, 0]));
  for (const it of state.items) {
    const who = it.who || state.people[0];
    if (!(who in per)) per[who] = 0;
    per[who] += Number(it.price || 0);
  }
  return per;
}

function renderTotals() {
  const per = computeTotals();
  const wrap = $("totals");
  wrap.innerHTML = "";

  const sumAll = Object.values(per).reduce((a,b) => a+b, 0);
  const totalRow = document.createElement("div");
  totalRow.className = "totalRow";
  totalRow.innerHTML = `<div>Total</div><div>${sumAll.toFixed(2)}</div>`;
  wrap.appendChild(totalRow);

  for (const [p, v] of Object.entries(per)) {
    const row = document.createElement("div");
    row.className = "totalRow";
    row.innerHTML = `<div>${escapeHtml(p)}</div><div>${v.toFixed(2)}</div>`;
    wrap.appendChild(row);
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function encodeStateToHash() {
  const payload = {
    people: state.people,
    items: state.items
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return "#s=" + encodeURIComponent(b64);
}

function decodeStateFromHash() {
  const m = (location.hash || "").match(/#s=([^&]+)/);
  if (!m) return false;
  try {
    const b64 = decodeURIComponent(m[1]);
    const json = decodeURIComponent(escape(atob(b64)));
    const payload = JSON.parse(json);
    if (Array.isArray(payload.people) && Array.isArray(payload.items)) {
      state.people = payload.people.length ? payload.people : ["You"];
      state.items = payload.items.map(it => ({
        name: String(it.name || "Item"),
        price: Number(it.price || 0),
        who: String(it.who || state.people[0])
      }));
      return true;
    }
  } catch {}
  return false;
}

function syncTotalsOnly() {
  renderTotals();
  // keep hash updated, so share link stays current
  history.replaceState(null, "", encodeStateToHash());
}

function sync() {
  renderPeople();
  renderItems();
  renderTotals();
  history.replaceState(null, "", encodeStateToHash());
}

async function doOCR(file) {
  const progress = $("progress");
  progress.textContent = "Loading OCR…";

  // createWorker pattern from Tesseract.js examples
  const worker = Tesseract.createWorker({
    logger: (m) => {
      if (m.status) {
        const pct = m.progress != null ? ` ${(m.progress * 100).toFixed(0)}%` : "";
        progress.textContent = `${m.status}${pct}`;
      }
    }
  });

  await worker.load();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();

  progress.textContent = "Done.";
  return text;
}

$("applyPeopleBtn").addEventListener("click", () => {
  const raw = $("peopleInput").value.trim();
  const names = raw
    ? raw.split(",").map(s => s.trim()).filter(Boolean)
    : ["You"];
  state.people = [...new Set(names)].slice(0, 12);
  // re-map assignments if needed
  state.items.forEach(it => {
    if (!state.people.includes(it.who)) it.who = state.people[0];
  });
  sync();
});

$("addItemBtn").addEventListener("click", () => {
  state.items.push({ name: "New item", price: 0, who: state.people[0] });
  sync();
});

$("toggleRawBtn").addEventListener("click", () => {
  $("rawOcr").classList.toggle("hidden");
});

$("scanBtn").addEventListener("click", async () => {
  const file = $("photoInput").files?.[0];
  if (!file) { alert("Choose a receipt photo first."); return; }

  try {
    const text = await doOCR(file);
    state.rawOcr = text;
    $("rawOcr").textContent = text;

    const parsed = parseReceiptTextToItems(text);
    if (parsed.length) {
      // Keep existing people; replace items with parsed
      state.items = parsed.map(it => ({ ...it, who: state.people[0] }));
    } else {
      alert("OCR ran, but I couldn’t confidently parse items. Use manual add/edit.");
    }
    sync();
  } catch (e) {
    console.error(e);
    alert("OCR failed in this browser/device. Try a clearer photo or manual entry.");
  }
});

$("shareBtn").addEventListener("click", async () => {
  const url = location.origin + location.pathname + encodeStateToHash();
  try {
    await navigator.clipboard.writeText(url);
    alert("Share link copied.");
  } catch {
    prompt("Copy this link:", url);
  }
});

$("clearBtn").addEventListener("click", () => {
  if (!confirm("Clear all items/people?")) return;
  state.people = ["You"];
  state.items = [{ name: "Example item", price: 4.50, who: "You" }];
  $("peopleInput").value = "";
  $("rawOcr").textContent = "";
  $("progress").textContent = "";
  sync();
});

// Load from shared link (hash) if present
decodeStateFromHash();
sync();
