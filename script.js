import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, onSnapshot, orderBy, doc, setDoc, addDoc, collection, getDoc, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

/* ===== FIREBASE ===== */
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
const storage = getStorage(app);

/* ===== ENTER APP ===== */
window.enterApp = function () {
  const name = document.getElementById("name").value.trim();

  if (!name) {
    alert("Upiši ime i prezime");
    return;
  }

  const userId = Date.now().toString();

  localStorage.setItem("userId", userId);
  localStorage.setItem("name", name);

  createUser(userId, name);

  window.location.href = "app.html";
};

/* ===== LIVE FEED ===== */
function loadFeed() {
  const feed = document.getElementById("feed");
  if (!feed) return;

  const q = query(
    collection(db, "photos"),
    orderBy("created", "desc")
  );

  let isFirstLoad = true;

  onSnapshot(q, (snapshot) => {

    if (isFirstLoad) {
      // 🔥 PRVI PUT – učitaj sve
      feed.innerHTML = "";

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.visible === false) return;

        const img = document.createElement("img");
        img.src = data.imageUrl;

        img.addEventListener("click", () => {
          openFullscreen(data.imageUrl);
        });

        feed.appendChild(img);
      });

      isFirstLoad = false;
      return;
    }

    // 🔥 POSLIJE – samo nove slike
    snapshot.docChanges().forEach((change) => {

      if (change.type === "added") {
        const data = change.doc.data();
        if (data.visible === false) return;

        const img = document.createElement("img");
        img.src = data.imageUrl;

        img.addEventListener("click", () => {
          openFullscreen(data.imageUrl);
        });

        // 👉 nova ide na vrh
        feed.prepend(img);
      }

    });

  });
}

/* ===== DELETE ===== */
let selectedPhotoId = null;

window.confirmDelete = async function () {
  document.getElementById("deleteModal").style.display = "none";

  const docRef = doc(db, "photos", selectedPhotoId);

  // 🔥 BRŽE
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
  loadMyImages();
};

window.closeDelete = function () {
  document.getElementById("deleteModal").style.display = "none";
};

/* ===== FULLSCREEN ===== */
function openFullscreen(url) {
  const full = document.createElement("div");

  full.style.cssText = `
    position:fixed;
    top:0;left:0;
    width:100%;height:100%;
    background:rgba(0,0,0,0.9);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:999;
  `;

  const img = document.createElement("img");
  img.src = url;
  img.style.maxWidth = "90%";
  img.style.maxHeight = "90%";

  full.appendChild(img);
  full.onclick = () => full.remove();

  document.body.appendChild(full);
}

/* ===== PUBLIC GALLERY ===== */
window.openGallery = async function () {
  document.getElementById("galleryModal").style.display = "flex";

  const gallery = document.getElementById("publicGallery");
  gallery.innerHTML = "Učitavanje...";

  const snapshot = await getDocs(collection(db, "photos"));
  gallery.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();

    if (data.visible === false) return;
    if (data.type === "video") return;

    const img = document.createElement("img");
    img.src = data.imageUrl;
    img.onclick = () => openFullscreen(data.imageUrl);

    gallery.appendChild(img);
  });
};

window.closeGallery = function () {
  document.getElementById("galleryModal").style.display = "none";
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

/* ===== UPLOAD ===== */
window.uploadToFirebase = function (file, user, onProgress) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, 'photos/' + Date.now() + '_' + file.name);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(percent);
      },
      reject,
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);

        await addDoc(collection(db, "photos"), {
          imageUrl: url,
          user: user,
          userId: localStorage.getItem("userId"),
          created: Date.now() // 🔥 FIX
        });

        resolve(url);
      }
    );
  });
};

/* ===== ADMIN ===== */
let clickCount = 0;

window.secretAdminClick = function () {
  clickCount++;

  if (clickCount === 3) {
    openAdminModal();
    clickCount = 0;
  }

  setTimeout(() => clickCount = 0, 1000);
};

window.openAdminModal = function () {
  document.getElementById("adminModal").style.display = "flex";
};

window.closeAdminModal = function () {
  document.getElementById("adminModal").style.display = "none";
};

/* sigurniji click */
window.addEventListener("click", function (e) {
  const modal = document.getElementById("adminModal");
  if (e.target === modal) modal.style.display = "none";
});

/* ===== DEDICATION ===== */
window.saveDedication = async function () {
  const text = document.getElementById("dedicationText").value.trim();
  const name = localStorage.getItem("name");

  if (!text) {
    alert("Napiši poruku za Niku 🤍");
    return;
  }

  await addDoc(collection(db, "dedications"), {
    name,
    text,
    created: Date.now() // 🔥 FIX
  });

  document.getElementById("dedicationText").value = "";
  showSuccessModal();
};

