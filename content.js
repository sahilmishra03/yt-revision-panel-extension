// ================= UTILS =================
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

// ================= STATE =================
let panelMinimized = false;

// ================= MARK BUTTON =================
function injectMarkButton() {
  if (!location.pathname.includes("/watch")) return;
  if (!getParam("list")) return;

  if (document.getElementById("yt-revision-mark-btn")) return;
  const video = document.querySelector("video");
  if (!video) return;

  const btn = document.createElement("button");
  btn.id = "yt-revision-mark-btn";
  btn.innerText = "💡 Mark";

  Object.assign(btn.style, {
    position: "fixed",
    bottom: "160px",
    right: "28px",
    zIndex: 9999,
    padding: "14px 20px",
    background: "#121212",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "28px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(0,0,0,0.5)"
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
        refreshRevisionPanel();
      });
    });
  };

  document.body.appendChild(btn);
}

// ================= REVISION PANEL =================
function injectRevisionPanel() {
  if (!getParam("list")) return;
  if (document.getElementById("yt-revision-panel")) return;

  const panel = document.createElement("div");
  panel.id = "yt-revision-panel";

  Object.assign(panel.style, {
    position: "fixed",
    top: "120px",
    right: "20px",
    width: "340px",
    maxHeight: "70vh",
    background: "rgba(18,18,18,0.96)",
    backdropFilter: "blur(10px)",
    color: "#fff",
    borderRadius: "16px",
    padding: "14px",
    zIndex: 9999,
    boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column"
  });

  panel.innerHTML = `
    <div id="rev-header" style="
      display:flex;
      align-items:center;
      gap:8px;
      cursor:move;
      user-select:none;
    ">
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
      <span id="rev-minimize" style="
        margin-left:8px;
        cursor:pointer;
        font-size:18px;
        line-height:1;
      ">—</span>
    </div>

    <div id="rev-body" style="
      margin-top:10px;
      overflow-y:auto;
      font-size:13px;
      padding-right:4px;
    "></div>
  `;

  document.body.appendChild(panel);
  makeDraggable(panel);
  setupMinimize(panel);
  refreshRevisionPanel();
}

// ================= PANEL CONTENT =================
function refreshRevisionPanel() {
  const panel = document.getElementById("yt-revision-panel");
  if (!panel) return;

  const playlistId = getParam("list");
  const listDiv = panel.querySelector("#rev-body");
  const countDiv = panel.querySelector("#rev-count");

  chrome.storage.local.get(["marked"], (res) => {
    const list = (res.marked || []).filter(
      v => v.playlistId === playlistId
    );

    listDiv.innerHTML = "";
    countDiv.innerText = list.length;

    if (list.length === 0) {
      listDiv.innerHTML = `<div style="opacity:0.6;padding:10px;">
        No marked videos
      </div>`;
      return;
    }

    list.sort((a, b) => b.savedAt - a.savedAt).forEach(v => {
      const item = document.createElement("div");
      Object.assign(item.style, {
        padding: "10px",
        marginBottom: "8px",
        borderRadius: "10px",
        background: "rgba(255,255,255,0.05)",
        cursor: "pointer"
      });

      item.innerHTML = `
        <div style="display:flex;gap:8px;">
          <span>💡</span>
          <div style="flex:1">
            <div>${v.title}</div>
            <div style="font-size:11px;opacity:0.7">
              ⏱ ${formatTime(v.time)}
            </div>
          </div>
          <span class="unmark" style="
            cursor:pointer;
            color:#ff6b6b;
            font-weight:bold;
          ">✕</span>
        </div>
      `;

      item.querySelector(".unmark").onclick = (e) => {
        e.stopPropagation();
        chrome.storage.local.get(["marked"], (res2) => {
          const updated = (res2.marked || []).filter(
            x => x.videoId !== v.videoId
          );
          chrome.storage.local.set({ marked: updated }, refreshRevisionPanel);
        });
      };

      item.onclick = () => {
        window.open(`${v.url}&t=${v.time}s`, "_blank");
      };

      listDiv.appendChild(item);
    });
  });
}

// ================= MINIMIZE =================
function setupMinimize(panel) {
  const btn = panel.querySelector("#rev-minimize");
  const body = panel.querySelector("#rev-body");

  btn.onclick = () => {
    panelMinimized = !panelMinimized;
    body.style.display = panelMinimized ? "none" : "block";
    btn.innerText = panelMinimized ? "+" : "—";
  };
}

// ================= DRAG =================
function makeDraggable(panel) {
  const header = panel.querySelector("#rev-header");
  let isDown = false, x, y;

  header.onmousedown = (e) => {
    isDown = true;
    x = e.clientX - panel.offsetLeft;
    y = e.clientY - panel.offsetTop;
  };

  document.onmousemove = (e) => {
    if (!isDown) return;
    panel.style.left = e.clientX - x + "px";
    panel.style.top = e.clientY - y + "px";
    panel.style.right = "auto";
  };

  document.onmouseup = () => {
    isDown = false;
  };
}

// ================= ROUTE HANDLING =================
function handleRouteChange() {
  document.getElementById("yt-revision-mark-btn")?.remove();
  document.getElementById("yt-revision-panel")?.remove();

  let tries = 0;
  const interval = setInterval(() => {
    injectMarkButton();
    injectRevisionPanel();
    if (++tries > 12) clearInterval(interval);
  }, 500);
}

// init
handleRouteChange();
document.addEventListener("yt-navigate-finish", handleRouteChange);
