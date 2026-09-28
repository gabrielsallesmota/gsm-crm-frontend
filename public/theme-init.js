/* global localStorage, document */
// Tema salvo aplicado antes do primeiro paint (ver index.html). Arquivo
// estático, não script inline, para o CSP usar só `script-src 'self'`.
try {
  var saved = localStorage.getItem("gsm_theme");
  document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
} catch {
  document.documentElement.setAttribute("data-theme", "light");
}
