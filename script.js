/* ============================================================
   CloudShare — script.js
   ============================================================ */

const STORAGE_KEY = "shared-files-v1";

/* ---- State ---- */
let currentUser = "";
let allFiles    = [];
let deleteTarget = null;
let refreshTimer = null;

/* ---- DOM Refs ---- */
const $ = (id) => document.getElementById(id);

const loginScreen     = $("login-screen");
const loginInput      = $("login-input");
const loginBtn        = $("login-btn");

const app             = $("app");
const userAvatar      = $("user-avatar");
const userNameDisplay = $("user-name-display");
const logoutBtn       = $("logout-btn");

const statTotal       = $("stat-total");
const statSize        = $("stat-size");
const statUsers       = $("stat-users");

const dropZone        = $("drop-zone");
const fileInput       = $("file-input");
const uploadIdle      = $("upload-idle");
const uploadProgress  = $("upload-progress");
const uploadLabel     = $("upload-label");
const progressBar     = $("progress-bar");

const searchInput     = $("search-input");
const searchClear     = $("search-clear");
const fileList        = $("file-list");
const emptyState      = $("empty-state");

const previewModal    = $("preview-modal");
const previewFilename = $("preview-filename");
const previewContent  = $("preview-content");
const previewClose    = $("preview-close");

const deleteModal     = $("delete-modal");
const deleteFilename  = $("delete-filename");
const deleteCancel    = $("delete-cancel");
const deleteConfirm   = $("delete-confirm");

const toast           = $("toast");

/* ============================================================
   HELPERS
   ============================================================ */

