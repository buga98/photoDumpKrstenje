let currentEventId =
  new URLSearchParams(window.location.search).get("event") ||
  localStorage.getItem("eventId");

/* ===== FIREBASE ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";

import {
  getFirestore,
  onSnapshot,
  orderBy,
  doc,
  setDoc,
  addDoc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
  increment,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjETOqGf9zNxWO7DB7QokoHu_duiqM8Jg",
  authDomain: "photodumpevent-4578c.firebaseapp.com",
  projectId: "photodumpevent-4578c",
  storageBucket: "photodumpevent-4578c.firebasestorage.app",
  messagingSenderId: "617407847422",
  appId: "1:617407847422:web:2c4a13242a0fa1ba50feaf"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/* ===== THEME / EVENT BOOT ===== */
const THEME_CLASSES = [
  "theme-svadba",
  "theme-rodendan",
  "theme-krstenje",
  "theme-pricest",
  "theme-party"
];

function setTheme(type) {
  document.body.classList.remove(...THEME_CLASSES);
  document.body.classList.add("theme-" + (type || "default"));
}

function getTitleWithEmoji(title, type) {
  switch (type) {
    case "rodendan": return "🎂 " + title + " 🎂";
    case "svadba": return "💍 " + title + " 💍";
    case "krstenje": return "✨ " + title + " ✨";
    case "pricest": return "✝️ " + title + " ✝️";
    case "party": return "🎉 " + title + " 🎉";
    default: return "✨ " + title + " ✨";
  }
}
function applyEvent(event) {
  if (!event) return;
window.eventData = event;
  // ==============================
  // 🎨 THEME
  // ==============================
  setTheme(event.type);

  // ==============================
  // 🌐 TITLE
  // ==============================
  document.title = event.title + " | PhotoDump";

  const eventTitle = document.getElementById("eventTitle");
  if (eventTitle) {
    eventTitle.innerText = getTitleWithEmoji(event.title, event.type);
  }

  // ==============================
  // 🧠 DEFAULT TEXTS (fallback)
  // ==============================
  const defaults = {
    home_title: "Galerija uspomena 🤍",
    home_subtitle: "Svaka fotografija postaje dio uspomena",

    upload_title: "Podijeli trenutak 📸",
    upload_subtitle: "Dodaj fotografiju i ostavi uspomenu",

    profile_title: "Tvoje uspomene",
    profile_subtitle: "Ovdje su tvoje fotografije"
  };

  // ==============================
  // 📥 TEXTS IZ BAZE
  // ==============================
  const homeTitle =
    event.texts?.index?.title || defaults.home_title;

  const homeSubtitle =
    event.texts?.index?.subtitle || defaults.home_subtitle;

  const uploadTitle =
    event.texts?.upload?.title || defaults.upload_title;

  const uploadSubtitle =
    event.texts?.upload?.subtitle || defaults.upload_subtitle;

  const profileSubtitle =
    event.texts?.profile?.subtitle || defaults.profile_subtitle;

  // ==============================
  // 🖥️ UI UPDATE
  // ==============================

  // HOME
  const homeTitleEl = document.getElementById("homeTitle");
  const homeSubtitleEl = document.getElementById("homeSubtitle");

  if (homeTitleEl) homeTitleEl.innerText = homeTitle;
  if (homeSubtitleEl) homeSubtitleEl.innerText = homeSubtitle;

  // UPLOAD
  const uploadTitleEl = document.getElementById("uploadTitle");
  const uploadSubtitleEl = document.getElementById("uploadSubtitle");

  if (uploadTitleEl) uploadTitleEl.innerText = uploadTitle;
  if (uploadSubtitleEl) uploadSubtitleEl.innerText = uploadSubtitle;

  // PROFILE
  const profileSubtitleEl = document.getElementById("profileSubtitle");

  if (profileSubtitleEl) profileSubtitleEl.innerText = profileSubtitle;

  // ==============================
  // 💾 SAVE
  // ==============================
  localStorage.setItem("eventId", currentEventId);

  console.log("✅ App texts applied");
}

