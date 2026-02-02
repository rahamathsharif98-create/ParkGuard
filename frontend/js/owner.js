const API_BASE = "http://localhost:5001";

// Theme
function setTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pg_theme", theme);
}
setTheme(localStorage.getItem("pg_theme") || "dark");
document.getElementById("btnTheme")?.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  setTheme(cur === "dark" ? "light" : "dark");
});

// Toast
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

// Helpers
function normalizePlate(s){
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function formatPlate(s){
  const p = normalizePlate(s);
  return p.replace(/^([A-Z]{2})(\d{2})([A-Z]{1,2})(\d{1,4}).*$/, "$1 $2 $3 $4").trim();
}
function minsSince(ts){
  return Math.max(0, Math.round((Date.now() - ts)/60000));
}

function statusChip(status){
  if(status === "sent") return `<span class="chip chip-sent">Status: Sent</span>`;
  if(status === "viewed") return `<span class="chip chip-view">Status: Viewed</span>`;
  if(status === "responded") return `<span class="chip chip-respond">Status: Responded</span>`;
  if(status === "escalated") return `<span class="chip chip-escal">Status: Escalated</span>`;
  if(status === "resolved") return `<span class="chip chip-respond">Status: Resolved</span>`;
  return `<span class="chip">Status: ${status}</span>`;
}

// UI refs
const ownerPlate = document.getElementById("ownerPlate");
const btnFind = document.getElementById("btnFind");
const btnRefresh = document.getElementById("btnRefresh");
const btnPastePlate = document.getElementById("btnPastePlate");

const alertCard = document.getElementById("alertCard");
const emptyState = document.getElementById("emptyState");
const recentList = document.getElementById("recentList");

const cardPlate = document.getElementById("cardPlate");
const cardMeta1 = document.getElementById("cardMeta1");
const cardMeta2 = document.getElementById("cardMeta2");
const cardMeta3 = document.getElementById("cardMeta3");
const cardStatusChip = document.getElementById("cardStatusChip");
const cardNote = document.getElementById("cardNote");

const kpiFound = document.getElementById("kpiFound");
const kpiLatestMin = document.getElementById("kpiLatestMin");
const kpiStatus = document.getElementById("kpiStatus");

const lastUpdatedEl = document.getElementById("lastUpdated");
let lastUpdatedTime = Date.now();

function setUpdatedNow(msg="Updated just now"){
  lastUpdatedTime = Date.now();
  if(lastUpdatedEl) lastUpdatedEl.textContent = msg;
}

// format input nicely
ownerPlate?.addEventListener("input", () => {
  const raw = normalizePlate(ownerPlate.value);
  const pretty = raw.replace(
    /^([A-Z]{0,2})(\d{0,2})([A-Z]{0,2})(\d{0,4}).*/,
    (_, a, b, c, d) => [a, b, c, d].filter(Boolean).join(" ")
  );
  ownerPlate.value = pretty;
});

// paste plate
btnPastePlate?.addEventListener("click", async () => {
  try{
    const text = await navigator.clipboard.readText();
    if(text){
      ownerPlate.value = text;
      ownerPlate.dispatchEvent(new Event("input"));
      showToast("Pasted", "Plate number pasted.");
    }
  }catch{
    showToast("Not allowed", "Clipboard access blocked by browser.");
  }
});

// URL plate support: owner.html?plate=TN09AB1234
function plateFromURL(){
  const p = new URLSearchParams(location.search).get("plate");
  return p ? normalizePlate(p) : "";
}

// API
async function apiGetAlerts(){
  const res = await fetch(`${API_BASE}/api/alerts`);
  if(!res.ok) throw new Error("Failed to load alerts");
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

// State
let allAlerts = [];
let current = null;

// Render recent list
function renderRecent(list){
  if(!recentList) return;
  if(!list.length){
    recentList.innerHTML = `<div class="helper">No results.</div>`;
    return;
  }

  recentList.innerHTML = list
    .slice()
    .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map(a => {
      const createdTs = new Date(a.createdAt).getTime();
      return `
        <div class="item">
          <div class="item-top">
            <div>
              <div class="plate">${formatPlate(a.plate)}</div>
              <div class="meta">${a.property} • ${a.zone} • ${a.reason}</div>
              <div class="meta">Created ${minsSince(createdTs)} min ago • Urgency: ${a.urgency}</div>
              ${a.ownerResponse ? `<div class="meta">Your response: <b>${a.ownerResponse}</b></div>` : ``}
            </div>
            <div>${statusChip(a.status)}</div>
          </div>
          ${a.note ? `<div class="meta" style="margin-top:8px;">Note: ${a.note}</div>` : ``}
        </div>
      `;
    })
    .join("");
}

// Render main card
function showCard(alertObj){
  current = alertObj;

  if(!alertCard || !emptyState) return;

  if(!current){
    alertCard.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  const createdTs = new Date(current.createdAt).getTime();
  const updatedTs = new Date(current.updatedAt || current.createdAt).getTime();

  alertCard.style.display = "block";
  emptyState.style.display = "none";

  cardPlate.textContent = formatPlate(current.plate);
  cardMeta1.textContent = `${current.property} • ${current.zone} • ${current.reason}`;
  cardMeta2.textContent = `Created ${minsSince(createdTs)} min ago • Urgency: ${current.urgency}`;
  cardStatusChip.innerHTML = statusChip(current.status);

  // show last response if exists
  if(current.ownerResponse){
    cardMeta3.style.display = "block";
    cardMeta3.innerHTML = `Your last response: <b>${current.ownerResponse}</b>`;
  }else{
    cardMeta3.style.display = "none";
  }

  // note
  if(current.note){
    cardNote.style.display = "block";
    cardNote.textContent = `Note: ${current.note}`;
  }else{
    cardNote.style.display = "none";
  }

  setUpdatedNow(`Updated ${minsSince(updatedTs)} min ago`);
}

// Find alerts by plate
function findByPlate(plate){
  const p = normalizePlate(plate);
  const matches = allAlerts.filter(a => normalizePlate(a.plate) === p);

  // KPIs
  kpiFound.textContent = matches.length;

  if(matches.length){
    const latest = matches.slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))[0];
    const latestMin = minsSince(new Date(latest.createdAt).getTime());
    kpiLatestMin.textContent = String(latestMin);
    kpiStatus.textContent = latest.status;
    showCard(latest);
  }else{
    kpiLatestMin.textContent = "—";
    kpiStatus.textContent = "—";
    showCard(null);
  }

  renderRecent(matches);
}

// Load data
async function refreshData(showToastMsg=false){
  try{
    allAlerts = await apiGetAlerts();
    setUpdatedNow();
    if(showToastMsg) showToast("Refreshed", "Latest alerts loaded.");

    const plate = normalizePlate(ownerPlate.value);
    if(plate){
      findByPlate(plate);
    }else{
      renderRecent([]);
      showCard(null);
      kpiFound.textContent = "0";
      kpiLatestMin.textContent = "—";
      kpiStatus.textContent = "—";
    }
  }catch{
    showToast("Server offline", "Backend not reachable. Keep backend running.");
  }
}

// Buttons
btnFind?.addEventListener("click", async () => {
  await refreshData(false);
  const plate = normalizePlate(ownerPlate.value);
  if(!plate){
    showToast("Enter plate", "Please type your vehicle number.");
    return;
  }
  findByPlate(plate);
});

btnRefresh?.addEventListener("click", async () => {
  await refreshData(true);
});

// Quick response buttons
alertCard?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-response]");
  if(!btn || !current) return;

  const msg = btn.getAttribute("data-response");
  document.getElementById("customResponse").value = msg;
  showToast("Selected", "Now tap Send Response.");
});

