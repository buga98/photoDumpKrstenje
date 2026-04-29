import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
  limit
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "photodumpkrstenje.firebaseapp.com",
  projectId: "photodumpkrstenje",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= SETTINGS ================= */
const IMAGE_LIMIT = 80;
const DEDICATION_LIMIT = 80;

/* ================= STATE ================= */
let currentFilter = "all";

let selectedPhotoId = null;
let selectedWrapper = null;
let selectedVisible = true;

let allImages = [];
let slideshowImages = [];

let slideshowInterval = null;
let overlay = null;

let showAuthor = true;
let showDedications = false;

/* ================= HELPERS ================= */
function buildImageList(snapshot) {
  allImages = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    allImages.push({
      id: docSnap.id,
      url: data.imageUrl,
      user: data.user || "Gost",
      visible: data.visible !== false
    });
  });
}

/* ================= FILTER ================= */
window.filterPhotos = function (type) {
  currentFilter = type;

  document.querySelectorAll(".admin-filters button").forEach((btn) => {
    btn.classList.remove("active");
  });

  const map = { all: 0, visible: 1, hidden: 2 };
  const buttons = document.querySelectorAll(".admin-filters button");
  buttons[map[type]]?.classList.add("active");

  loadAllImages();
};

/* ================= GALLERY ================= */
async function loadAllImages() {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  gallery.innerHTML = "Učitavanje...";

  const snapshot = await getDocs(
    query(
      collection(db, "photos"),
      orderBy("created", "desc"),
      limit(IMAGE_LIMIT)
    )
  );

  gallery.innerHTML = "";
  buildImageList(snapshot);

  let count = 0;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (currentFilter === "visible" && data.visible === false) return;
    if (currentFilter === "hidden" && data.visible !== false) return;

    count++;

    const wrapper = document.createElement("div");
    wrapper.className = "photo-card";

    if (data.visible === false) {
      wrapper.classList.add("hidden-photo");
    }

    const img = document.createElement("img");
    img.src = data.thumbUrl || data.imageUrl; // 🔥 OPTIMIZACIJA

    wrapper.appendChild(img);

    const badge = document.createElement("div");
    badge.className = "admin-badge";
    badge.innerText = data.visible === false ? "🚫" : "✔";
    wrapper.appendChild(badge);

    /* LONG PRESS */
    let pressTimer;
    let isLongPress = false;

    const start = () => {
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        openPhotoAction(docSnap.id, wrapper);
      }, 600);
    };

    const end = () => {
      clearTimeout(pressTimer);
      if (!isLongPress) {
        openFullscreenFromList(docSnap.id);
      }
    };

    wrapper.addEventListener("touchstart", start);
    wrapper.addEventListener("touchend", end);
    wrapper.addEventListener("mousedown", start);
    wrapper.addEventListener("mouseup", end);
    wrapper.addEventListener("mouseleave", () => clearTimeout(pressTimer));

    gallery.appendChild(wrapper);
  });

  document.getElementById("photoCount").innerText = count;
}

/* ================= FULLSCREEN ================= */
function openFullscreenFromList(photoId) {
  let index = allImages.findIndex(p => p.id === photoId);
  if (index === -1) return;

  const full = document.createElement("div");
  full.className = "admin-fullscreen";

  const img = document.createElement("img");
  img.className = "admin-fullscreen-img";

  const actions = document.createElement("div");
  actions.className = "admin-fullscreen-actions";

  const hideBtn = document.createElement("button");
  hideBtn.innerText = "Sakrij";

  const showBtn = document.createElement("button");
  showBtn.innerText = "Vrati";

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "Zatvori";

  actions.append(hideBtn, showBtn, closeBtn);
  full.append(img, actions);
  document.body.appendChild(full);

  function render() {
    const current = allImages[index];
    img.src = current.url;

    hideBtn.style.display = current.visible ? "block" : "none";
    showBtn.style.display = current.visible ? "none" : "block";
  }

  hideBtn.onclick = async () => {
    const current = allImages[index];
    await updateDoc(doc(db, "photos", current.id), { visible: false });
    current.visible = false;
    render();
  };

  showBtn.onclick = async () => {
    const current = allImages[index];
    await updateDoc(doc(db, "photos", current.id), { visible: true });
    current.visible = true;
    render();
  };

  closeBtn.onclick = () => full.remove();

  let startX = 0;

  full.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
  });

  full.addEventListener("touchend", e => {
    const diff = startX - e.changedTouches[0].clientX;

    if (Math.abs(diff) > 50) {
      index = diff > 0
        ? (index + 1) % allImages.length
        : (index - 1 + allImages.length) % allImages.length;

      render();
    }
  });

  full.onclick = e => {
    if (e.target === full) full.remove();
  };

  render();
}

