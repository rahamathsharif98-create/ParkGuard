// Theme toggle
const btnTheme = document.getElementById("btnTheme");
const themeLabel = document.getElementById("themeLabel");
const yearEl = document.getElementById("year");

yearEl.textContent = new Date().getFullYear();

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pg_theme", theme);
  themeLabel.textContent = theme === "light" ? "Dark" : "Light";
}

const savedTheme = localStorage.getItem("pg_theme");
setTheme(savedTheme || "dark");

btnTheme?.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
});

// Animated counters
function animateCount(el, target, duration = 900) {
  const start = 0;
  const startTime = performance.now();

  function tick(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const val = Math.floor(start + (target - start) * (1 - Math.pow(1 - p, 3))); // easeOutCubic
    el.textContent = val;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const counters = document.querySelectorAll("[data-count]");
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      const el = e.target;
      const target = parseInt(el.getAttribute("data-count"), 10);
      animateCount(el, target);
      observer.unobserve(el);
    }
  });
}, { threshold: 0.4 });

counters.forEach((c) => observer.observe(c));
