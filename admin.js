import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA3qAy-Ij6yPvOcfEvzguTak4CJCc1a5UU",
  authDomain: "photodumpkrstenje.firebaseapp.com",
  projectId: "photodumpkrstenje",
  storageBucket: "photodumpkrstenje.firebasestorage.app",
  messagingSenderId: "552390088463",
  appId: "1:552390088463:web:ac5fd3c62359149eb9d07a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ===================== STATE ===================== */
let currentFilter = "all";

let selectedPhotoId = null;
let selectedWrapper = null;
let selectedVisible = true;

let allImages = [];
let allDedications = [];

let galleryUnsubscribe = null;
let dedicationsUnsubscribe = null;

let slideshowImages = [];
let slideshowInterval = null;
let overlay = null;

let showAuthor = true;
let showDedications = false;

/* ===================== HELPERS ===================== */
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

async function loadAllDedications() {
  const snapshot = await getDocs(collection(db, "dedications"));
  allDedications = [];

  snapshot.forEach((docSnap) => {
    allDedications.push(docSnap.data());
  });
}

/* ===================== FILTER ===================== */
window.filterPhotos = function (type) {
  currentFilter = type;

  document.querySelectorAll(".admin-filters button").forEach((btn) => {
    btn.classList.remove("active");
  });

  const map = {
    all: 0,
    visible: 1,
    hidden: 2
  };

  const buttons = document.querySelectorAll(".admin-filters button");
  if (buttons[map[type]]) {
    buttons[map[type]].classList.add("active");
  }

  loadAllImages();
};

/* ===================== GALLERY ===================== */
function loadAllImages() {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  if (galleryUnsubscribe) {
    galleryUnsubscribe();
  }

  galleryUnsubscribe = onSnapshot(
    query(collection(db, "photos"), orderBy("created", "desc")),
    (snapshot) => {
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
        wrapper.style.position = "relative";

        if (data.visible === false) {
          wrapper.classList.add("hidden-photo");
        }

        const img = document.createElement("img");
        img.src = data.imageUrl;
        img.alt = "Fotografija";

        wrapper.appendChild(img);

        const badge = document.createElement("div");
        badge.className = "admin-badge";
        badge.innerText = data.visible === false ? "🚫" : "✔";
        wrapper.appendChild(badge);

        let pressTimer = null;
        let isLongPress = false;

        const startPress = () => {
          isLongPress = false;

          pressTimer = setTimeout(() => {
            isLongPress = true;
            openPhotoAction(docSnap.id, wrapper);
          }, 600);
        };

        const endPress = () => {
          clearTimeout(pressTimer);

          if (!isLongPress) {
            openFullscreenFromList(docSnap.id);
          }
        };

        const cancelPress = () => {
          clearTimeout(pressTimer);
        };

        wrapper.addEventListener("touchstart", startPress, { passive: true });
        wrapper.addEventListener("touchend", endPress);
        wrapper.addEventListener("touchmove", cancelPress);

        wrapper.addEventListener("mousedown", startPress);
        wrapper.addEventListener("mouseup", endPress);
        wrapper.addEventListener("mouseleave", cancelPress);

        gallery.appendChild(wrapper);
      });

      const photoCount = document.getElementById("photoCount");
      if (photoCount) {
        photoCount.innerText = count;
      }
    }
  );
}

