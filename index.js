// ==============================
// ⚡ PERFORMANCE TIMER
// ==============================
const t0 = performance.now();
function logTime(label) {
  const t = (performance.now() - t0).toFixed(1);
  console.log(`⏱️ ${label}: ${t}ms`);
}

// ==============================
// 🔗 EVENT ID
// ==============================
const eventId = new URLSearchParams(location.search).get("event");

// ==============================
// 🌍 GLOBAL STATE
// ==============================
let eventData = null;

// ==============================
// 🎯 ELEMENTI
// ==============================
const titleEl = document.getElementById("eventTitle");
const headingEl = document.getElementById("eventHeading");
const subtitleEl = document.getElementById("eventSubtitle");
const container = document.querySelector(".floating-container");

// ==============================
// 🧠 SUBTITLE
// ==============================
function getSubtitle(type) {
  switch(type) {
    case "svadba": return "Dobrodošli na našu svadbu 💍";
    case "rodendan": return "Dobrodošli na rođendan 🎂";
    case "krstenje": return "Dobrodošli na krštenje ✨";
    case "pricest": return "Dobrodošli na pričest ✝️";
    case "party": return "Dobrodošli na party 🎉";
    default: return "Podijelite uspomene 📸";
  }
}

// ==============================
// 🫧 BUBBLES
// ==============================
let bubblesRendered = false;

function renderBubbles(images) {
  if (bubblesRendered) return;
  if (!images || !images.length) return;

  bubblesRendered = true;
  container.innerHTML = "";

  images.forEach((src) => {
    const el = document.createElement("div");
    el.className = "bubble";

    const img = document.createElement("img");
    img.src = src;

    el.appendChild(img);
    container.appendChild(el);

    let x = Math.random() * (window.innerWidth - 90);
    let y = Math.random() * (window.innerHeight - 90);

    let dx = (Math.random() - 0.5) * 0.5;
    let dy = (Math.random() - 0.5) * 0.5;

    function move() {
      x += dx;
      y += dy;

      if (x <= 0 || x >= window.innerWidth - 90) dx *= -1;
      if (y <= 0 || y >= window.innerHeight - 90) dy *= -1;

      el.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(move);
    }

    move();
  });

  logTime("Bubbles render");
}
function formatText(text) {
  if (!text) return "";

  return text
    .split("\n")
    .map(line => line.trim())
    .map(line => line ? `<p>${line}</p>` : `<br>`)
    .join("");
}
// ==============================
// 🎨 APPLY EVENT (centralno)
// ==============================
function applyEvent(event) {
  if (!event) return;

  eventData = event;

  // ==============================
  // 🎨 THEME
  // ==============================
  document.body.classList.remove(
    "theme-svadba",
    "theme-rodendan",
    "theme-krstenje",
    "theme-pricest",
    "theme-party"
  );

  if (event.type) {
    document.body.classList.add("theme-" + event.type);
  }

  // ==============================
  // 🧠 FALLBACK TEXTS
  // ==============================
const defaultTexts = {
  index_title: event.title || "PhotoDump",
  index_subtitle: getSubtitle(event.type || "default")
};

  // ==============================
  // 📝 INDEX TEKSTOVI (DB → fallback)
  // ==============================
  const indexTitle =
    event.texts?.index?.title || defaultTexts.index_title;

  const indexSubtitle =
    event.texts?.index?.subtitle || defaultTexts.index_subtitle;

  // ==============================
  // 🖥️ UI UPDATE
  // ==============================
  titleEl.innerText = event.title || "PhotoDump";
  headingEl.innerText = indexTitle;

  // ⚠️ HTML jer ima enter (formatText!)
  subtitleEl.innerHTML = formatText(indexSubtitle);

  // ==============================
  // 🌐 TITLE (tab)
  // ==============================
  document.title = (event.title || "PhotoDump") + " | PhotoDump";

  // ==============================
  // 🫧 BUBBLES
  // ==============================
  if (event.bubbles && event.bubbles.length) {
    bubblesRendered = false; // reset ako dolazi novi event
    renderBubbles(event.bubbles);
  }

  console.log("✅ Event applied", event);
}

// ==============================
// ⚡ BOOT FROM CACHE
// ==============================
function bootFromCache() {
  if (!eventId) return false;

  const cached = localStorage.getItem("eventData_" + eventId);
  if (!cached) return false;

  try {
    const event = JSON.parse(cached);
    applyEvent(event);

    console.log("⚡ Boot from cache");
    logTime("Cache render");

    return true;
  } catch {
    return false;
  }
}

// ==============================
// 🚀 AUTO LOGIN
// ==============================
function tryAutoLogin() {
  const savedName = localStorage.getItem("name");
  const savedUserId = localStorage.getItem("userId");
  const savedEvent = localStorage.getItem("eventId");

  if (savedName && savedUserId && savedEvent === eventId) {
    console.log("🚀 Auto login");

    setTimeout(() => {
      window.location.href = "/app.html?event=" + eventId;
    }, 80);
  }
}

// ==============================
// 🔵 FIREBASE (background sync)
// ==============================
async function fetchEvent() {
  if (!eventId) return;

  logTime("Start Firebase");

  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js");
    const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js");

    const app = initializeApp({
      apiKey: "AIzaSyBjETOqGf9zNxWO7DB7QokoHu_duiqM8Jg",
      authDomain: "photodumpevent-4578c.firebaseapp.com",
      projectId: "photodumpevent-4578c"
    });

    const db = getFirestore(app);
    const snap = await getDoc(doc(db, "events", eventId));

    if (!snap.exists()) return;

    const event = snap.data();

    // 🔥 cache update
    localStorage.setItem("eventData_" + eventId, JSON.stringify(event));

    // 🔥 ako nije bilo cache-a → sad primijeni
    if (!eventData) {
      applyEvent(event);
    }

    logTime("Firebase loaded");

  } catch (err) {
    console.log("Firebase error", err);
  }
}

// ==============================
// 🥇 FALLBACK
// ==============================
function renderFallback() {
  titleEl.innerText = "Dobrodošli";
  headingEl.innerText = "PhotoDump";
  subtitleEl.innerText = "Učitavanje...";
}

// ==============================
// 🚀 START
// ==============================
const booted = bootFromCache();

if (!booted) {
  renderFallback();
}

tryAutoLogin();

// 🔥 uvijek sync u pozadini
setTimeout(fetchEvent, 100);

// ==============================
// ✅ FINAL
// ==============================
window.addEventListener("load", () => {
  document.body.classList.add("loaded");
  logTime("Page loaded");
});