function bootEventFromCache() {
  const cached = localStorage.getItem("eventData_" + currentEventId);
  if (!cached) return false;

  try {
    const event = JSON.parse(cached);
    applyEvent(event);
    console.log("⚡ App boot from cached event");
    return true;
  } catch (err) {
    console.warn("Cache event parse error:", err);
    return false;
  }
}

async function loadEventDataFallback() {
  if (!currentEventId) {
    alert("Event ne postoji");
    return false;
  }

  const snap = await getDoc(doc(db, "events", currentEventId));

  if (!snap.exists()) {
    alert("Event nije pronađen");
    return false;
  }

  const event = snap.data();

  localStorage.setItem("eventId", currentEventId);
  localStorage.setItem("eventData_" + currentEventId, JSON.stringify(event));

  applyEvent(event);

  console.log("🌐 Event loaded from Firebase fallback:", event);
  return true;
}

/* ===== LIVE FEED ===== */
const FEED_PAGE_SIZE = 18;
const likedCache = new Set(
  JSON.parse(localStorage.getItem("likedPhotos_" + currentEventId) || "[]")
);

function saveLikedCache() {
  localStorage.setItem(
    "likedPhotos_" + currentEventId,
    JSON.stringify([...likedCache])
  );
}

let feedStarted = false;
let lastVisiblePhoto = null;
let isLoadingMore = false;
let hasMorePhotos = true;
const renderedPhotos = new Map();

function renderFeedSkeleton() {
  const feed = document.getElementById("feed");
  if (!feed) return;

  feed.innerHTML = "";

  for (let i = 0; i < 6; i++) {
    const card = document.createElement("div");
    card.className = "feed-card skeleton-card";

    card.innerHTML = `<img src="ucitavanje.png" class="skeleton-img">`;

    feed.appendChild(card);
  }
}