/* ===================== FULLSCREEN SWIPE ===================== */
function openFullscreenFromList(photoId) {
  let index = allImages.findIndex((p) => p.id === photoId);
  if (index === -1) return;

  const full = document.createElement("div");
  full.className = "admin-fullscreen";

  const img = document.createElement("img");
  img.className = "admin-fullscreen-img";

  const actions = document.createElement("div");
  actions.className = "admin-fullscreen-actions";

  const hideBtn = document.createElement("button");
  hideBtn.className = "btn-secondary";
  hideBtn.innerText = "Sakrij";

  const showBtn = document.createElement("button");
  showBtn.className = "btn-primary";
  showBtn.innerText = "Vrati";

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn-secondary";
  closeBtn.innerText = "Zatvori";

  actions.appendChild(hideBtn);
  actions.appendChild(showBtn);
  actions.appendChild(closeBtn);

  full.appendChild(img);
  full.appendChild(actions);
  document.body.appendChild(full);

  function render() {
    const current = allImages[index];
    if (!current) return;

    img.src = current.url;

    hideBtn.style.display = current.visible ? "inline-flex" : "none";
    showBtn.style.display = current.visible ? "none" : "inline-flex";

    if (current.visible) {
      img.style.filter = "none";
      img.style.opacity = "1";
    } else {
      img.style.filter = "grayscale(100%)";
      img.style.opacity = "0.7";
    }
  }

  hideBtn.onclick = async (e) => {
    e.stopPropagation();

    const current = allImages[index];
    await updateDoc(doc(db, "photos", current.id), { visible: false });
    current.visible = false;
    render();
  };

  showBtn.onclick = async (e) => {
    e.stopPropagation();

    const current = allImages[index];
    await updateDoc(doc(db, "photos", current.id), { visible: true });
    current.visible = true;
    render();
  };

  closeBtn.onclick = (e) => {
    e.stopPropagation();
    full.remove();
  };

  let startX = 0;
  let startY = 0;

  full.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  full.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;

    const diffX = startX - endX;
    const diffY = startY - endY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        index = (index + 1) % allImages.length;
      } else {
        index = (index - 1 + allImages.length) % allImages.length;
      }
      render();
    }
  });

  full.addEventListener("click", (e) => {
    if (e.target === full) {
      full.remove();
    }
  });

  render();
}

/* ===================== PHOTO ACTION MODAL ===================== */
function openPhotoAction(id, wrapper) {
  selectedPhotoId = id;
  selectedWrapper = wrapper;
  selectedVisible = !wrapper.classList.contains("hidden-photo");

  const title = selectedVisible
    ? "Maknuti sliku iz prikaza?"
    : "Vratiti sliku u prikaz?";

  document.getElementById("photoActionTitle").innerText = title;
  document.getElementById("photoActionModal").style.display = "flex";
}

window.confirmPhotoAction = async function (confirm) {
  document.getElementById("photoActionModal").style.display = "none";

  if (!confirm) return;

  const newState = !selectedVisible;

  await updateDoc(doc(db, "photos", selectedPhotoId), {
    visible: newState
  });

  if (!newState) {
    selectedWrapper?.classList.add("hidden-photo");
  } else {
    selectedWrapper?.classList.remove("hidden-photo");
  }
};

/* ===================== DEDICATIONS ===================== */
function loadDedications() {
  const list = document.getElementById("dedicationsList");
  if (!list) return;

  if (dedicationsUnsubscribe) {
    dedicationsUnsubscribe();
  }

  dedicationsUnsubscribe = onSnapshot(
    query(collection(db, "dedications"), orderBy("created", "desc")),
    (snapshot) => {
      list.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const text = data.text || "";

        const preview = text.length > 50
          ? text.substring(0, 50) + "..."
          : text;

        const item = document.createElement("div");
        item.className = "dedication-card";
        item.innerHTML = `
          <div class="dedication-preview">${preview}</div>
          <div class="dedication-author">${data.name || "Gost"}</div>
        `;

        item.onclick = () => openDedicationModal(data);
        list.appendChild(item);
      });

      const dedicationCount = document.getElementById("dedicationCount");
      if (dedicationCount) {
        dedicationCount.innerText = snapshot.size;
      }
    }
  );
}

window.openDedicationModal = function (data) {
  document.getElementById("dedicationFullText").innerText = data.text || "";
  document.getElementById("dedicationAuthor").innerText = "— " + (data.name || "Gost");
  document.getElementById("dedicationModal").style.display = "flex";
};

window.closeDedicationModal = function () {
  document.getElementById("dedicationModal").style.display = "none";
};

/* ===================== SETTINGS ===================== */
window.openSettings = function () {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;
  modal.style.display = "flex";
};

