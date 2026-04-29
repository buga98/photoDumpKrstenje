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
const IMAGE_LIMIT = 50;
const DEDICATION_LIMIT = 50;

/* ================= STATE ================= */
let currentFilter = "all";

let selectedPhotoId = null;
let selectedWrapper = null;
let selectedVisible = true;

let allImages = [];
let slideshowImages = [];

let slideshowInterval = null;
let overlay = null;

let showAuthor = localStorage.getItem("showAuthor") !== "false";
let showDedications = localStorage.getItem("showDedications") === "true";

/* ================= HELPERS ================= */
function buildImageList(snapshot) {
  allImages = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (currentFilter === "visible" && data.visible === false) return;
    if (currentFilter === "hidden" && data.visible !== false) return;

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
  document.querySelectorAll(".admin-filters button")[map[type]]?.classList.add("active");

  loadAllImages();
};

/* ================= GALLERY ================= */
async function loadAllImages() {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  gallery.innerHTML = "Učitavanje...";

  const snapshot = await getDocs(
    query(collection(db, "photos"), orderBy("created", "desc"), limit(IMAGE_LIMIT))
  );

  gallery.innerHTML = "";
  buildImageList(snapshot);

  let count = 0;

  allImages.forEach((imgData) => {
    count++;

    const wrapper = document.createElement("div");
    wrapper.className = "photo-card";

    if (!imgData.visible) wrapper.classList.add("hidden-photo");

    const img = document.createElement("img");
    img.src = imgData.url;
    img.loading = "lazy";
    img.decoding = "async";
    img.style.touchAction = "manipulation";

    wrapper.appendChild(img);

    const badge = document.createElement("div");
    badge.className = "admin-badge";
    badge.innerText = imgData.visible ? "✔" : "🚫";
    wrapper.appendChild(badge);

    /* LONG PRESS */
    let pressTimer;
    let isLongPress = false;

    const start = () => {
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        openPhotoAction(imgData.id, wrapper);
      }, 600);
    };

    const end = () => {
      clearTimeout(pressTimer);
      if (!isLongPress) openFullscreenFromList(imgData.id);
    };

    wrapper.addEventListener("touchstart", start);
    wrapper.addEventListener("touchend", end);
    wrapper.addEventListener("touchcancel", () => clearTimeout(pressTimer));

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

  full.appendChild(img);
  document.body.appendChild(full);

  function render() {
    img.src = allImages[index].url;
  }

  let startX = 0;
  let isSwiping = false;

  full.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
    isSwiping = false;
  });

  full.addEventListener("touchmove", () => {
    isSwiping = true;
  });

  full.addEventListener("touchend", e => {
    const diff = startX - e.changedTouches[0].clientX;

    if (Math.abs(diff) > 50) {
      index = diff > 0
        ? (index + 1) % allImages.length
        : (index - 1 + allImages.length) % allImages.length;

      render();
    } else if (!isSwiping) {
      full.remove();
    }
  });

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

  const badge = selectedWrapper.querySelector(".admin-badge");
  if (badge) badge.innerText = newState ? "✔" : "🚫";

  const img = allImages.find(p => p.id === selectedPhotoId);
  if (img) img.visible = newState;
};

/* ================= DEDICATIONS ================= */
async function loadDedications() {
  const list = document.getElementById("dedicationsList");
  if (!list) return;

  const snapshot = await getDocs(
    query(collection(db, "dedications"), orderBy("created", "desc"), limit(DEDICATION_LIMIT))
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

  localStorage.setItem("showAuthor", showAuthor);
  localStorage.setItem("showDedications", showDedications);

  document.getElementById("settingsModal").style.display = "none";
};

/* ================= DOWNLOAD ================= */
window.downloadAllPhotos = function () {
  alert("Download trenutno nije dostupan 🙂");
};

/* ================= SLIDESHOW ================= */
window.startSlideshow = async function () {
  if (overlay) return;

  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }

  const snapshot = await getDocs(
    query(collection(db, "photos"), orderBy("created", "desc"), limit(IMAGE_LIMIT))
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

  if (!slideshowImages.length) return alert("Nema slika");

  overlay = document.createElement("div");
  overlay.id = "slideshowOverlay";

  const img = document.createElement("img");
  const caption = document.createElement("div");
  caption.className = "slideshow-caption";

  overlay.append(img, caption);
  document.body.appendChild(overlay);

  function next() {
    const i = Math.floor(Math.random() * slideshowImages.length);
    const current = slideshowImages[i];

    img.src = current.url;

    if (showAuthor) {
      caption.innerText = "📸 " + current.user;
      caption.style.display = "block";
    } else {
      caption.style.display = "none";
    }
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