function formatSize(bytes) {
  if (bytes < 1024)           return bytes + " B";
  if (bytes < 1024 * 1024)    return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getFileIcon(type) {
  if (type.startsWith("image/"))   return "🖼️";
  if (type.startsWith("video/"))   return "🎬";
  if (type.startsWith("audio/"))   return "🎵";
  if (type.includes("pdf"))        return "📄";
  if (type.includes("zip") || type.includes("rar")) return "🗜️";
  if (type.includes("text"))       return "📝";
  if (type.includes("spreadsheet") || type.includes("excel")) return "📊";
  if (type.includes("word") || type.includes("document"))     return "📃";
  return "📁";
}

function showToast(msg, type = "success") {
  toast.textContent = (type === "error" ? "🗑️ " : "✅ ") + msg;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

/* ============================================================
   STORAGE HELPERS
   ============================================================ */

async function loadFiles() {
  try {
    const result = await window.storage.get(STORAGE_KEY, true);
    allFiles = result ? JSON.parse(result.value) : [];
  } catch {
    allFiles = [];
  }
  renderFiles();
  updateStats();
}

async function saveFiles(updatedFiles) {
  await window.storage.set(STORAGE_KEY, JSON.stringify(updatedFiles), true);
  allFiles = updatedFiles;
  renderFiles();
  updateStats();
}

/* ============================================================
   STATS
   ============================================================ */

function updateStats() {
  statTotal.textContent = allFiles.length;
  statSize.textContent  = formatSize(allFiles.reduce((a, f) => a + f.size, 0));
  statUsers.textContent = new Set(allFiles.map((f) => f.uploadedBy)).size;
}

/* ============================================================
   RENDER FILE LIST
   ============================================================ */

function renderFiles() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = query
    ? allFiles.filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          f.uploadedBy.toLowerCase().includes(query)
      )
    : allFiles;

  fileList.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    const isEmpty = allFiles.length === 0;
    emptyState.querySelector(".empty-title").textContent = isEmpty
      ? "Belum ada file"
      : "Tidak ada hasil";
    emptyState.querySelector(".empty-sub").textContent = isEmpty
      ? "Upload file pertamamu!"
      : "Coba kata kunci lain";
    return;
  }

  emptyState.classList.add("hidden");

  filtered.forEach((file) => {
    const card = document.createElement("div");
    card.className = "file-card";

    /* Thumbnail */
    const thumb = document.createElement("div");
    thumb.className = "file-thumb";
    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = file.dataUrl;
      img.alt = file.name;
      thumb.appendChild(img);
    } else {
      thumb.textContent = getFileIcon(file.type);
    }

    /* Info */
    const info = document.createElement("div");
    info.className = "file-info";
    info.innerHTML = `
      <div class="file-name">${escapeHtml(file.name)}</div>
      <div class="file-meta">
        <span class="uploader">${escapeHtml(file.uploadedBy)}</span>
        &nbsp;·&nbsp;${formatSize(file.size)}&nbsp;·&nbsp;${formatDate(file.uploadedAt)}
      </div>
    `;

    /* Actions */
    const actions = document.createElement("div");
    actions.className = "file-actions";

    const canPreview =
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type.startsWith("audio/");

    if (canPreview) {
      const previewBtn = document.createElement("button");
      previewBtn.className = "action-btn";
      previewBtn.title = "Preview";
      previewBtn.textContent = "👁️";
      previewBtn.addEventListener("click", () => openPreview(file));
      actions.appendChild(previewBtn);
    }

    const dlBtn = document.createElement("button");
    dlBtn.className = "action-btn teal";
    dlBtn.title = "Download";
    dlBtn.textContent = "⬇️";
    dlBtn.addEventListener("click", () => downloadFile(file));
    actions.appendChild(dlBtn);

    if (file.uploadedBy === currentUser) {
      const delBtn = document.createElement("button");
      delBtn.className = "action-btn danger";
      delBtn.title = "Hapus";
      delBtn.textContent = "🗑️";
      delBtn.addEventListener("click", () => openDeleteModal(file));
      actions.appendChild(delBtn);
    }

    card.appendChild(thumb);
    card.appendChild(info);
    card.appendChild(actions);
    fileList.appendChild(card);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ============================================================
   UPLOAD
   ============================================================ */

async function handleUpload(files) {
  if (!files || files.length === 0) return;
  const fileArr = Array.from(files);

  setUploading(true);

  for (let i = 0; i < fileArr.length; i++) {
    const file = fileArr[i];

    const dataUrl = await readAsDataURL(file);

    /* Re-fetch latest list before appending */
    let latest = [];
    try {
      const r = await window.storage.get(STORAGE_KEY, true);
      latest = r ? JSON.parse(r.value) : [];
    } catch { latest = []; }

    const entry = {
      id:         Date.now() + i,
      name:       file.name,
      size:       file.size,
      type:       file.type || "application/octet-stream",
      uploadedBy: currentUser,
      uploadedAt: new Date().toISOString(),
      dataUrl,
    };

    latest = [entry, ...latest];
    await window.storage.set(STORAGE_KEY, JSON.stringify(latest), true);
    allFiles = latest;

    const pct = Math.round(((i + 1) / fileArr.length) * 100);
    uploadLabel.textContent = `Mengupload... ${pct}%`;
    progressBar.style.width = pct + "%";
  }

  setUploading(false);
  renderFiles();
  updateStats();
  showToast(`${fileArr.length} file berhasil diupload!`);
  fileInput.value = "";
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

function setUploading(state) {
  if (state) {
    uploadIdle.classList.add("hidden");
    uploadProgress.classList.remove("hidden");
    dropZone.style.cursor = "default";
  } else {
    uploadIdle.classList.remove("hidden");
    uploadProgress.classList.add("hidden");
    uploadLabel.textContent = "Mengupload... 0%";
    progressBar.style.width = "0%";
    dropZone.style.cursor = "pointer";
  }
}

/* ============================================================
   DOWNLOAD
   ============================================================ */

function downloadFile(file) {
  const a = document.createElement("a");
  a.href     = file.dataUrl;
  a.download = file.name;
  a.click();
  showToast(`Mengunduh ${file.name}...`);
}

/* ============================================================
   PREVIEW MODAL
   ============================================================ */

function openPreview(file) {
  previewFilename.textContent = file.name;
  previewContent.innerHTML = "";

  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = file.dataUrl;
    img.alt = file.name;
    previewContent.appendChild(img);
  } else if (file.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = file.dataUrl;
    video.controls = true;
    previewContent.appendChild(video);
  } else if (file.type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.src = file.dataUrl;
    audio.controls = true;
    previewContent.appendChild(audio);
  } else {
    const p = document.createElement("p");
    p.className = "preview-no-support";
    p.textContent = "Preview tidak tersedia untuk tipe file ini.";
    previewContent.appendChild(p);
  }

  previewModal.classList.remove("hidden");
}

function closePreview() {
  previewModal.classList.add("hidden");
  previewContent.innerHTML = "";
}

/* ============================================================
   DELETE MODAL
   ============================================================ */

function openDeleteModal(file) {
  deleteTarget = file;
  deleteFilename.textContent = `"${file.name}"`;
  deleteModal.classList.remove("hidden");
}

async function confirmDelete() {
  if (!deleteTarget) return;
  const updated = allFiles.filter((f) => f.id !== deleteTarget.id);
  await saveFiles(updated);
  deleteTarget = null;
  deleteModal.classList.add("hidden");
  showToast("File dihapus.", "error");
}

/* ============================================================
   LOGIN / LOGOUT
   ============================================================ */

function login() {
  const name = loginInput.value.trim();
  if (!name) return;
  currentUser = name;

  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");

  userAvatar.textContent     = name[0].toUpperCase();
  userNameDisplay.textContent = name;

  loadFiles();
  refreshTimer = setInterval(loadFiles, 4000);
}

function logout() {
  clearInterval(refreshTimer);
  currentUser = "";
  allFiles    = [];

  app.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginInput.value = "";
  loginBtn.disabled = true;
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

/* Login */
loginInput.addEventListener("input", () => {
  loginBtn.disabled = !loginInput.value.trim();
});
loginInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);

/* Upload zone */
dropZone.addEventListener("click", () => {
  if (!uploadProgress.classList.contains("hidden")) return; // uploading
  fileInput.click();
});
fileInput.addEventListener("change", () => handleUpload(fileInput.files));

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-active");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-active");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-active");
  handleUpload(e.dataTransfer.files);
});

/* Search */
searchInput.addEventListener("input", () => {
  const hasVal = searchInput.value.trim().length > 0;
  searchClear.classList.toggle("hidden", !hasVal);
  renderFiles();
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.add("hidden");
  renderFiles();
});

/* Preview modal */
previewClose.addEventListener("click", closePreview);
previewModal.addEventListener("click", (e) => {
  if (e.target === previewModal) closePreview();
});

/* Delete modal */
deleteCancel.addEventListener("click", () => {
  deleteTarget = null;
  deleteModal.classList.add("hidden");
});
deleteConfirm.addEventListener("click", confirmDelete);
deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) {
    deleteTarget = null;
    deleteModal.classList.add("hidden");
  }
});