/* ================= ACTION MODAL ================= */
function openPhotoAction(id, wrapper) {
  selectedPhotoId = id;
  selectedWrapper = wrapper;
  selectedVisible = !wrapper.classList.contains("hidden-photo");

  document.getElementById("photoActionTitle").innerText =
    selectedVisible ? "Maknuti sliku?" : "Vratiti sliku?";

  document.getElementById("photoActionModal").style.display = "flex";
}

window.confirmPhotoAction = async function (confirm) {
  document.getElementById("photoActionModal").style.display = "none";
  if (!confirm) return;

  const newState = !selectedVisible;

  await updateDoc(doc(db, "photos", selectedPhotoId), {
    visible: newState
  });

  selectedWrapper.classList.toggle("hidden-photo", !newState);
};

/* ================= DEDICATIONS ================= */
async function loadDedications() {
  const list = document.getElementById("dedicationsList");
  if (!list) return;

  const snapshot = await getDocs(
    query(
      collection(db, "dedications"),
      orderBy("created", "desc"),
      limit(DEDICATION_LIMIT)
    )
  );

  list.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    const item = document.createElement("div");
    item.className = "dedication-card";

    item.innerHTML = `
      <div>${(data.text || "").slice(0, 50)}...</div>
      <small>${data.name || "Gost"}</small>
    `;

    item.onclick = () => openDedicationModal(data);

    list.appendChild(item);
  });

  document.getElementById("dedicationCount").innerText = snapshot.size;
}

window.openDedicationModal = function (data) {
  document.getElementById("dedicationFullText").innerText = data.text;
  document.getElementById("dedicationAuthor").innerText = "— " + data.name;
  document.getElementById("dedicationModal").style.display = "flex";
};

window.closeDedicationModal = function () {
  document.getElementById("dedicationModal").style.display = "none";
};

/* ================= SETTINGS ================= */
window.openSettings = () =>
  document.getElementById("settingsModal").style.display = "flex";

window.closeSettings = function () {
  showAuthor = document.getElementById("showAuthor").checked;
  showDedications = document.getElementById("showDedications").checked;
  document.getElementById("settingsModal").style.display = "none";
};

/* ================= DOWNLOAD DISABLED ================= */
window.downloadAllPhotos = function () {
  alert("Download trenutno nije dostupan 🙂");
};

/* ================= SLIDESHOW ================= */
window.startSlideshow = async function () {
  if (overlay) return;

  const snapshot = await getDocs(
    query(
      collection(db, "photos"),
      orderBy("created", "desc"),
      limit(IMAGE_LIMIT)
    )
  );

  slideshowImages = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.visible === false) return;

    slideshowImages.push({
      url: data.imageUrl,
      user: data.user || "Gost"
    });
  });

  if (!slideshowImages.length) {
    alert("Nema slika");
    return;
  }

  overlay = document.createElement("div");
  overlay.id = "slideshowOverlay";

  const img = document.createElement("img");
  overlay.appendChild(img);
  document.body.appendChild(overlay);

  function next() {
    const i = Math.floor(Math.random() * slideshowImages.length);
    const current = slideshowImages[i];

    img.src = current.url;
  }

  next();

  const speed = Number(document.getElementById("slideSpeed")?.value || 3000);
  slideshowInterval = setInterval(next, speed);

  overlay.onclick = () => {
    clearInterval(slideshowInterval);
    overlay.remove();
    overlay = null;
  };
};

/* ================= NAV ================= */
window.switchAdminScreen = function (screen) {
  document.querySelectorAll(".tab-content").forEach(el =>
    el.classList.remove("active")
  );

  document.querySelectorAll(".admin-nav-item").forEach(el =>
    el.classList.remove("active")
  );

  if (screen === "photos") {
    document.getElementById("adminPhotos").classList.add("active");
    document.querySelectorAll(".admin-nav-item")[0].classList.add("active");
  }

  if (screen === "dedications") {
    document.getElementById("adminDedications").classList.add("active");
    document.querySelectorAll(".admin-nav-item")[1].classList.add("active");
  }
};

/* ================= INIT ================= */
loadAllImages();
loadDedications();
switchAdminScreen("photos");