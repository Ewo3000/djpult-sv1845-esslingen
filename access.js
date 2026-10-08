// Einfache Zugangsabfrage (nur eine Huerde fuer Gelegenheitsnutzer, kein echter Schutz).
// Gespeichert wird nur ein Fingerabdruck des Passworts; die Freigabe gilt nur, solange die App offen ist.
// Passwort aendern: neuen Hash berechnen (SHA-256 von "djpult|" + Passwort in Kleinbuchstaben) und hier eintragen.
(function () {
  const ACCESS_HASH = "e5796329975a27fdfb429e2d527675e2bcebe2e5135cb24126c3e8b8c6fa4798";
  const STORE_KEY = "djpultAccess";

  const read = () => {
    try {
      return sessionStorage.getItem(STORE_KEY);
    } catch (err) {
      return null;
    }
  };
  if (read() === ACCESS_HASH) return;
  if (!(window.crypto && window.crypto.subtle)) return; // ohne sicheren Kontext nicht pruefbar, App nicht aussperren

  const overlay = document.createElement("div");
  overlay.id = "access-gate";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;overflow:auto;display:flex;background:#111827;color:#f9fafb;" +
    "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:1rem;";
  const muted = "color:#9ca3af;";
  overlay.innerHTML =
    '<div style="margin:auto;width:100%;max-width:23rem;text-align:center;display:flex;flex-direction:column;gap:0.8rem;">' +
    '<img src="static/images/thumbnail_logo.png" alt="" style="height:4.5rem;margin:0 auto;" />' +
    '<div><div style="font-size:1.5rem;font-weight:700;">DJ Pult</div>' +
    '<div style="font-size:0.95rem;' + muted + 'margin-top:0.2rem;">Volleyball-DJ-Pult von SV 1845 Esslingen</div>' +
    '<div style="font-size:0.85rem;' + muted + '">von Thimo Ludwig</div></div>' +
    '<form id="access-form" style="display:flex;flex-direction:column;gap:0.6rem;margin-top:0.4rem;">' +
    '<div style="font-size:0.95rem;">Bitte Passwort eingeben</div>' +
    '<input id="access-input" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
    'style="font-size:1.1rem;padding:0.7rem 0.8rem;border-radius:0.6rem;border:1px solid #4b5563;background:#1f2937;color:#fff;text-align:center;" />' +
    '<div id="access-error" style="min-height:1.2rem;font-size:0.9rem;color:#f87171;"></div>' +
    '<button type="submit" style="font-size:1.1rem;font-weight:600;padding:0.7rem;border-radius:0.6rem;border:0;background:#2563eb;color:#fff;">Öffnen</button>' +
    "</form>" +
    '<div style="text-align:left;font-size:0.85rem;line-height:1.45;background:#1f2937;border-radius:0.6rem;padding:0.7rem 0.9rem;">' +
    '<div style="font-weight:600;margin-bottom:0.3rem;">Kurz erklärt</div>' +
    '<ol style="margin:0;padding-left:1.2rem;list-style:decimal;' + muted + '">' +
    "<li>Passwort eingeben und auf „Öffnen“ tippen.</li>" +
    "<li>Auf „Songs laden“ tippen und den Ordner „Diesen Ordner Laden“ wählen.</li>" +
    "<li>Song antippen zum Abspielen. Die ganze Anleitung steht unter „Info“.</li>" +
    "</ol></div>" +
    '<div style="font-size:0.85rem;' + muted + '">Bei Problemen wende dich an Thimo.</div>' +
    '<div id="access-version" style="font-size:0.75rem;color:#6b7280;"></div>' +
    "</div>";
  document.documentElement.appendChild(overlay);

  const hash = async (text) => {
    const bytes = new TextEncoder().encode("djpult|" + text.trim().toLowerCase());
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const form = overlay.querySelector("#access-form");
  const input = overlay.querySelector("#access-input");
  const error = overlay.querySelector("#access-error");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = await hash(input.value);
    if (value === ACCESS_HASH) {
      try {
        sessionStorage.setItem(STORE_KEY, ACCESS_HASH);
      } catch (err) {
        /* ignorieren */
      }
      overlay.remove();
    } else {
      error.textContent = "Falsches Passwort";
      input.value = "";
      input.focus();
    }
  });
  setTimeout(() => input.focus(), 50);
  // Version steht erst nach dem Laden von version.js zur Verfuegung
  document.addEventListener("DOMContentLoaded", () => {
    const el = overlay.querySelector("#access-version");
    if (el && typeof APP_VERSION !== "undefined") el.textContent = "Version " + APP_VERSION;
  });
})();