function loadFeed() {
  const feed = document.getElementById("feed");
  if (!feed || feedStarted || !currentEventId) return;

  feedStarted = true;
  renderFeedSkeleton();

const firstQuery = query(
  collection(db, "events", currentEventId, "photos"),
  orderBy("likes", "desc"),
  orderBy("created", "desc"),
  limit(FEED_PAGE_SIZE)
);

  onSnapshot(
  firstQuery,
  (snapshot) => {

    // 🔥 ukloni skeleton
    if (feed.dataset.loaded !== "true") {
      feed.innerHTML = "";
      feed.dataset.loaded = "true";
    }

    // 🔥 AKO NEMA SLIKA
    if (snapshot.empty) {
      feed.innerHTML = `
        <p style="grid-column:1/-1; opacity:0.6; text-align:center;">
          Još nema fotografija 📸
        </p>
      `;
      return;
    }

    lastVisiblePhoto = snapshot.docs[snapshot.docs.length - 1];

    snapshot.docChanges().forEach((change) => {
      renderFeedChange(change, feed, true);
    });

    createFeedObserver(feed);
  },

  // 🔥 KLJUČNO — ERROR HANDLER
  (error) => {
    console.error("Feed error:", error);

    feed.innerHTML = `
      <p style="grid-column:1/-1; color:#ff6b6b; text-align:center;">
        Greška pri učitavanju 😕<br>
        Provjeri internet ili pravila
      </p>
    `;
  }
);

function renderFeedChange(change, feed, isLiveTop = false) {
  const docSnap = change.doc;
  const data = docSnap.data();
  const photoId = docSnap.id;

  if (change.type === "removed" || data.visible === false) {
    const existing = renderedPhotos.get(photoId);
    if (existing) {
      existing.remove();
      renderedPhotos.delete(photoId);
    }
    return;
  }

  if (change.type === "modified") {
    const existing = renderedPhotos.get(photoId);
    if (existing) {
      const countEl = existing.querySelector(".like-count");
      if (countEl) countEl.innerText = data.likes || 0;
    }
    return;
  }

  if (renderedPhotos.has(photoId)) return;

  const card = createFeedCard(photoId, data);
  renderedPhotos.set(photoId, card);

  if (isLiveTop) {
    feed.prepend(card);
  } else {
    feed.appendChild(card);
  }
}

function createFeedCard(photoId, data) {
  const userId = localStorage.getItem("userId");

  const card = document.createElement("div");
  card.className = "feed-card";
  card.dataset.id = photoId;
  card.dataset.full = data.imageUrl;

  const img = document.createElement("img");
  img.src = data.thumbUrl || data.imageUrl;
  img.loading = "lazy";
  img.decoding = "async";
  img.style.userSelect = "none";
  img.style.webkitUserSelect = "none";
  img.draggable = false;

  img.onload = () => {
    img.classList.add("loaded");
  };

  const likeBox = document.createElement("div");
  likeBox.className = "like-box";

  const isLiked = likedCache.has(photoId);

  likeBox.innerHTML = `
    <span class="heart ${isLiked ? "liked" : ""}">❤️</span>
    <span class="like-count">${data.likes || 0}</span>
  `;

  const heartEl = likeBox.querySelector(".heart");

  async function doLike() {
    showBigHeart(card);

    if (likedCache.has(photoId)) return;

    const userLikeRef = doc(
      db,
      "events",
      currentEventId,
      "photos",
      photoId,
      "likes",
      userId
    );

    const checkSnap = await getDoc(userLikeRef);

    if (checkSnap.exists()) {
      likedCache.add(photoId);
      saveLikedCache();
      heartEl.classList.add("liked");
      return;
    }

    likedCache.add(photoId);
    saveLikedCache();
    heartEl.classList.add("liked");

    await setDoc(userLikeRef, {
      created: Date.now()
    });

    await updateDoc(doc(db, "events", currentEventId, "photos", photoId), {
      likes: increment(1)
    });

    await updateDoc(doc(db, "stats", "main"), {
      likes: increment(1)
    });
  }

  likeBox.onclick = (e) => {
    e.stopPropagation();
    doLike();
  };

  let lastTap = 0;
  let tapTimer = null;
  let isDoubleTap = false;

  let startX = 0;
  let startY = 0;
  let moved = false;

  img.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    moved = false;
  });

  img.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);

    if (dx > 15 || dy > 15) {
      moved = true;
    }
  }, { passive: true });

  img.addEventListener("touchend", () => {
    if (moved) return;

    const now = Date.now();
    const diff = now - lastTap;

    if (diff < 300 && diff > 0) {
      isDoubleTap = true;
      clearTimeout(tapTimer);
      tapTimer = null;
      doLike();
      lastTap = 0;
      return;
    }

    isDoubleTap = false;
    lastTap = now;

    clearTimeout(tapTimer);

    tapTimer = setTimeout(() => {
      if (!isDoubleTap) {
        openFullscreen(data.imageUrl);
      }
    }, 300);
  });

  img.addEventListener("click", () => {
    if (!("ontouchstart" in window)) {
      openFullscreen(data.imageUrl);
    }
  });

  card.appendChild(img);
  card.appendChild(likeBox);

  return card;
}

function createFeedObserver(feed) {
  if (document.getElementById("feedSentinel")) return;

  const sentinel = document.createElement("div");
  sentinel.id = "feedSentinel";
  sentinel.style.height = "40px";
  feed.after(sentinel);

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMoreFeedPhotos(feed);
    }
  }, {
    rootMargin: "300px"
  });

  observer.observe(sentinel);
}

