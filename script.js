import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { 
  getFirestore, onSnapshot, orderBy, doc, setDoc, addDoc, collection, 
  getDoc, getDocs, query, where, deleteDoc, updateDoc, increment, limit 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytesResumable, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

/* ===== FIREBASE KONFIGURACIJA ===== */
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

let currentUser = localStorage.getItem("userName") || "";
let pressTimer; 
let tapTimer = null;

/* ===== INICIJALIZACIJA ===== */
window.onload = () => {
    if (currentUser) {
        document.getElementById("welcome").innerText = currentUser;
        document.getElementById("loginScreen").classList.remove("active");
        document.getElementById("appScreen").classList.add("active");
        loadLiveCounters();
        loadFeed();
    }
};

window.enterApp = function () {
  const nameInput = document.getElementById("userName");
  const name = nameInput.value.trim();
  if (!name) return showToast("Unesi svoje ime 🕊️");

  currentUser = name;
  localStorage.setItem("userName", name);
  
  document.getElementById("welcome").innerText = name;
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("appScreen").classList.add("active");
  
  loadLiveCounters();
  loadFeed();
};

/* ===== 1. & 2. KLIK (FULLSCREEN) I DOUBLE-TAP (LIKE) ===== */
function setupInteractions(card, photoData) {
  const img = card.querySelector("img");
  let lastTap = 0;

  // Touch/Click logika za mobitele i PC
  img.addEventListener('click', (e) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if ((now - lastTap) < DOUBLE_PRESS_DELAY) {
      // DOUBLE TAP -> LIKE
      clearTimeout(tapTimer);
      doLike(photoData.id, card);
    } else {
      // SINGLE TAP -> FULLSCREEN (sa malom odgodom)
      tapTimer = setTimeout(() => {
        openFullscreen(photoData.url);
      }, DOUBLE_PRESS_DELAY);
    }
    lastTap = now;
  });
}

function openFullscreen(url) {
  const overlay = document.createElement("div");
  overlay.className = "fullscreen-overlay active";
  overlay.innerHTML = `
    <div class="close-fs" onclick="this.parentElement.remove()">✕</div>
    <img src="${url}" style="max-width:100%; max-height:100vh; object-fit:contain;">
  `;
  overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

/* ===== 3. LONG PRESS ZA BRISANJE (Samo na "Moje Slike") ===== */
function setupLongPress(card, photoId) {
  const start = (e) => {
    pressTimer = setTimeout(() => {
      confirmDeletion(photoId);
    }, 800);
  };
  const stop = () => clearTimeout(pressTimer);

  card.addEventListener('mousedown', start);
  card.addEventListener('touchstart', start);
  card.addEventListener('mouseup', stop);
  card.addEventListener('mouseleave', stop);
  card.addEventListener('touchend', stop);
}

async function confirmDeletion(id) {
    if (confirm("Želiš li trajno ukloniti ovu sliku iz galerije?")) {
        try {
            await updateDoc(doc(db, "photos", id), { visible: false });
            showToast("Slika uklonjena");
            loadMyImages(); // Osvježi profil
        } catch (e) {
            console.error(e);
        }
    }
}

/* ===== 4. UPLOAD (SLIKE I POSVETE) ===== */
window.uploadFile = async function(files) {
  if (!files.length) return;
  
  const label = document.querySelector(".upload-label");
  const text = document.querySelector(".upload-text");
  
  label.style.opacity = "0.5";
  text.innerText = "Slanje u oblake...";

  for (let file of files) {
    const fileName = `${Date.now()}_${currentUser}_${file.name}`;
    const storageRef = ref(storage, `photos/${fileName}`);
    
    try {
        const uploadTask = await uploadBytesResumable(storageRef, file);
        const url = await getDownloadURL(uploadTask.ref);
        
        await addDoc(collection(db, "photos"), {
            url: url,
            user: currentUser,
            likes: 0,
            visible: true,
            timestamp: new Date()
        });
    } catch (err) {
        showToast("Greška pri uploadu!");
    }
  }

  text.innerText = "Uspješno poslano! ✨";
  label.style.opacity = "1";
  setTimeout(() => { text.innerText = "Odaberi slike"; }, 3000);
  loadFeed(); 
};

window.saveDedication = async function() {
  const input = document.getElementById("dedicationText");
  const msg = input.value.trim();
  
  if (!msg) return showToast("Napiši nešto lijepo... ✍️");

  await addDoc(collection(db, "dedications"), {
    text: msg,
    user: currentUser,
    timestamp: new Date()
  });

  input.value = "";
  showToast("Posveta spremljena! 🤍");
};

/* ===== FIREBASE OPTIMIZACIJA (Štednja budžeta) ===== */
async function loadLiveCounters() {
  // Umjesto onSnapshot (koji troši stalno), ovo zovemo samo pri ulasku
  const photoSnap = await getDocs(query(collection(db, "photos"), where("visible", "==", true)));
  const dedSnap = await getDocs(collection(db, "dedications"));
  
  document.getElementById("livePhotoCount").innerText = photoSnap.size;
  document.getElementById("liveDedicationCount").innerText = dedSnap.size;
}

async function loadFeed() {
  const container = document.getElementById("feedContainer");
  container.innerHTML = "<p style='text-align:center; opacity:0.5;'>Učitavam uspomene...</p>";

  const q = query(
      collection(db, "photos"), 
      where("visible", "==", true), 
      orderBy("timestamp", "desc"), 
      limit(50) // Limitiramo na 50 slika radi brzine i uštede
  );

  const querySnapshot = await getDocs(q);
  container.innerHTML = "";

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    data.id = docSnap.id;
    const card = createPhotoCard(data);
    container.appendChild(card);
    setupInteractions(card, data);
  });
}