window.closeSettings = function () {
  const authorCheckbox = document.getElementById("showAuthor");
  const dedicationCheckbox = document.getElementById("showDedications");

  showAuthor = !!authorCheckbox?.checked;
  showDedications = !!dedicationCheckbox?.checked;

  const modal = document.getElementById("settingsModal");
  if (modal) {
    modal.style.display = "none";
  }
};

/* ===================== DOWNLOAD ===================== */
window.downloadAllPhotos = async function () {
  const zip = new JSZip();
  const snapshot = await getDocs(collection(db, "photos"));

  let count = 1;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (!data.imageUrl) continue;

    const response = await fetch(data.imageUrl);
    const blob = await response.blob();

    zip.file(`photo_${count}.jpg`, blob);
    count++;
  }

  const content = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = "fotografije.zip";
  link.click();
};

/* ===================== SLIDESHOW ===================== */
window.startSlideshow = async function () {
  if (overlay) return;

  await loadAllDedications();

  const snapshot = await getDocs(
    query(collection(db, "photos"), orderBy("created", "desc"))
  );

  slideshowImages = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (data.visible === false) return;
    if (!data.imageUrl) return;

    slideshowImages.push({
      id: docSnap.id,
      url: data.imageUrl,
      user: data.user || "Gost"
    });
  });

  if (slideshowImages.length === 0) {
    alert("Nema vidljivih slika za slideshow.");
    return;
  }

  showSlideshow();
};

function showSlideshow() {
  overlay = document.createElement("div");
  overlay.id = "slideshowOverlay";

  const img = document.createElement("img");
  img.className = "slideshow-img";

  const info = document.createElement("div");
  info.className = "slideshow-info info-bottom";

  overlay.appendChild(img);
  overlay.appendChild(info);
  document.body.appendChild(overlay);

  function nextSlide() {
    if (slideshowImages.length === 0) return;

    const randomIndex = Math.floor(Math.random() * slideshowImages.length);
    const current = slideshowImages[randomIndex];

    img.style.opacity = "0";
    info.style.opacity = "0";

    setTimeout(() => {
      img.src = current.url;

      info.innerHTML = showAuthor
        ? `<div class="slideshow-user">${current.user}</div>`
        : "";

      img.style.opacity = "1";
      info.style.opacity = "1";
    }, 250);
  }

  nextSlide();

  const speed = Number(document.getElementById("slideSpeed")?.value || 3000);
  slideshowInterval = setInterval(nextSlide, speed);

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      clearInterval(slideshowInterval);
      slideshowInterval = null;
      overlay.remove();
      overlay = null;
    }
  };
}

/* ===================== BOTTOM NAV ===================== */
window.switchAdminScreen = function (screen) {
  document.querySelectorAll(".tab-content").forEach((el) => {
    el.classList.remove("active");
  });

  document.querySelectorAll(".admin-nav-item").forEach((el) => {
    el.classList.remove("active");
  });

  const photos = document.getElementById("adminPhotos");
  const dedications = document.getElementById("adminDedications");
  const items = document.querySelectorAll(".admin-nav-item");

  if (screen === "photos") {
    photos?.classList.add("active");
    items[0]?.classList.add("active");
  }

  if (screen === "dedications") {
    dedications?.classList.add("active");
    items[1]?.classList.add("active");
  }
};

/* ===================== CLOSE MODALS ON BACKDROP ===================== */
window.addEventListener("click", (e) => {
  const settingsModal = document.getElementById("settingsModal");
  const dedicationModal = document.getElementById("dedicationModal");
  const photoActionModal = document.getElementById("photoActionModal");

  if (e.target === settingsModal) {
    settingsModal.style.display = "none";
  }

  if (e.target === dedicationModal) {
    dedicationModal.style.display = "none";
  }

  if (e.target === photoActionModal) {
    photoActionModal.style.display = "none";
  }
});

/* ===================== INIT ===================== */
loadAllImages();
loadDedications();
window.filterPhotos("all");
window.switchAdminScreen("photos");