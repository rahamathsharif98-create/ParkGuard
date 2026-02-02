// =========================
// ParkGuard — Guard Portal JS (FINAL MERGED)
// Frontend folder separated from backend
// Backend URL:
// =========================
const API_BASE = "http://localhost:5001";

// =========================
// Theme
// =========================
function setTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pg_theme", theme);
}
setTheme(localStorage.getItem("pg_theme") || "dark");
document.getElementById("btnTheme")?.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  setTheme(cur === "dark" ? "light" : "dark");
});

// Real-time channel (works across tabs)
const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("parkguard") : null;

// =========================
// Helpers
// =========================
const plateInput = document.getElementById("plate");

function normalizePlate(s){
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatPlate(s){
  const p = normalizePlate(s);
  return p.replace(/^([A-Z]{2})(\d{2})([A-Z]{1,2})(\d{1,4}).*$/, "$1 $2 $3 $4").trim();
}

plateInput?.addEventListener("input", () => {
  const raw = normalizePlate(plateInput.value);

  // format nicely (visual only)
  const pretty = raw.replace(
    /^([A-Z]{0,2})(\d{0,2})([A-Z]{0,2})(\d{0,4}).*/,
    (_, a, b, c, d) => [a, b, c, d].filter(Boolean).join(" ")
  );

  plateInput.value = pretty;
});

// Auto focus on plate for speed
setTimeout(() => plateInput?.focus(), 150);

// =========================
// Toast
// =========================
const toast = document.getElementById("toast");
const toastTitle = document.getElementById("toastTitle");
const toastSub = document.getElementById("toastSub");
let toastTimer = null;

function showToast(title, sub){
  if(!toast || !toastTitle || !toastSub) return;
  toastTitle.textContent = title;
  toastSub.textContent = sub;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// =========================
// Sound + vibration
// =========================
function beep(){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return;

    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);

    g.gain.value = 0.06;
    o.start();

    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 120);
  }catch{}
}

function vibrate(pattern = [80, 40, 80]){
  try{
    if("vibrate" in navigator) navigator.vibrate(pattern);
  }catch{}
}

// =========================
// Local storage (only used for theme + optional offline)
// =========================
const KEY_ALERTS = "pg_alerts";

// =========================
// Backend <-> UI mapping
// =========================
function mapFromBackend(a){
  // backend uses _id and ISO strings
  return {
    id: a._id || a.id,
    plate: a.plate,
    property: a.property,
    zone: a.zone,
    reason: a.reason,
    urgency: a.urgency || "Normal",
    note: a.note || "",
    status: a.status || "sent",
    createdAt: a.createdAt ? new Date(a.createdAt).getTime() : Date.now(),
    respondedAt: a.respondedAt ? new Date(a.respondedAt).getTime() : null,
    ownerResponse: a.ownerResponse || null
  };
}

function mapToBackend(a){
  // only send what backend expects
  return {
    plate: normalizePlate(a.plate),
    property: a.property,
    zone: a.zone,
    reason: a.reason,
    urgency: a.urgency,
    note: a.note || ""
  };
}

// =========================
// State
// =========================
let alerts = [];
let lastAlertCount = 0;

// =========================
// UI refs
// =========================
const alertsList = document.getElementById("alertsList");

// Search
const searchBox = document.getElementById("searchBox");
let searchText = "";
searchBox?.addEventListener("input", () => {
  searchText = searchBox.value.toUpperCase();
  render();
});

// Status filter
const statusFilter = document.getElementById("statusFilter");
let statusValue = "all";
statusFilter?.addEventListener("change", () => {
  statusValue = statusFilter.value;
  render();
});

// Last updated indicator
const lastUpdatedEl = document.getElementById("lastUpdated");
let lastUpdatedTime = Date.now();

function updateLastUpdated(){
  lastUpdatedTime = Date.now();
  if(lastUpdatedEl) lastUpdatedEl.textContent = "Updated just now";
}

// =========================
// Badges / effects
// =========================
function minsSince(ts){
  return Math.max(0, Math.round((Date.now() - ts)/60000));
}

// NEW badge for 60s
function isNewAlert(a){
  return (Date.now() - a.createdAt) <= 60 * 1000;
}

// Blink only High for 20s
function shouldBlink(a){
  return a.urgency === "High" && (Date.now() - a.createdAt) <= 20 * 1000;
}

// =========================
// KPI
// =========================
function computeKPIs(){
  const sentCount = alerts.length;
  const resolvedCount = alerts.filter(a => a.status === "resolved").length;
  const responded = alerts.filter(a => a.respondedAt && a.createdAt);
  const avg = responded.length
    ? Math.round(responded.reduce((sum,a)=> sum + ((a.respondedAt-a.createdAt)/60000), 0) / responded.length)
    : 0;

  document.getElementById("kpiSent").textContent = sentCount;
  document.getElementById("kpiResolved").textContent = resolvedCount;
  document.getElementById("kpiAvg").textContent = avg;
}