async function loadMoreFeedPhotos(feed) {
  if (isLoadingMore || !hasMorePhotos || !lastVisiblePhoto) return;

  isLoadingMore = true;

const nextQuery = query(
  collection(db, "events", currentEventId, "photos"),
  orderBy("likes", "desc"),
  orderBy("created", "desc"),
  startAfter(lastVisiblePhoto),
  limit(FEED_PAGE_SIZE)
);

  const snapshot = await getDocs(nextQuery);

  if (snapshot.empty) {
    hasMorePhotos = false;
    isLoadingMore = false;
    return;
  }

  lastVisiblePhoto = snapshot.docs[snapshot.docs.length - 1];

  const fragment = document.createDocumentFragment();

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.visible === false) return;

    const photoId = docSnap.id;
    if (renderedPhotos.has(photoId)) return;

    const card = createFeedCard(photoId, data);
    renderedPhotos.set(photoId, card);
    fragment.appendChild(card);
  });

  feed.appendChild(fragment);
  isLoadingMore = false;
}

function showBigHeart(parent) {
  const heart = document.createElement("div");
  heart.className = "big-heart";
  heart.innerText = "❤️";

  parent.appendChild(heart);

  setTimeout(() => {
    heart.remove();
  }, 900);
}

/* ===== IMAGE RESIZE ===== */
async function resizeImage(file, maxWidth, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const img = new Image();

    reader.onload = (e) => img.src = e.target.result;

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = height * (maxWidth / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        const newFile = new File(
          [blob],
          file.name.replace(/\.[^/.]+$/, "") + ".jpg",
          { type: "image/jpeg" }
        );

        resolve(newFile);
      }, "image/jpeg", quality);
    };

    reader.readAsDataURL(file);
  });
}

/* ===== UPLOAD ===== */
window.uploadToFirebase = function (file, user, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const bigFile = await resizeImage(file, 1450, 0.8);
      const thumbFile = await resizeImage(file, 350, 0.65);

      const safeName = file.name.replace(/\s+/g, "-");
      const timestamp = Date.now();

      const bigRef = ref(
        storage,
        `events/${currentEventId}/photos/${timestamp}_${safeName}`
      );

      const thumbRef = ref(
        storage,
        `events/${currentEventId}/thumbs/${timestamp}_${safeName}`
      );

      // 🔥 upload glavne slike
      const uploadTask = uploadBytesResumable(bigRef, bigFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const percent =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

          if (onProgress) onProgress(percent);
        },
        reject,
        async () => {
          try {
            const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);

            // 🔥 upload thumbnail
            await uploadBytesResumable(thumbRef, thumbFile);
            const thumbUrl = await getDownloadURL(thumbRef);

            // 🔥 ORIGINAL (samo ako je uključeno)
            if (window.eventData?.allowOriginals) {
              const originalRef = ref(
                storage,
                `events/${currentEventId}/originals/${timestamp}_${safeName}`
              );

              await uploadBytesResumable(originalRef, file);
            }

            // 🔥 zapis u bazu
            await addDoc(collection(db, "events", currentEventId, "photos"), {
              imageUrl,
              thumbUrl,
              path: uploadTask.snapshot.ref.fullPath,
              user,
              userId: localStorage.getItem("userId"),
              created: Date.now(),
              likes: 0,
              visible: true
            });

            // 🔥 stats
            await updateDoc(doc(db, "stats", "main"), {
              photos: increment(1)
            });

            resolve(imageUrl);

          } catch (err) {
            reject(err);
          }
        }
      );

    } catch (err) {
      reject(err);
    }
  });
};

