window.enterApp = function () {
  const name = document.getElementById("name").value.trim();

  if (!name) {
    alert("Upiši ime i prezime");
    return;
  }

  let userId = localStorage.getItem("userId");

  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("userId", userId);
  }

  localStorage.setItem("name", name);

  window.location.href = "/app.html";
};