// =========================
// Chips / status UI
// =========================
function statusChip(status){
  if(status === "sent") return `<span class="chip chip-sent">Status: Sent</span>`;
  if(status === "viewed") return `<span class="chip chip-view">Status: Viewed</span>`;
  if(status === "responded") return `<span class="chip chip-respond">Status: Responded</span>`;
  if(status === "escalated") return `<span class="chip chip-escal">Status: Escalated</span>`;
  if(status === "resolved") return `<span class="chip chip-respond">Status: Resolved</span>`;
  return `<span class="chip">Status: ${status}</span>`;
}

// =========================
// Render
// =========================
function render(){
  computeKPIs();
  if(!alertsList) return;

  alertsList.innerHTML = alerts
    .filter(a => {
      const plateOk = !searchText || normalizePlate(a.plate).includes(searchText);
      const statusOk = (statusValue === "all") || (a.status === statusValue);
      return plateOk && statusOk;
    })
    .slice()
    .sort((a,b)=> b.createdAt - a.createdAt)
    .map(a => {
      const urgentClass = (a.urgency === "High") ? "urgent" : "";
      const blinkClass = shouldBlink(a) ? "blink" : "";
      const newBadge = isNewAlert(a)
        ? `<span class="badge-new"><span class="badge-dot"></span>NEW</span>`
        : ``;

      return `
        <div class="item ${urgentClass} ${blinkClass}">
          <div class="item-top">
            <div>
              <div class="plate">${formatPlate(a.plate)} ${newBadge}</div>
              <div class="meta">${a.property} • ${a.zone} • ${a.reason}</div>
              <div class="meta">Created ${minsSince(a.createdAt)} min ago • Urgency: ${a.urgency}</div>
              ${a.ownerResponse ? `<div class="meta">Owner response: <b>${a.ownerResponse}</b></div>` : ``}
            </div>
            <div>${statusChip(a.status)}</div>
          </div>

          ${a.note ? `<div class="meta" style="margin-top:8px;">Note: ${a.note}</div>` : ``}

          <div class="item-actions">
            <button class="btn small" data-action="markViewed" data-id="${a.id}">Mark Viewed</button>
            <button class="btn small" data-action="resolve" data-id="${a.id}">Resolve</button>
            <button class="btn small" data-action="escalate" data-id="${a.id}">Escalate</button>
          </div>

          <div class="chips">
            <span class="chip">Plate: ${formatPlate(a.plate)}</span>
            <span class="chip">Property: ${a.property}</span>
            <span class="chip ${a.urgency === "High" ? "chip-urgent" : ""}">
              Urgency: ${a.urgency}
            </span>
          </div>
        </div>
      `;
    })
    .join("");

  updateLastUpdated();
}

// =========================
// Backend API
// =========================
async function apiGetAlerts(){
  const res = await fetch(`${API_BASE}/api/alerts`);
  if(!res.ok) throw new Error("Failed to load alerts");
  return res.json();
}

async function apiCreateAlert(alertObj){
  const res = await fetch(`${API_BASE}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alertObj)
  });
  if(!res.ok) throw new Error("Failed to create alert");
  return res.json();
}

async function apiPatchAlert(id, patch){
  const res = await fetch(`${API_BASE}/api/alerts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if(!res.ok) throw new Error("Failed to update alert");
  return res.json();
}

// =========================
// Initial load
// =========================
async function initialLoad(){
  try{
    const data = await apiGetAlerts();
    alerts = Array.isArray(data) ? data.map(mapFromBackend) : [];
    lastAlertCount = alerts.length;

    // If DB empty, keep UI clean (no forced demo)
    render();
  }catch(err){
    console.log("Backend not reachable:", err?.message);
    showToast("Offline mode", "Backend not reachable. UI still works (no DB sync).");
    // optional offline fallback
    try{
      const local = JSON.parse(localStorage.getItem(KEY_ALERTS) || "[]");
      alerts = Array.isArray(local) ? local : [];
      lastAlertCount = alerts.length;
      render();
    }catch{}
  }
}

initialLoad();

// =========================
// Sync from other tab (local only)
// =========================
channel?.addEventListener("message", async (event) => {
  if(event.data?.type === "alerts_updated"){
    // We prefer backend as source of truth
    try{
      const data = await apiGetAlerts();
      alerts = Array.isArray(data) ? data.map(mapFromBackend) : [];
      lastAlertCount = alerts.length;
      render();
    }catch{}
  }
});

// =========================
// Confirm helper
// =========================
function confirmAction(text){
  return window.confirm(text);
}

// =========================
// Click actions (status updates -> DB)
// =========================
alertsList?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if(!btn) return;

  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  const alert = alerts.find(x => String(x.id) === String(id));
  if(!alert) return;

  try{
    if(action === "markViewed"){
      if(alert.status === "sent") alert.status = "viewed";
      await apiPatchAlert(alert.id, { status: alert.status });
      showToast("Viewed", "Marked as viewed.");
    }

    if(action === "resolve"){
      if(!confirmAction("Mark this alert as RESOLVED?")) return;
      alert.status = "resolved";
      await apiPatchAlert(alert.id, { status: alert.status });
      showToast("Resolved", "Alert marked as resolved.");
    }

    if(action === "escalate"){
      if(!confirmAction("Escalate this alert? (Use if driver not responding)")) return;
      alert.status = "escalated";
      await apiPatchAlert(alert.id, { status: alert.status });
      showToast("Escalated", "Escalation triggered (call/SMS tomorrow).");
      beep();
      vibrate([120, 60, 120]);
    }

    render();
  }catch(err){
    showToast("Server error", "Could not update. Check backend running.");
  }
});