window.uploadFile = async function (files) {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  const user = localStorage.getItem("name");

  showToast("Fotografije se učitavaju 📸");

  let uploads = [];

  for (let file of files) {
    const wrapper = document.createElement("div");
    const progress = document.createElement("div");
    const img = document.createElement("img");

    img.src = URL.createObjectURL(file);

    wrapper.appendChild(img);
    wrapper.appendChild(progress);
    gallery.appendChild(wrapper);

const task = uploadToFirebase(file, user, (percent) => {
  progress.style.width = percent + "%";
})
.then((url) => {
  img.src = url;
  progress.remove();
})
.catch(() => {
  let pending = JSON.parse(localStorage.getItem("pendingUploads") || "[]");

  pending.push({
    name: file.name,
    time: Date.now()
  });

  localStorage.setItem("pendingUploads", JSON.stringify(pending));

  showToast("Slika će se poslati kad se vrati internet 📡");
});

    uploads.push(task);
  }

  await Promise.all(uploads);

  switchScreen("profile");
  loadMyImages();

  showToast("Upload završen 🤍");
};

/* ===== DELETE ===== */
let selectedPhotoId = null;

window.confirmDelete = async function () {
  document.getElementById("deleteModal").style.display = "none";

  const docRef = doc(db, "events", currentEventId, "photos", selectedPhotoId);
  const snap = await getDoc(docRef);
  const imageUrl = snap.exists() ? snap.data().imageUrl : null;

  if (imageUrl) {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (e) {
      console.log("Storage delete fail:", e);
    }
  }

  await deleteDoc(docRef);

  await updateDoc(doc(db, "stats", "main"), {
    photos: increment(-1)
  });

  loadMyImages();
};

window.closeDelete = function () {
  document.getElementById("deleteModal").style.display = "none";
};

/* ===== NAVIGATION ===== */
window.switchScreen = function (screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  if (screen === "home") {
    document.getElementById("homeTab").classList.add("active");
    document.querySelectorAll(".nav-item")[0].classList.add("active");
  }

  if (screen === "upload") {
    document.getElementById("uploadTab").classList.add("active");
    document.querySelectorAll(".nav-item")[1].classList.add("active");
  }

  if (screen === "profile") {
    document.getElementById("profileTab").classList.add("active");
    document.querySelectorAll(".nav-item")[2].classList.add("active");
    loadMyImages();
  }
};

/* ===== DEDICATION ===== */
window.saveDedication = async function () {
  const text = document.getElementById("dedicationText").value.trim();
  const name = localStorage.getItem("name");

  if (!text) {
    alert("Napiši poruku 🤍");
    return;
  }

  await addDoc(collection(db, "events", currentEventId, "dedications"), {
    name,
    text,
    created: Date.now()
  });

  await updateDoc(doc(db, "stats", "main"), {
    dedications: increment(1)
  });

  document.getElementById("dedicationText").value = "";
  showToast("🤍 Hvala na lijepim riječima");
};

/* ===== PROFILE ===== */
window.loadMyImages = async function () {
  const gallery = document.getElementById("gallery");
  const name = localStorage.getItem("name");

  if (!gallery) return;

  gallery.innerHTML =
    "<p style='grid-column:1/-1; opacity:0.6;'>Učitavam...</p>";

  try {
    const q = query(
      collection(db, "events", currentEventId, "photos"),
      where("user", "==", name)
    );

    const snapshot = await getDocs(q);

    gallery.innerHTML = "";

    if (snapshot.empty) {
      gallery.innerHTML =
        "<p style='grid-column:1/-1; opacity:0.6;'>Nema još tvojih slika 📸</p>";
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const img = document.createElement("img");
      img.src = data.thumbUrl || data.imageUrl;

      let pressTimer;
      let isLongPress = false;

      img.addEventListener("touchstart", () => {
        isLongPress = false;

        pressTimer = setTimeout(() => {
          isLongPress = true;
          selectedPhotoId = docSnap.id;

          document.getElementById("deleteModal").style.display = "flex";

          if (navigator.vibrate) navigator.vibrate(50);
        }, 700);
      });

      img.addEventListener("touchend", () => {
        clearTimeout(pressTimer);
      });

      img.addEventListener("touchmove", () => clearTimeout(pressTimer));
      img.addEventListener("mouseleave", () => clearTimeout(pressTimer));

      gallery.appendChild(img);
    });
  } catch (err) {
    console.error(err);
    gallery.innerHTML =
      "<p style='grid-column:1/-1;'>Greška pri učitavanju</p>";
  }
};