async function loadMyImages() {
    const container = document.getElementById("gallery");
    container.innerHTML = "";
    
    const q = query(collection(db, "photos"), where("user", "==", currentUser), where("visible", "==", true));
    const snap = await getDocs(q);

    snap.forEach(docSnap => {
        const data = docSnap.data();
        data.id = docSnap.id;
        const card = createPhotoCard(data);
        container.appendChild(card);
        setupLongPress(card, data.id);
    });
}

function createPhotoCard(data) {
  const div = document.createElement("div");
  div.className = "feed-card";
  div.innerHTML = `
    <img src="${data.url}" loading="lazy" onload="this.classList.add('loaded')">
    <div class="card-info">
      <span class="author">👤 ${data.user}</span>
      <span class="likes-count">❤️ ${data.likes || 0}</span>
    </div>
  `;
  return div;
}

async function doLike(id, card) {
  const storageKey = `liked_${id}`;
  if (localStorage.getItem(storageKey)) return;

  const docRef = doc(db, "photos", id);
  await updateDoc(docRef, { likes: increment(1) });
  localStorage.setItem(storageKey, "true");

  // Srce animacija
  const heart = document.createElement("div");
  heart.className = "big-heart";
  heart.innerHTML = "❤️";
  card.appendChild(heart);
  setTimeout(() => heart.remove(), 800);

  // Update brojača na ekranu
  const countEl = card.querySelector(".likes-count");
  let current = parseInt(countEl.innerText.replace("❤️ ", ""));
  countEl.innerText = `❤️ ${current + 1}`;
}

/* ===== POMOĆNE FUNKCIJE ===== */
window.switchScreen = function (screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(screenId + "Tab").classList.add("active");
  
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  event.currentTarget.classList.add("active");

  if (screenId === "profile") loadMyImages();
  if (screenId === "home") loadFeed();
};

function showToast(text) {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerText = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

window.checkAdmin = function () {
  const pass = document.getElementById("adminPass").value;
  if (pass === "admin123") { // Promijeni ovo!
    window.location.href = "admin.html";
  } else {
    alert("Kriva lozinka!");
  }
};