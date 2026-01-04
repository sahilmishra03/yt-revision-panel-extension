// ================= UTIL =================
function getParam(name) {
  try {
    return new URL(location.href).searchParams.get(name);
  } catch {
    return null;
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ================= MARK BUTTON =================
function injectMarkButtonSafe() {
  // sirf watch page + playlist video
  if (!location.pathname.includes("/watch")) return;
  if (!getParam("list")) return;

  // already exists
  if (document.getElementById("yt-revision-mark-btn")) return;

  // wait for video element
  const video = document.querySelector("video");
  if (!video) return;

  const btn = document.createElement("button");
  btn.id = "yt-revision-mark-btn";
  btn.innerText = "💡 Mark";

  Object.assign(btn.style, {
    position: "fixed",
    bottom: "120px",
    right: "24px",
    zIndex: 9999,
    padding: "10px 14px",
    background: "#181818",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
  });

  btn.onclick = () => {
    const videoId = getParam("v");
    const playlistId = getParam("list");
    const time = Math.floor(video.currentTime);
    const title =
      document.querySelector("h1 yt-formatted-string")?.innerText ||
      document.title.replace("- YouTube", "").trim();

    chrome.storage.local.get(["marked"], (res) => {
      const list = res.marked || [];
      if (list.some(v => v.videoId === videoId)) {
        alert("Already marked");
        return;
      }

      list.push({
        videoId,
        playlistId,
        title,
        time,
        url: location.href.split("&t=")[0],
        savedAt: Date.now()
      });

      chrome.storage.local.set({ marked: list }, () => {
        alert(`Marked at ${formatTime(time)}`);
      });
    });
  };

  document.body.appendChild(btn);
}

// ================= REVISION PANEL (PLAYLIST ONLY) =================
function injectRevisionPanel() {
  if (!location.pathname.includes("/playlist")) return;
  if (document.getElementById("yt-revision-panel")) return;

  const playlistId = getParam("list");
  if (!playlistId) return;

  const panel = document.createElement("div");
  panel.id = "yt-revision-panel";

  Object.assign(panel.style, {
    position: "fixed",
    top: "100px",
    right: "16px",
    width: "320px",
    maxHeight: "70vh",
    background: "rgba(20,20,20,0.95)",
    backdropFilter: "blur(10px)",
    color: "#fff",
    borderRadius: "14px",
    padding: "14px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column"
  });

  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="font-size:18px">💡</span>
      <span style="font-size:15px;font-weight:600">Revision Panel</span>
      <span id="rev-count" style="
        margin-left:auto;
        background:#ffcc00;
        color:#000;
        font-size:12px;
        padding:2px 8px;
        border-radius:999px;
        font-weight:600;
      ">0</span>
    </div>
    <div id="rev-list" style="overflow-y:auto;font-size:13px;"></div>
  `;

  document.body.appendChild(panel);
  refreshRevisionPanel();
}

function refreshRevisionPanel() {
  const panel = document.getElementById("yt-revision-panel");
  if (!panel) return;

  const playlistId = getParam("list");
  const listDiv = panel.querySelector("#rev-list");
  const countDiv = panel.querySelector("#rev-count");

  chrome.storage.local.get(["marked"], (res) => {
    const list = (res.marked || []).filter(v => v.playlistId === playlistId);

    listDiv.innerHTML = "";
    countDiv.innerText = list.length;

    if (list.length === 0) {
      listDiv.innerHTML = `<div style="opacity:0.6;padding:8px;">No marked videos</div>`;
      return;
    }

    list
      .sort((a, b) => b.savedAt - a.savedAt)
      .forEach(v => {
        const item = document.createElement("div");
        item.style.padding = "8px 10px";
        item.style.marginBottom = "8px";
        item.style.borderRadius = "10px";
        item.style.cursor = "pointer";
        item.style.background = "rgba(255,255,255,0.05)";

        item.innerHTML = `
          <div style="display:flex;gap:6px;">
            <span>💡</span>
            <div>
              <div>${v.title}</div>
              <div style="font-size:11px;opacity:0.7">⏱ ${formatTime(v.time)}</div>
            </div>
          </div>
        `;

        item.onclick = () => {
          window.open(`${v.url}&t=${v.time}s`, "_blank");
        };

        listDiv.appendChild(item);
      });
  });
}

// ================= ROUTE HANDLING =================
function onRouteChange() {
  document.getElementById("yt-revision-mark-btn")?.remove();
  document.getElementById("yt-revision-panel")?.remove();

  let tries = 0;
  const interval = setInterval(() => {
    injectMarkButtonSafe();
    injectRevisionPanel();
    if (++tries > 10) clearInterval(interval);
  }, 500);
}

// initial
onRouteChange();

// YouTube SPA navigation
document.addEventListener("yt-navigate-finish", onRouteChange);