/* ===== LIVE COUNTERS ===== */
function loadLiveCounters() {
  const photoEl = document.getElementById("livePhotoCount");
  const dedicationEl = document.getElementById("liveDedicationCount");
  const likesEl = document.getElementById("liveLikesCount");

  if (!photoEl || !dedicationEl) return;

  const statsRef = doc(db, "stats", "main");

  onSnapshot(statsRef, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    photoEl.innerText = data.photos || 0;
    dedicationEl.innerText = data.dedications || 0;

    if (likesEl) {
      likesEl.innerText = data.likes || 0;
    }
  });
}

/* ===== FULLSCREEN ===== */
function openFullscreen(url, startIndex = null) {
  if (document.querySelector(".admin-fullscreen")) return;

  const full = document.createElement("div");
  full.className = "admin-fullscreen";

  const img = document.createElement("img");
  img.className = "admin-fullscreen-img";
  img.src = "";

  full.appendChild(img);
  document.body.appendChild(full);
  document.body.classList.add("fullscreen-open");

  let photos = [...renderedPhotos.keys()];
  let index = startIndex !== null ? startIndex : 0;

  if (!photos.length) {
    img.src = url;
  } else {
    const currentId = [...renderedPhotos.entries()]
      .find(([id, el]) => el.dataset.full === url);

    index = photos.indexOf(currentId?.[0]);

    if (index < 0) index = 0;
  }

  function closeFullscreen() {
    document.body.classList.remove("fullscreen-open");
    full.remove();
  }

  function render() {
    const id = photos[index];
    if (!id) return;

    const card = renderedPhotos.get(id);
    if (!card) return;

    img.style.opacity = "0";

    const newImg = new Image();

    newImg.onload = () => {
      img.src = newImg.src;
      img.style.opacity = "1";
    };

    newImg.src = card.dataset.full;
  }

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

    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    if (absX > absY && absX > 50) {
      if (diffX > 0) {
        index = (index + 1) % photos.length;
      } else {
        index = (index - 1 + photos.length) % photos.length;
      }

      render();
      return;
    }

    if (absY > absX && absY > 90) {
      closeFullscreen();
      return;
    }

    if (absX < 10 && absY < 10) {
      closeFullscreen();
    }
  });

  full.addEventListener("click", (e) => {
    if (e.target === full || e.target === img) {
      closeFullscreen();
    }
  });

  render();
}

/* ===== ADMIN LOGIN ===== */
window.checkAdmin = function () {
  const pass = document.getElementById("adminPass")?.value;

  if (pass === "admin") {
    window.location.href = "/admin";
  } else {
    alert("Kriva šifra");
  }
};

/* ===== TOAST ===== */
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 2000);
}

/* ===== USER ===== */
const user = localStorage.getItem("name");
const welcomeEl = document.getElementById("welcome");

if (!user) {
  window.location.href = "/index.html?event=" + currentEventId;
}

if (user && welcomeEl) {
  welcomeEl.innerText = "Pozdrav, " + user;
}

/* ===== INIT ===== */
async function initApp() {
  const booted = bootEventFromCache();

  if (!booted) {
    await loadEventDataFallback();
  }

  loadFeed();
  loadLiveCounters();

  requestAnimationFrame(() => {
    document.body.classList.add("loaded");
  });
}

let reloaded = false;

window.addEventListener("online", () => {
  if (reloaded) return;

  const pending = JSON.parse(localStorage.getItem("pendingUploads") || "[]");

  if (pending.length > 0) {
    reloaded = true;

    showToast("Internet vraćen — pokušavam upload 📡");

    setTimeout(() => {
      location.reload();
    }, 1500);
  }
});

initApp();