// =========================
// Add sample alert (DB)
// =========================
document.getElementById("btnAddSample")?.addEventListener("click", async () => {
  const samples = [
    { plate: "KA01MM7788", property: "Skyline Towers", zone: "Visitor", reason: "Double Parking", urgency: "High" },
    { plate: "MH12CD2020", property: "City Mall Parking", zone: "No Parking", reason: "Wrong Area (No Parking)", urgency: "Normal" },
    { plate: "TN10XY9090", property: "Green Residency", zone: "Reserved", reason: "Blocking Exit / Gate", urgency: "High" }
  ];
  const pick = samples[Math.floor(Math.random() * samples.length)];

  const newAlertUI = {
    plate: normalizePlate(pick.plate),
    property: pick.property,
    zone: pick.zone,
    reason: pick.reason,
    urgency: pick.urgency,
    note: "Auto-sample generated for demo.",
  };

  try{
    const saved = await apiCreateAlert(newAlertUI);
    const mapped = mapFromBackend(saved);

    alerts.unshift(mapped);

    // Notifications for new incoming
    if(mapped.urgency === "High"){
      beep();
      vibrate([120, 60, 120]);
      showToast("High urgency ⚠️", `New alert: ${formatPlate(mapped.plate)}`);
    }else{
      vibrate([60]);
      showToast("New alert ✅", `Sent: ${formatPlate(mapped.plate)}`);
    }

    lastAlertCount = alerts.length;
    render();
  }catch{
    showToast("Server error", "Could not create sample. Check backend.");
  }
});

// =========================
// Demo fill
// =========================
document.getElementById("btnFillDemo")?.addEventListener("click", () => {
  if(plateInput) plateInput.value = "MH12CD2020";
  document.getElementById("property").value = "Green Residency";
  document.getElementById("zone").value = "Reserved";
  document.getElementById("reason").value = "Private / Reserved Slot";
  document.getElementById("urgency").value = "Normal";
  document.getElementById("note").value = "Please move within 5 minutes to avoid towing.";
  showToast("Demo filled", "Now click Send Alert.");
});

// Clear form
document.getElementById("btnClear")?.addEventListener("click", () => {
  document.getElementById("alertForm").reset();
  if(plateInput) plateInput.value = "";
  showToast("Cleared", "Form reset.");
});

// =========================
// Submit (create alert -> DB)
// =========================
document.getElementById("alertForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const plate = normalizePlate(document.getElementById("plate").value);
  const property = document.getElementById("property").value;
  const zone = document.getElementById("zone").value;
  const reason = document.getElementById("reason").value;
  const urgency = document.getElementById("urgency").value;
  const note = document.getElementById("note").value.trim();

  if(!plate || !property || !zone || !reason){
    showToast("Missing fields", "Please fill plate, property, zone and reason.");
    return;
  }

  const newAlertUI = {
    plate,
    property,
    zone,
    reason,
    urgency,
    note
  };

  try{
    const saved = await apiCreateAlert(mapToBackend(newAlertUI));
    const mapped = mapFromBackend(saved);

    alerts.unshift(mapped);

    // notifications
    if(mapped.urgency === "High"){
      beep();
      vibrate([120, 60, 120]);
      showToast("High urgency ⚠️", `New alert: ${formatPlate(mapped.plate)}`);
    }else{
      vibrate([60]);
      showToast("Alert sent ✅", `Sent: ${formatPlate(mapped.plate)}`);
    }

    e.target.reset();
    if(plateInput) plateInput.value = "";

    lastAlertCount = alerts.length;
    render();
  }catch(err){
    showToast("Server error", "Could not send alert. Is backend running?");
  }
});

// =========================
// Keyboard shortcuts
// =========================
document.addEventListener("keydown", (e) => {
  if(e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA"){
    e.preventDefault();
    searchBox?.focus();
  }
  if(e.key === "Escape"){
    if(searchBox && searchBox.value){
      searchBox.value = "";
      searchText = "";
      render();
      showToast("Search cleared", "Showing all alerts.");
    }
  }
});

// =========================
// Auto refresh UI and updated timer
// =========================
setInterval(render, 10000);

setInterval(() => {
  if(!lastUpdatedEl) return;
  const secs = Math.floor((Date.now() - lastUpdatedTime) / 1000);
  if(secs < 5) lastUpdatedEl.textContent = "Updated just now";
  else if(secs < 60) lastUpdatedEl.textContent = `Updated ${secs}s ago`;
  else lastUpdatedEl.textContent = `Updated ${Math.floor(secs/60)}m ago`;
}, 1000);