window.showSuccessModal = function () {
  document.getElementById("successModal").style.display = "flex";
};

window.closeSuccessModal = function () {
  document.getElementById("successModal").style.display = "none";
};

/* ===== PROFILE ===== */
window.loadMyImages = async function () {
  const gallery = document.getElementById("gallery");
  const name = localStorage.getItem("name");

  if (!gallery) return;

  gallery.innerHTML = "<p style='grid-column:1/-1; opacity:0.6;'>Učitavam...</p>";

  try {
    const q = query(
      collection(db, "photos"),
      where("user", "==", name)
    );

    const snapshot = await getDocs(q);

    gallery.innerHTML = "";

    if (snapshot.empty) {
      gallery.innerHTML = "<p style='grid-column:1/-1; opacity:0.6;'>Nema još tvojih slika 📸</p>";
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const img = document.createElement("img");
      img.src = data.imageUrl;

      let pressTimer;
      let isLongPress = false;

      /* ===== TOUCH START ===== */
      img.addEventListener("touchstart", () => {
        isLongPress = false;

        pressTimer = setTimeout(() => {
          isLongPress = true;
          selectedPhotoId = docSnap.id;

          document.getElementById("deleteModal").style.display = "flex";

          // 🔥 optional vibracija
          if (navigator.vibrate) navigator.vibrate(50);
        }, 700);
      });

      /* ===== TOUCH END ===== */
      img.addEventListener("touchend", () => {
        clearTimeout(pressTimer);
      });

      /* ===== CLICK ===== */
      img.addEventListener("click", () => {
        if (!isLongPress) {
          openFullscreen(data.imageUrl);
        }
      });

      /* ===== CANCEL ===== */
      img.addEventListener("touchmove", () => clearTimeout(pressTimer));
      img.addEventListener("mouseleave", () => clearTimeout(pressTimer));

      gallery.appendChild(img);
    });

  } catch (err) {
    console.error(err);
    gallery.innerHTML = "<p style='grid-column:1/-1;'>Greška pri učitavanju</p>";
  }
};

/* ===== USER ===== */
const user = localStorage.getItem("name");
const welcomeEl = document.getElementById("welcome");

if (!user && !window.location.pathname.includes("index.html")) {
  window.location.href = "index.html";
}

if (user && welcomeEl) {
  welcomeEl.innerText = "Pozdrav, " + user;
}

/* ===== CREATE USER ===== */
window.createUser = async function (id, name) {
  await setDoc(doc(db, "users", id), {
    name,
    created: Date.now()
  });
};

/* ===== FILE UPLOAD ===== */
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

    const task = compressImage(file).then((compressedFile) => {

      return uploadToFirebase(compressedFile, user, (percent) => {
        progress.style.width = percent + "%";
      }).then((url) => {
        img.src = url;
        progress.remove();
      });

    });

    uploads.push(task);
  }

  // 🔥 čekaj sve uploadove
  await Promise.all(uploads);

  // 🔥 prebaci na profile
  switchScreen("profile");

  // 🔥 refresha galeriju
  loadMyImages();

  showToast("Upload završen 🤍");
};

function loadLiveCounters() {

  const photoEl = document.getElementById("livePhotoCount");
  const dedicationEl = document.getElementById("liveDedicationCount");

  if (!photoEl || !dedicationEl) return;

  onSnapshot(collection(db, "photos"), (snapshot) => {
    photoEl.innerText = snapshot.size;
  });

  onSnapshot(collection(db, "dedications"), (snapshot) => {
    dedicationEl.innerText = snapshot.size;
  });
}

async function compressImage(file) {

  return new Promise((resolve) => {

    const reader = new FileReader();
    const img = new Image();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {

      let width = img.width;
      let height = img.height;

      const maxWidth = 1600;

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

      }, "image/jpeg", 0.8);

    };

    reader.readAsDataURL(file);
  });
}

/* ===== ADMIN LOGIN ===== */
window.checkAdmin = function () {
  const pass = document.getElementById("adminPass").value;

  if (pass === "admin") {
    window.location.href = "admin.html";
  } else {
    alert("Kriva šifra");
  }
};

/* ===== TOAST ===== */
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 2000);
}

/* ===== AUTO LOAD ===== */
if (document.getElementById("feed")) {
  loadFeed();
  loadLiveCounters();
}