// Send response
document.getElementById("btnSendResponse")?.addEventListener("click", async () => {
  if(!current){
    showToast("No alert", "Find an alert first.");
    return;
  }

  const custom = document.getElementById("customResponse").value.trim();
  if(!custom){
    showToast("Type message", "Choose a quick response or type one.");
    return;
  }

  try{
    await apiPatchAlert(current._id || current.id, {
      status: "responded",
      ownerResponse: custom,
      respondedAt: new Date().toISOString()
    });

    showToast("Sent ✅", "Your response was delivered to the guard.");
    await refreshData(false);

    // re-find
    findByPlate(normalizePlate(ownerPlate.value));
  }catch{
    showToast("Error", "Could not send response. Check backend.");
  }
});

// Clear message
document.getElementById("btnClearMsg")?.addEventListener("click", () => {
  document.getElementById("customResponse").value = "";
  showToast("Cleared", "Message cleared.");
});

// Auto tick updated text
setInterval(() => {
  if(!lastUpdatedEl) return;
  const secs = Math.floor((Date.now() - lastUpdatedTime) / 1000);
  if(secs < 5) lastUpdatedEl.textContent = "Updated just now";
  else if(secs < 60) lastUpdatedEl.textContent = `Updated ${secs}s ago`;
  else lastUpdatedEl.textContent = `Updated ${Math.floor(secs/60)}m ago`;
}, 1000);

// Startup
(async function start(){
  const p = plateFromURL();
  if(p && ownerPlate){
    ownerPlate.value = p;
    ownerPlate.dispatchEvent(new Event("input"));
  }
  await refreshData(false);
  if(p) findByPlate(p);
})();
