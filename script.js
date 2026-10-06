let audioEl = null; // zentrales Audio-Element fuer alle Plattformen
let audioCtx = null; // Web Audio Kontext (fuer iOS/Volume/Fade)
let gainNode = null; // Gain fuer Volume/Fade
let mediaElementSource = null; // MediaElementSource fuer das zentrale Audio
let currentAudio = null;
let volumeLevel = 1.0;
let fadeIntervalId = null;
let nowPlaying = { title: "", duration: 0, category: null };
let nowPlayingEls = { box: null, title: null, eta: null, elapsed: null, bar: null };
let nowPlayingId = null; // ID des laufenden Songs (fuer die Hervorhebung im Raster)
const NOW_PLAYING_WARNING_THRESHOLD = 10; // Sekunden
let songPlayCounts = {};
let zoomLevel = 0.9;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.2;
const ZOOM_STEP = 0.05;
let zoomEls = { level: null, inBtn: null, outBtn: null };
let infoEls = { panel: null, toggle: null };
let searchTerm = "";
let searchEls = { input: null, count: null };
let headerEls = { block: null, toggle: null };

const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes("Mac") && "ontouchend" in document);

const categories = {
  ass_angriff: { title: "Ass/Angriff", color: "bg-blue-600", baseHSL: [217, 83, 57], items: [] }, // Tailwind blue-600
  block: { title: "Block", color: "bg-pink-600", baseHSL: [336, 81, 62], items: [] }, // Tailwind pink-600
  gegner: { title: "Gegner", color: "bg-red-600", baseHSL: [0, 72, 52], items: [] }, // Tailwind red-600
  sonstiges: { title: "Sonstiges 1", color: "bg-green-600", baseHSL: [142, 71, 45], items: [] }, // Tailwind green-600
  noch_mehr: { title: "Sonstiges 2", color: "bg-green-600", baseHSL: [142, 71, 45], items: [] }, // Tailwind green-600
  noch_mehr2: { title: "Sonstiges 3", color: "bg-green-600", baseHSL: [142, 71, 45], items: [] }, // Tailwind green-600
  spass: { title: "Lustig", color: "bg-purple-600", baseHSL: [271, 81, 56], items: [] }, // Tailwind purple-600
};

const specialTracks = {
  timeout: null,
  walkon: null,
  pauses: [],
};

const remoteCategories = ["ass_angriff", "block", "spass", "sonstiges", "noch_mehr", "noch_mehr2"];

const rtcState = {
  pc: null,
  channel: null,
  offerCandidates: [],
  status: "disconnected",
  ui: {},
  scanner: { stream: null, frameReq: null, video: null, canvas: null, ctx: null },
};

function cleanName(filename) {
  return filename
    .replace(/_BLOCK/i, "")
    .replace(/_HIT/i, "")
    .replace(/_ACE/i, "")
    .replace(/_OPP/i, "")
    .replace(/_FUN/i, "")
    .replace(/_TIMEOUT/i, "")
    .replace(/_WALKON/i, "")
    .replace(/_PAUSE\d*/i, "")
    .replace(/\.(mp3|flac|wav|ogg)$/i, "")
    .trim();
}

function revokeAllSongUrls() {
  const urls = [];
  Object.values(categories).forEach((cat) => cat.items.forEach((song) => urls.push(song.url)));
  [specialTracks.timeout, specialTracks.walkon, ...specialTracks.pauses].forEach((track) => {
    if (track && track.url) urls.push(track.url);
  });
  urls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (err) {
      /* ignorieren */
    }
  });
}

function resetCategories() {
  revokeAllSongUrls();
  Object.values(categories).forEach((cat) => {
    cat.items = [];
  });
  specialTracks.timeout = null;
  specialTracks.walkon = null;
  specialTracks.pauses = [];
}

function handleFiles(fileList) {
  // Laufenden Song vor dem Freigeben der alten Dateiverweise sauber beenden
  if (currentAudio) stopAudio(true);
  loadPlayCounts();
  resetCategories();
  const files = Array.from(fileList || []);
  let toggle = 0;

  const marksFiles = [];

  files.forEach((file) => {
    if (MARKS_FILE_PATTERN.test(file.name)) {
      marksFiles.push(file);
      return;
    }
    const relPath = file.webkitRelativePath || file.name;
    const isAudio =
      (file.type && file.type.startsWith("audio/")) ||
      /\.(mp3|flac|wav|ogg)$/i.test(file.name);
    if (!isAudio) return;

    const inSpecial = /(^|[\\/])special_music[\\/]/i.test(relPath);
    const upper = file.name.toUpperCase();

    if (inSpecial) {
      let key = null;
      if (upper.includes("_TIMEOUT")) key = "timeout";
      else if (upper.includes("_WALKON")) key = "walkon";
      else if (/_PAUSE\d+/i.test(upper)) key = "pause";

      if (key === "pause") {
        const match = upper.match(/_PAUSE(\d+)/);
        const number = match ? parseInt(match[1], 10) : specialTracks.pauses.length + 1;
        specialTracks.pauses.push({
          name: file.name,
          display: cleanName(file.name),
          number,
          url: URL.createObjectURL(file),
        });
      } else if (key) {
        specialTracks[key] = {
          name: file.name,
          display: cleanName(file.name),
          url: URL.createObjectURL(file),
        };
      }
      return; // Spezial-Songs nicht in Kategorien einsortieren
    }

    let key;
    if (upper.includes("_HIT") || upper.includes("_ACE")) key = "ass_angriff";
    else if (upper.includes("_BLOCK")) key = "block";
    else if (upper.includes("_OPP")) key = "gegner";
    else if (upper.includes("_FUN")) key = "spass";
    else {
      const miscKeys = ["sonstiges", "noch_mehr", "noch_mehr2"];
      key = miscKeys[toggle % miscKeys.length];
      toggle += 1;
    }

    categories[key].items.push({
      id: file.name, // stabile ID fuer Counter/Storage
      name: file.name,
      display: cleanName(file.name),
      category: key,
      url: URL.createObjectURL(file),
    });
  });

  renderCategories();
  updateSpecialButtons();
  collapseHeader();
  sendSongsListToRemote();
  resetPageScroll();
  if (marksFiles.length) loadNewestMarksFile(marksFiles);
}

// Nach Dateiauswahl/Layoutwechsel kann Safari die Seite nach oben/unten verschoben lassen.
function resetPageScroll() {
  const reset = () => window.scrollTo(0, 0);
  reset();
  setTimeout(reset, 150);
  setTimeout(reset, 500);
}

function getAudioElement() {
  if (audioEl) return audioEl;
  const existing = document.getElementById("dj-audio");
  if (existing) {
    audioEl = existing;
  } else {
    const el = document.createElement("audio");
    el.id = "dj-audio";
    el.setAttribute("playsinline", "true");
    el.preload = "none";
    el.className = "hidden";
    document.body.appendChild(el);
    audioEl = el;
  }
  audioEl.setAttribute("playsinline", "true");
  return audioEl;
}

function ensureAudioGraph() {
  const el = getAudioElement();
  if (!el || typeof AudioContext === "undefined") return null;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!gainNode) {
    gainNode = audioCtx.createGain();
    gainNode.gain.value = volumeLevel;
  }
  if (!mediaElementSource) {
    mediaElementSource = audioCtx.createMediaElementSource(el);
    mediaElementSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);
  }
  return audioCtx;
}

// ---------------------------------------------------------------------------
// Markierungen: "Top-Stimmung" und "Mitklatschen"
// Gespeichert lokal im Browser (localStorage) und als Datei markierungen.json,
// die beim Laden des Musikordners automatisch eingelesen wird.
// ---------------------------------------------------------------------------
const MARK_GROUPS = {
  top: { label: "Top-Stimmung", short: "Top", symbol: "★" },
  clap: { label: "Mitklatschen", short: "Klatschen", symbol: "👏" },
  // Nur zum Merken (kein Zufall-Button):
  slow: { label: "Langer Aufbau", short: "Aufbau", symbol: "\u23F3" }, // Drop kommt spaet
  quiet: { label: "Zu leise", short: "Leise", symbol: "\uD83D\uDD08" }, // Lautstaerke nacharbeiten
};
const MARKS_KEY = "songMarks";
const MARKS_FILENAME = "markierungen.json";
const MARKS_FILE_PATTERN = /^markierungen.*\.json$/i; // auch "markierungen 2.json" usw.
const LONG_PRESS_MS = 600;
function emptyMarks() {
  const result = {};
  Object.keys(MARK_GROUPS).forEach((group) => {
    result[group] = new Set();
  });
  return result;
}

let marks = emptyMarks();
let marksDirty = false;
let marksTab = "all";
let marksSearch = "";

function loadMarks() {
  try {
    const raw = localStorage.getItem(MARKS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.keys(MARK_GROUPS).forEach((group) => {
      marks[group] = new Set(Array.isArray(data[group]) ? data[group] : []);
    });
    marksDirty = !!data.dirty;
  } catch (e) {
    console.warn("Konnte Markierungen nicht laden:", e);
  }
}

function saveMarks() {
  try {
    const stored = { dirty: marksDirty };
    Object.keys(MARK_GROUPS).forEach((group) => {
      stored[group] = [...marks[group]];
    });
    localStorage.setItem(MARKS_KEY, JSON.stringify(stored));
  } catch (e) {
    console.warn("Konnte Markierungen nicht speichern:", e);
  }
}

function marksToJson() {
  const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b, "de"));
  const out = { version: 1, saved: new Date().toISOString() };
  Object.keys(MARK_GROUPS).forEach((group) => {
    out[group] = sorted(marks[group]);
  });
  return JSON.stringify(out, null, 2);
}

function applyMarksData(data, mode) {
  if (!data || typeof data !== "object") throw new Error("Ungueltige Markierungsdatei");
  const clean = (list) => (Array.isArray(list) ? list.filter((x) => typeof x === "string") : []);
  Object.keys(MARK_GROUPS).forEach((group) => {
    const ids = clean(data[group]);
    if (mode === "merge") ids.forEach((id) => marks[group].add(id));
    else marks[group] = new Set(ids);
  });
}

// ---- Sicherheitsnetz: letzter Stand + Erinnerung ---------------------------
const MARKS_BACKUP_KEY = "songMarksBackup";
const MARKS_HINT_COOLDOWN_MS = 5 * 60 * 1000;
const MARKS_HINT_MIN_CHANGES = 3;
let marksUnsavedChanges = 0;
let marksHintShownAt = 0;
let marksHintTimer = null;

function marksCount(source = marks) {
  return Object.values(source).reduce((sum, set) => sum + set.size, 0);
}

function marksFromData(data) {
  const result = emptyMarks();
  Object.keys(MARK_GROUPS).forEach((group) => {
    if (data && Array.isArray(data[group])) {
      data[group].filter((x) => typeof x === "string").forEach((id) => result[group].add(id));
    }
  });
  return result;
}

function marksEqual(a, b) {
  return Object.keys(MARK_GROUPS).every(
    (group) => a[group].size === b[group].size && [...a[group]].every((id) => b[group].has(id))
  );
}

function readMarksBackup() {
  try {
    const raw = localStorage.getItem(MARKS_BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Merkt sich den aktuellen Stand (ein Platz), bevor er durch Zuruecksetzen/Einlesen ersetzt wird
function takeMarksBackup() {
  if (marksCount() === 0) return;
  try {
    const data = { savedAt: new Date().toISOString() };
    Object.keys(MARK_GROUPS).forEach((group) => {
      data[group] = [...marks[group]];
    });
    localStorage.setItem(MARKS_BACKUP_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Konnte Sicherheitskopie nicht speichern:", e);
  }
  updateRestoreButton();
}

function updateRestoreButton() {
  const btn = document.getElementById("marks-restore");
  const info = document.getElementById("marks-restore-info");
  if (!btn) return;
  const backup = readMarksBackup();
  btn.classList.toggle("hidden", !backup);
  if (info) info.classList.toggle("hidden", !backup);
  if (!backup) return;
  const count = marksCount(marksFromData(backup));
  const when = new Date(backup.savedAt);
  const time = isNaN(when)
    ? ""
    : when.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (info) info.textContent = `${count} Markierungen, Stand ${time}`;
}

function restoreMarksBackup() {
  const backup = readMarksBackup();
  if (!backup) return;
  const restored = marksFromData(backup);
  takeMarksBackup(); // aktueller Stand wird zur neuen Sicherheitskopie, so ist es umkehrbar
  marks = restored;
  marksDirty = true;
  afterMarksChangedBulk();
  showToast(`Letzter Stand wiederhergestellt: ${marksCount()} Markierungen.`, "info");
}

function hideMarksHint() {
  clearTimeout(marksHintTimer);
  const hint = document.getElementById("marks-hint");
  if (hint) hint.classList.remove("marks-hint-visible");
}

function showMarksHint() {
  marksHintShownAt = Date.now();
  let hint = document.getElementById("marks-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "marks-hint";
    hint.className = "marks-hint";
    hint.setAttribute("role", "status");
    const text = document.createElement("span");
    text.textContent = "Markierungen noch nicht gesichert";
    const save = document.createElement("button");
    save.textContent = "Sichern";
    save.addEventListener("click", () => {
      hideMarksHint();
      exportMarks();
    });
    const close = document.createElement("button");
    close.textContent = "\u2715";
    close.setAttribute("aria-label", "Hinweis schließen");
    close.addEventListener("click", hideMarksHint);
    hint.append(text, save, close);
    document.body.appendChild(hint);
  }
  const anchor = document.getElementById("marks-toggle");
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    hint.style.top = `${rect.bottom + 8}px`;
    hint.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
  }
  hint.classList.add("marks-hint-visible");
  clearTimeout(marksHintTimer);
  marksHintTimer = setTimeout(hideMarksHint, 9000);
}

function maybeShowMarksHint(force = false) {
  if (!marksDirty) return;
  if (!force && Date.now() - marksHintShownAt < MARKS_HINT_COOLDOWN_MS) return;
  const panel = document.getElementById("marks-panel");
  if (panel && !panel.classList.contains("hidden")) return; // Verwaltung offen: Sichern ist dort sichtbar
  if (document.getElementById("mark-menu")) return; // erst nach dem Menue
  showMarksHint();
}

function noteUnsavedChange() {
  marksUnsavedChanges += 1;
  if (marksUnsavedChanges >= MARKS_HINT_MIN_CHANGES) maybeShowMarksHint();
}

function getAllSongs() {
  return Object.values(categories).flatMap((cat) => cat.items);
}

function compareByDisplay(a, b) {
  return a.display.localeCompare(b.display, "de", { sensitivity: "base" });
}

function createMarksEl(id) {
  const symbols = Object.entries(MARK_GROUPS)
    .filter(([group]) => marks[group].has(id))
    .map(([, def]) => def.symbol);
  if (!symbols.length) return null;
  const el = document.createElement("span");
  el.className = "song-marks";
  el.setAttribute("aria-hidden", "true");
  el.textContent = symbols.join(" ");
  return el;
}

function updateSongMarks(id) {
  document.querySelectorAll(".song-button").forEach((btn) => {
    if (btn.dataset.songId !== id) return;
    const old = btn.querySelector(".song-marks");
    if (old) old.remove();
    const el = createMarksEl(id);
    if (el) btn.insertBefore(el, btn.querySelector(".song-count"));
  });
}

function refreshAllSongMarks() {
  const ids = new Set(getAllSongs().map((song) => song.id));
  ids.forEach(updateSongMarks);
}

function toggleMark(group, id) {
  if (marks[group].has(id)) marks[group].delete(id);
  else marks[group].add(id);
  marksDirty = true;
  saveMarks();
  updateSongMarks(id);
  updateMarksStatus();
  renderMarksPanel();
  noteUnsavedChange();
}

function updateMarksStatus() {
  if (!marksDirty) {
    marksUnsavedChanges = 0;
    hideMarksHint();
  }
  updateRestoreButton();
  const dot = document.getElementById("marks-dirty");
  if (dot) dot.classList.toggle("hidden", !marksDirty);
  const status = document.getElementById("marks-status");
  if (status) {
    status.textContent = marksDirty
      ? "Änderungen noch nicht gesichert"
      : "Gesichert / aus Datei geladen";
    status.classList.toggle("marks-status-dirty", marksDirty);
  }
}

// ---- Menue bei langem Druck auf einen Song --------------------------------
function closeMarkMenu() {
  const menu = document.getElementById("mark-menu");
  if (menu) menu.remove();
  document.removeEventListener("pointerdown", onMarkMenuOutside, true);
  if (menu && marksUnsavedChanges >= MARKS_HINT_MIN_CHANGES) maybeShowMarksHint();
}

function onMarkMenuOutside(event) {
  const menu = document.getElementById("mark-menu");
  if (menu && !menu.contains(event.target)) closeMarkMenu();
}

function openMarkMenu(song, anchor) {
  closeMarkMenu();
  const menu = document.createElement("div");
  menu.id = "mark-menu";
  menu.className = "mark-menu";

  const title = document.createElement("div");
  title.className = "mark-menu-title";
  title.textContent = song.display;
  menu.appendChild(title);

  Object.entries(MARK_GROUPS).forEach(([group, def]) => {
    const btn = document.createElement("button");
    btn.className = "mark-menu-btn";
    const refresh = () => {
      const on = marks[group].has(song.id);
      btn.classList.toggle("on", on);
      btn.textContent = `${def.symbol} ${def.label}${on ? "  ✓" : ""}`;
    };
    refresh();
    btn.addEventListener("click", () => {
      toggleMark(group, song.id);
      refresh();
    });
    menu.appendChild(btn);
  });

  const done = document.createElement("button");
  done.className = "mark-menu-done";
  done.textContent = "Fertig";
  done.addEventListener("click", closeMarkMenu);
  menu.appendChild(done);

  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 170) top = Math.max(60, rect.top - height - 6);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  setTimeout(() => document.addEventListener("pointerdown", onMarkMenuOutside, true), 0);
}

// ---- Verwaltungsfenster ----------------------------------------------------
function toggleMarksPanel() {
  const panel = document.getElementById("marks-panel");
  if (!panel) return;
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) {
    updateMarksStatus();
    renderMarksPanel();
  }
}

function makeMarkToggle(group, id) {
  const def = MARK_GROUPS[group];
  const btn = document.createElement("button");
  btn.className = "mark-toggle" + (marks[group].has(id) ? " on" : "");
  btn.textContent = `${def.symbol} ${def.short}`;
  btn.title = `${def.label} ${marks[group].has(id) ? "entfernen" : "hinzufügen"}`;
  btn.addEventListener("click", () => toggleMark(group, id));
  return btn;
}

function renderMarksPanel() {
  const panel = document.getElementById("marks-panel");
  if (!panel || panel.classList.contains("hidden")) return;
  const list = document.getElementById("marks-list");
  const scroll = list.scrollTop;
  list.innerHTML = "";

  const songs = getAllSongs();
  const byId = new Map(songs.map((song) => [song.id, song]));

  document.querySelectorAll("#marks-tabs [data-tab]").forEach((tab) => {
    const key = tab.dataset.tab;
    if (key === "all") {
      tab.textContent = `Alle Songs (${songs.length})`;
    } else {
      tab.textContent = `${MARK_GROUPS[key].symbol} ${MARK_GROUPS[key].label} (${marks[key].size})`;
    }
    tab.classList.toggle("active", key === marksTab);
  });
  const searchInput = document.getElementById("marks-search");
  if (searchInput) searchInput.classList.toggle("hidden", marksTab !== "all");

  let rows;
  if (marksTab === "all") {
    const term = marksSearch.trim().toLowerCase();
    rows = songs
      .filter((song) => !term || song.display.toLowerCase().includes(term))
      .map((song) => ({ id: song.id, display: song.display, song }));
  } else {
    rows = [...marks[marksTab]].map((id) => {
      const song = byId.get(id);
      return { id, display: song ? song.display : cleanName(id), song: song || null };
    });
  }
  rows.sort(compareByDisplay);

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "marks-empty";
    if (marksTab === "all") {
      empty.textContent = songs.length
        ? "Keine Songs gefunden."
        : "Noch keine Songs geladen. Zuerst „Songs laden“.";
    } else {
      empty.textContent =
        "Noch keine Songs in dieser Gruppe. Im Reiter „Alle Songs“ markieren oder einen Song im Pult lange drücken.";
    }
    list.appendChild(empty);
  }

  rows.forEach((row) => {
    const el = document.createElement("div");
    el.className = "marks-row" + (row.song ? "" : " missing");

    const play = document.createElement("button");
    play.className = "mark-play";
    play.textContent = "▶";
    play.title = "Kurz anspielen (zählt nicht mit)";
    if (row.song) {
      play.addEventListener("click", () => playAudio(row.song.url, row.song.display, null, null));
    } else {
      play.disabled = true;
    }

    const name = document.createElement("span");
    name.className = "marks-name";
    name.textContent = row.display;
    const note = document.createElement("span");
    note.className = "marks-note";
    if (!row.song) {
      note.textContent = " nicht geladen";
      name.appendChild(note);
    } else if (categories[row.song.category]) {
      // Kategorie als Hinweis, damit gleichnamige Songs unterscheidbar sind
      note.textContent = ` ${categories[row.song.category].title}`;
      name.appendChild(note);
    }

    const controls = document.createElement("span");
    controls.className = "marks-controls";
    Object.keys(MARK_GROUPS).forEach((group) => controls.append(makeMarkToggle(group, row.id)));
    if (marksTab !== "all") {
      // In den Gruppen-Reitern zusaetzlich: Song aus dieser Gruppe entfernen
      const remove = document.createElement("button");
      remove.className = "mark-remove";
      remove.textContent = "✕ Entfernen";
      remove.addEventListener("click", () => toggleMark(marksTab, row.id));
      controls.append(remove);
    }

    el.append(play, name, controls);
    list.appendChild(el);
  });
  list.scrollTop = scroll;
}

// ---- Sichern / Laden / Zuruecksetzen ---------------------------------------
async function exportMarks() {
  const file = new File([marksToJson()], MARKS_FILENAME, { type: "application/json" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      marksDirty = false;
      saveMarks();
      updateMarksStatus();
      showToast("In Dateien in den Musikordner sichern, dann ist alles gespeichert.", "info");
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return; // abgebrochen: weiterhin "nicht gesichert"
    console.warn("Teilen nicht moeglich, lade als Datei herunter:", err);
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = MARKS_FILENAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  marksDirty = false;
  saveMarks();
  updateMarksStatus();
  showToast("Datei heruntergeladen. In den Musikordner legen.", "info");
}

function afterMarksChangedBulk() {
  saveMarks();
  refreshAllSongMarks();
  updateMarksStatus();
  renderMarksPanel();
}

function markSummary() {
  const parts = Object.entries(MARK_GROUPS)
    .filter(([group]) => marks[group].size > 0)
    .map(([group, def]) => `${marks[group].size} ${def.label}`);
  return parts.length ? parts.join(", ") : "keine";
}

function importMarksFromText(text, source, extraInfo = "") {
  let data;
  try {
    data = JSON.parse(text);
    if (!marksDirty && !marksEqual(marks, marksFromData(data))) takeMarksBackup();
    applyMarksData(data, marksDirty ? "merge" : "replace");
  } catch (err) {
    console.error("Markierungsdatei unlesbar:", err);
    showToast("Markierungsdatei konnte nicht gelesen werden.");
    return;
  }
  const merged = marksDirty;
  if (!merged) marksDirty = false;
  afterMarksChangedBulk();
  showToast(
    `Markierungen ${source}: ${markSummary()}` +
      extraInfo +
      (merged ? " (mit deinen ungesicherten Änderungen zusammengeführt)" : ""),
    "info"
  );
}

// Liest alle gefundenen Markierungsdateien und uebernimmt die zuletzt gesicherte
// (Zeitstempel in der Datei, ersatzweise Aenderungsdatum der Datei).
function loadNewestMarksFile(files) {
  Promise.all(
    files.map((file) =>
      file
        .text()
        .then((text) => {
          const data = JSON.parse(text);
          const saved = Date.parse(data && data.saved) || file.lastModified || 0;
          return { text, saved, name: file.name };
        })
        .catch(() => null)
    )
  )
    .then((entries) => {
      const valid = entries.filter(Boolean);
      if (!valid.length) {
        showToast("Markierungsdatei konnte nicht gelesen werden.");
        return;
      }
      valid.sort((a, b) => b.saved - a.saved);
      const info = valid.length > 1 ? ` (neueste von ${valid.length} Dateien: ${valid[0].name})` : "";
      importMarksFromText(valid[0].text, "geladen", info);
    })
    .catch((err) => {
      console.error(err);
      showToast("Markierungsdatei konnte nicht gelesen werden.");
    });
}

function loadMarksFromFile(file) {
  file
    .text()
    .then((text) => importMarksFromText(text, "geladen"))
    .catch((err) => {
      console.error(err);
      showToast("Markierungsdatei konnte nicht gelesen werden.");
    });
}

function resetMarks() {
  if (!Object.values(marks).some((set) => set.size > 0)) return;
  if (!confirm("Alle Markierungen löschen? (Der letzte Stand lässt sich wiederherstellen.)")) return;
  takeMarksBackup();
  marks = emptyMarks();
  marksDirty = true;
  afterMarksChangedBulk();
}

function initMarksUI() {
  const bind = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
  };
  bind("marks-toggle", toggleMarksPanel);
  bind("marks-close", toggleMarksPanel);
  bind("marks-export", exportMarks);
  bind("marks-reset", resetMarks);
  bind("marks-restore", restoreMarksBackup);
  bind("marks-import", () => document.getElementById("marks-file")?.click());

  const fileInput = document.getElementById("marks-file");
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (file) loadMarksFromFile(file);
    });
  }
  document.querySelectorAll("#marks-tabs [data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      marksTab = tab.dataset.tab;
      renderMarksPanel();
    });
  });
  const search = document.getElementById("marks-search");
  if (search) {
    search.addEventListener("input", () => {
      marksSearch = search.value;
      renderMarksPanel();
    });
  }
  updateMarksStatus();
  if (marksDirty) setTimeout(() => maybeShowMarksHint(true), 2500);
  // Browser bitten, die lokalen Daten nicht bei Speicherknappheit zu loeschen
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

function getCountRange(cat) {
  let min = Infinity;
  let max = -Infinity;
  cat.items.forEach((song) => {
    const count = songPlayCounts[song.id] || 0;
    if (count < min) min = count;
    if (count > max) max = count;
  });
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
}

function updatePlayingHighlight() {
  document.querySelectorAll(".song-button").forEach((btn) => {
    btn.classList.toggle("is-playing", nowPlayingId !== null && btn.dataset.songId === nowPlayingId);
  });
}

function buildSongButton(song, cat, range) {
  const btn = document.createElement("button");
  btn.className = "song-button";

  const count = songPlayCounts[song.id] || 0;
  if (cat.baseHSL) {
    // Heatmap: selten gespielte Songs leuchten kraeftig, oft gespielte werden blasser.
    // Songs mit dem niedrigsten Zaehler der Spalte bekommen zusaetzlich einen hellen Rahmen.
    const spread = range.max - range.min;
    const used = spread > 0 ? (count - range.min) / spread : 0; // 0 = selten, 1 = am haeufigsten
    const fresh = 1 - used;
    const [h, s, l] = cat.baseHSL;
    btn.style.backgroundColor = `hsl(${h}, ${Math.round(15 + fresh * (s * 0.9 - 15))}%, ${Math.round(17 + fresh * 25)}%)`;
    btn.style.borderColor = `hsl(${h}, ${Math.round(15 + fresh * s * 0.8)}%, ${Math.round(24 + fresh * 32)}%)`;
    btn.style.borderLeftColor = `hsl(${h}, ${s}%, ${l}%)`;
    if (spread > 0 && count === range.min) {
      btn.style.boxShadow = `0 0 0 1px hsl(${h}, 83%, 65%), 0 2px 4px rgba(0, 0, 0, 0.3)`;
    } else {
      btn.style.opacity = (0.55 + fresh * 0.45).toFixed(2);
    }
  }

  if (matchesSearch(song)) {
    btn.classList.add("search-hit");
  }

  btn.dataset.songId = song.id;
  if (song.id === nowPlayingId) btn.classList.add("is-playing");

  const eq = document.createElement("span");
  eq.className = "eq";
  eq.setAttribute("aria-hidden", "true");
  eq.innerHTML = "<i></i><i></i><i></i>";

  const name = document.createElement("span");
  name.className = "song-name";
  name.textContent = song.display;
  const badge = document.createElement("span");
  badge.className = "song-count";
  badge.textContent = count.toString();
  const markEl = createMarksEl(song.id);
  if (markEl) btn.append(eq, name, markEl, badge);
  else btn.append(eq, name, badge);

  // Langer Druck oeffnet das Markierungs-Menue; der folgende Klick spielt dann nicht ab
  let pressTimer = null;
  let longPressed = false;
  const cancelPress = () => clearTimeout(pressTimer);
  btn.addEventListener("pointerdown", () => {
    longPressed = false;
    cancelPress();
    pressTimer = setTimeout(() => {
      longPressed = true;
      openMarkMenu(song, btn);
    }, LONG_PRESS_MS);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((type) =>
    btn.addEventListener(type, cancelPress)
  );
  btn.addEventListener("contextmenu", (event) => event.preventDefault());

  btn.addEventListener("click", () => {
    if (longPressed) {
      longPressed = false;
      return;
    }
    playAudio(song.url, song.display, song.category, song.id);
    clearSearch();
  });
  return btn;
}

function renderCategories() {
  const grid = document.getElementById("categories-grid");
  grid.innerHTML = "";
  let totalMatches = 0;
  Object.entries(categories).forEach(([key, cat]) => {
    const col = document.createElement("div");
    col.classList.add("category-col");
    col.setAttribute("data-category", key);

    const head = document.createElement("div");
    head.className = "category-head";
    if (cat.baseHSL) {
      const [h, s, l] = cat.baseHSL;
      head.style.borderBottomColor = `hsl(${h}, ${s}%, ${l}%)`;
    }
    const title = document.createElement("span");
    title.className = "category-title";
    title.textContent = cat.title;
    const total = document.createElement("span");
    total.className = "category-total";
    total.textContent = cat.items.length.toString();
    head.append(title, total);

    const container = document.createElement("div");
    container.className = "flex flex-col space-y-2 category-list";
    container.id = `col-${key}`;
    container.dataset.category = key;

    col.append(head, container);
    grid.appendChild(col);

    const range = getCountRange(cat);
    cat.items.forEach((song) => {
      if (matchesSearch(song)) totalMatches += 1;
      container.appendChild(buildSongButton(song, cat, range));
    });
  });
  updateSearchCount(totalMatches);
}

function resumeAudioContext() {
  if (!audioCtx || audioCtx.state === "running") return Promise.resolve();
  return audioCtx.resume().catch((err) => {
    console.warn("Konnte AudioContext nicht fortsetzen:", err);
  });
}

let toastTimer = null;
function showToast(message, type = "error") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("toast-info", type === "info");
  toast.classList.add("toast-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("toast-visible"), 4000);
}

function handlePlaybackFailure(err, displayTitle) {
  if (err && err.name === "AbortError") return; // schnelles Weiterschalten, kein echter Fehler
  console.error("Audio-Wiedergabe fehlgeschlagen:", err);
  clearNowPlaying();
  const name = displayTitle ? `\u201E${displayTitle}\u201C` : "Song";
  if (err && err.name === "NotAllowedError") {
    showToast(`${name} konnte nicht starten (Wiedergabe blockiert). Bitte nochmal tippen.`);
  } else {
    showToast(`${name} konnte nicht abgespielt werden.`);
  }
}

function playAudio(file, displayTitle = "", categoryKey = null, songId = null) {
  const el = getAudioElement();
  if (!el) return;

  if (fadeIntervalId) {
    clearInterval(fadeIntervalId);
    fadeIntervalId = null;
  }

  ensureAudioGraph();
  el.pause();
  el.currentTime = 0;
  el.src = file;

  if (gainNode) {
    gainNode.gain.value = volumeLevel;
  } else {
    const targetVolume = volumeLevel;
    try {
      el.volume = targetVolume;
    } catch (err) {
      console.warn("Konnte Lautstaerke nicht setzen:", err);
    }
  }

  currentAudio = el;
  nowPlaying.category = categoryKey || null;
  nowPlayingId = songId || null;
  rememberPlayed(songId);
  incrementPlayCount(songId || displayTitle || file, categoryKey);
  updatePlayingHighlight();
  showNowPlaying(displayTitle);
  resumeAudioContext();
  el.onloadedmetadata = () => {
    updateNowPlayingDuration(el);
    sendNowPlayingStatus({ title: displayTitle, category: categoryKey, duration: el.duration || 0 });
  };
  el.ontimeupdate = () => updateNowPlayingEta(el);
  el.onended = () => clearNowPlaying();
  el.onerror = () => handlePlaybackFailure(el.error, displayTitle);
  const playPromise = el.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch((err) => {
      // einmal erneut versuchen: nach einer iOS-Unterbrechung klappt es oft erst nach dem Fortsetzen
      if (err && err.name === "NotAllowedError" && audioCtx && audioCtx.state !== "running") {
        resumeAudioContext()
          .then(() => el.play())
          .catch((retryErr) => handlePlaybackFailure(retryErr, displayTitle));
      } else {
        handlePlaybackFailure(err, displayTitle);
      }
    });
  }
  sendNowPlayingStatus({ title: displayTitle, category: categoryKey });
}

function stopAudio(forceImmediate = false) {
  const el = getAudioElement();
  if (!el || !currentAudio) return;

  if (fadeIntervalId) {
    clearInterval(fadeIntervalId);
    fadeIntervalId = null;
  }

  const fadeOutTime = 1000;
  const fadeSteps = 30;
  const fadeInterval = fadeOutTime / fadeSteps;
  const canGainFade = !!gainNode;
  const shouldFade = !forceImmediate;

  sendNowPlayingStatus({ title: "", category: null, duration: 0, stopped: true });

  if (shouldFade && canGainFade) {
    const startGain = gainNode.gain.value || volumeLevel || 1;
    const gainStep = startGain / fadeSteps;
    fadeIntervalId = setInterval(() => {
      const next = gainNode.gain.value - gainStep;
      if (next > 0.001) {
        gainNode.gain.value = next;
      } else {
        clearInterval(fadeIntervalId);
        fadeIntervalId = null;
        gainNode.gain.value = 0.001; // leises Ende, kein Hochspringen
        el.pause();
        el.currentTime = 0;
        currentAudio = null;
      }
    }, fadeInterval);
  } else if (shouldFade && !IS_IOS) {
    const initialVolume = el.volume > 0 ? el.volume : volumeLevel || 1;
    const volumeStep = initialVolume / fadeSteps;
    fadeIntervalId = setInterval(() => {
      if (el.volume > volumeStep + 0.001) {
        el.volume -= volumeStep;
      } else {
        clearInterval(fadeIntervalId);
        fadeIntervalId = null;
        el.volume = 0.001; // leises Ende, dann Stopp
        el.pause();
        el.currentTime = 0;
        currentAudio = null;
      }
    }, fadeInterval);
  } else {
    el.pause();
    el.currentTime = 0;
    currentAudio = null;
  }
  clearNowPlaying();
}

function setVolume(value) {
  const numeric = Math.min(1, Math.max(0, parseFloat(value) || 0));
  volumeLevel = numeric;

  const el = getAudioElement();
  if (!el) return;

  ensureAudioGraph();

  if (gainNode) {
    gainNode.gain.value = volumeLevel;
    return;
  }

  try {
    el.volume = volumeLevel;
  } catch (err) {
    console.warn("Konnte Lautstaerke nicht setzen:", err);
  }
}

function updateSpecialButtons() {
  const map = [
    { id: "btn-timeout", key: "timeout", fallback: "Timeout", prefix: "" },
    { id: "btn-walkon", key: "walkon", fallback: "Walk-On", prefix: "" },
  ];

  map.forEach(({ id, key, fallback, prefix }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const track = specialTracks[key];
    if (track && track.display) {
      btn.textContent = prefix ? `${prefix}${track.display}` : track.display;
    } else {
      btn.textContent = fallback;
    }
  });

  renderPauseButtons();
}

function showNowPlaying(title = "") {
  const { box, title: t, eta } = nowPlayingEls;
  nowPlaying.title = title || "Playing";
  if (t) t.textContent = nowPlaying.title;
  if (eta) eta.textContent = "--:--";
  if (nowPlayingEls.elapsed) nowPlayingEls.elapsed.textContent = "0:00";
  if (nowPlayingEls.bar) nowPlayingEls.bar.style.width = "100%";
  if (box) box.classList.remove("hidden");
}

function updateNowPlayingDuration(el) {
  nowPlaying.duration = el && isFinite(el.duration) ? el.duration : 0;
  updateNowPlayingEta(el);
}

function updateNowPlayingEta(el) {
  const { eta } = nowPlayingEls;
  if (!eta || !el) return;
  const remaining = (el.duration || 0) - (el.currentTime || 0);
  eta.textContent = formatTime(remaining);
  if (nowPlayingEls.elapsed) nowPlayingEls.elapsed.textContent = formatTime(el.currentTime || 0);
  toggleNowPlayingWarning(remaining);
  const { bar } = nowPlayingEls;
  if (bar) {
    const ratio = el.duration > 0 && isFinite(el.duration) ? remaining / el.duration : 0;
    bar.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  }
}

function clearNowPlaying() {
  const { box, eta, bar } = nowPlayingEls;
  nowPlaying = { title: "", duration: 0, category: null };
  nowPlayingId = null;
  updatePlayingHighlight();
  if (bar) bar.style.width = "0";
  if (eta) eta.textContent = "--:--";
  if (nowPlayingEls.elapsed) nowPlayingEls.elapsed.textContent = "0:00";
  if (box) box.classList.add("hidden");
  toggleNowPlayingWarning(Infinity);
  sendNowPlayingStatus({ title: "", category: null, duration: 0, stopped: true });
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function syncAfterReturn() {
  if (document.visibilityState !== "visible") return;
  resumeAudioContext();
  // Wurde die Wiedergabe vom System gestoppt, soll die Anzeige nicht weiter "laeuft" zeigen
  if (nowPlaying.title && audioEl && audioEl.paused && !fadeIntervalId) {
    clearNowPlaying();
  }
}

document.addEventListener("visibilitychange", syncAfterReturn);
window.addEventListener("pageshow", syncAfterReturn);

document.addEventListener("DOMContentLoaded", () => {
  loadMarks();
  initMarksUI();
  initInfoUI();
  audioEl = getAudioElement();
  if (audioEl) {
    audioEl.preload = "none";
    audioEl.setAttribute("playsinline", "true");
  }
  nowPlayingEls = {
    box: document.getElementById("now-playing"),
    title: document.getElementById("now-playing-title"),
    eta: document.getElementById("now-playing-eta"),
    elapsed: document.getElementById("now-playing-elapsed"),
    bar: document.getElementById("now-playing-bar"),
  };
  headerEls = {
    block: document.getElementById("header-block"),
    toggle: document.getElementById("toggle-header"),
  };
  initVersionInfo();
  infoEls = {
    panel: document.getElementById("info-panel"),
    toggle: document.getElementById("info-toggle"),
  };
  zoomEls = {
    level: document.getElementById("zoom-level"),
    inBtn: document.getElementById("zoom-in"),
    outBtn: document.getElementById("zoom-out"),
    resetBtn: document.getElementById("reset-counts"),
  };
  searchEls = {
    input: document.getElementById("search-input"),
    count: document.getElementById("search-count"),
  };
  rtcState.ui = {
    panel: document.getElementById("pairing-panel"),
    toggle: document.getElementById("pairing-toggle"),
    status: document.getElementById("pairing-status"),
    offerText: document.getElementById("player-offer-text"),
    answerText: document.getElementById("player-answer-text"),
    offerQr: document.getElementById("player-offer-qr"),
    log: document.getElementById("pairing-log"),
    createOfferBtn: document.getElementById("create-offer-btn"),
    refreshOfferBtn: document.getElementById("refresh-offer-btn"),
    applyAnswerBtn: document.getElementById("apply-answer-btn"),
    scanAnswerBtn: document.getElementById("scan-answer-btn"),
    stopScanBtn: document.getElementById("stop-scan-btn"),
    closeBtn: document.getElementById("pairing-close-btn"),
  };
  rtcState.scanner.video = document.getElementById("answer-video");
  rtcState.scanner.canvas = document.getElementById("answer-canvas");
  if (rtcState.scanner.canvas) {
    rtcState.scanner.ctx = rtcState.scanner.canvas.getContext("2d");
  }
  initZoomControls();
  initSearchControls();
  initPairingUI();

  const fileInput = document.getElementById("filepicker");
  const loadButton = document.getElementById("load-songs-btn");
  const btnTimeout = document.getElementById("btn-timeout");
  const btnWalkon = document.getElementById("btn-walkon");

  if (loadButton && fileInput) {
    loadButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (event) => handleFiles(event.target.files));
  }
  if (headerEls.toggle) {
    headerEls.toggle.addEventListener("click", toggleHeaderVisibility);
  }

  const bindSpecial = (btn, key, label) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      const track = specialTracks[key];
      if (track && track.url) {
        playAudio(track.url, track.display || label);
      } else {
        alert(`Kein ${label}-Track geladen.`);
      }
    });
  };

  bindSpecial(btnTimeout, "timeout", "Timeout");
  bindSpecial(btnWalkon, "walkon", "Walk-On");

  updateSpecialButtons();
  loadPlayCounts();
});

function toggleNowPlayingWarning(remainingSeconds) {
  const { box } = nowPlayingEls;
  if (!box) return;
  if (remainingSeconds <= NOW_PLAYING_WARNING_THRESHOLD) {
    box.classList.add("now-playing-warning");
  } else {
    box.classList.remove("now-playing-warning");
  }
}

function incrementPlayCount(id, categoryKey) {
  if (!categoryKey) return;
  songPlayCounts[id] = (songPlayCounts[id] || 0) + 1;
  savePlayCounts();
  renderSingleCategory(categoryKey);
}

function savePlayCounts() {
  try {
    localStorage.setItem("songPlayCounts", JSON.stringify(songPlayCounts));
  } catch (e) {
    console.warn("Konnte songPlayCounts nicht speichern:", e);
  }
}

function loadPlayCounts() {
  try {
    const data = localStorage.getItem("songPlayCounts");
    if (data) {
      songPlayCounts = JSON.parse(data);
    }
  } catch (e) {
    console.warn("Konnte songPlayCounts nicht laden:", e);
  }
}

function renderSingleCategory(key) {
  const cat = categories[key];
  if (!cat) return;
  const container = document.querySelector(`#col-${key}`);
  if (!container) return;
  container.innerHTML = "";

  const range = getCountRange(cat);
  cat.items.forEach((song) => {
    container.appendChild(buildSongButton(song, cat, range));
  });
  updateSearchCount(countSearchHits());
}

function initZoomControls() {
  const { level, inBtn, outBtn, resetBtn } = zoomEls;
  const applyZoom = () => {
    document.documentElement.style.fontSize = `${16 * zoomLevel}px`;
    if (level) level.textContent = `${Math.round(zoomLevel * 100)}%`;
  };
  applyZoom();
  if (inBtn) {
    inBtn.addEventListener("click", () => {
      zoomLevel = Math.min(ZOOM_MAX, parseFloat((zoomLevel + ZOOM_STEP).toFixed(2)));
      applyZoom();
    });
  }
  if (outBtn) {
    outBtn.addEventListener("click", () => {
      zoomLevel = Math.max(ZOOM_MIN, parseFloat((zoomLevel - ZOOM_STEP).toFixed(2)));
      applyZoom();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetPlayCounts();
    });
  }
}

function resetPlayCounts() {
  songPlayCounts = {};
  savePlayCounts();
  renderCategories();
}

function collapseHeader() {
  if (!headerEls.block) return;
  headerEls.block.classList.add("header-hidden");
  headerEls.block.style.display = "none";
  if (headerEls.toggle) {
    headerEls.toggle.textContent = "Kopf einblenden";
    headerEls.toggle.dataset.collapsed = "true";
  }
  document.body.classList.add("header-collapsed");
}

function toggleHeaderVisibility() {
  if (!headerEls.block) return;
  const hidden = headerEls.block.classList.toggle("header-hidden");
  headerEls.block.style.display = hidden ? "none" : "";
  if (headerEls.toggle) {
    headerEls.toggle.textContent = hidden ? "Kopf einblenden" : "Kopf ausblenden";
    headerEls.toggle.dataset.collapsed = hidden ? "true" : "false";
  }
  document.body.classList.toggle("header-collapsed", hidden);
}

function renderPauseButtons() {
  const container = document.getElementById("pause-buttons");
  if (!container) return;
  container.innerHTML = "";

  if (!Array.isArray(specialTracks.pauses) || specialTracks.pauses.length === 0) return;

  const sorted = [...specialTracks.pauses].sort((a, b) => (a.number || 0) - (b.number || 0));
  sorted.forEach((track, idx) => {
    const base = track.display || `Pause ${track.number || idx + 1}`;
    const label = `Pause: ${base}`;
    const btn = document.createElement("button");
    btn.className = "pause-button bg-[#2b3445] hover:bg-[#364156] rounded-xl text-base leading-tight px-2 py-2 w-full";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      playAudio(track.url, label);
    });
    container.appendChild(btn);
  });
}

function initCategoryScrollSync() {
  const miscKeys = new Set(["sonstiges", "noch_mehr", "noch_mehr2"]);
  let isSyncing = false;
  const miscLists = Array.from(document.querySelectorAll(".category-list")).filter((el) =>
    miscKeys.has(el.dataset.category)
  );

  miscLists.forEach((el) => {
    el.onscroll = null;
    el.addEventListener("scroll", () => {
      if (isSyncing) return;
      isSyncing = true;
      const target = el.scrollTop;
      miscLists.forEach((other) => {
        if (other !== el) {
          other.scrollTop = target;
        }
      });
      isSyncing = false;
    });
  });
}

function initSearchControls() {
  const { input } = searchEls;
  if (!input) return;
  input.addEventListener("input", (e) => setSearchTerm(e.target.value));
  setSearchTerm("");
}

function setSearchTerm(value) {
  const normalized = (value || "").trim().toLowerCase();
  searchTerm = normalized;
  renderCategories();
}

function matchesSearch(song) {
  if (!searchTerm) return false;
  const haystack = `${song.display || ""} ${song.name || ""}`.toLowerCase();
  return haystack.includes(searchTerm);
}

function countSearchHits() {
  if (!searchTerm) return 0;
  let hits = 0;
  Object.values(categories).forEach((cat) => {
    cat.items.forEach((song) => {
      if (matchesSearch(song)) hits += 1;
    });
  });
  return hits;
}

function updateSearchCount(count) {
  const el = searchEls.count;
  if (!el) return;
  const value = searchTerm ? count : 0;
  el.textContent = `${value} Treffer`;
}

function clearSearch() {
  if (!searchTerm) return;
  searchTerm = "";
  if (searchEls.input) {
    searchEls.input.value = "";
  }
  renderCategories();
}

function updateBottomBarHeight() {
  const bar = document.querySelector(".bottom-bar");
  if (bar) document.documentElement.style.setProperty("--bottom-bar-h", `${bar.offsetHeight}px`);
}

function initInfoUI() {
  const tabs = document.querySelectorAll("#info-tabs [data-info-tab]");
  const sections = document.querySelectorAll("[data-info-section]");
  const body = document.querySelector(".info-body");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((other) => other.classList.toggle("active", other === tab));
      sections.forEach((section) =>
        section.classList.toggle("hidden", section.dataset.infoSection !== tab.dataset.infoTab)
      );
      if (body) body.scrollTop = 0;
    });
  });
  const close = document.getElementById("info-close");
  if (close) close.addEventListener("click", toggleInfo);

  // Fenster sollen immer ueber der unteren Leiste enden, auch wenn sich deren Hoehe aendert
  updateBottomBarHeight();
  window.addEventListener("resize", updateBottomBarHeight);
  const bar = document.querySelector(".bottom-bar");
  if (bar && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(updateBottomBarHeight).observe(bar);
  }
}

function toggleInfo() {
  const panel = infoEls.panel || document.getElementById("info-panel");
  if (!panel) return;
  panel.classList.toggle("hidden");
}

function toggleVersion() {
  const panel = document.getElementById("version-panel");
  if (!panel) return;
  panel.classList.toggle("hidden");
}

function renderChangelog() {
  const box = document.getElementById("version-changelog");
  if (!box || typeof APP_CHANGELOG === "undefined") return;
  box.innerHTML = "";
  APP_CHANGELOG.forEach((entry, index) => {
    const details = document.createElement("details");
    details.open = index === 0;
    const summary = document.createElement("summary");
    summary.className = "cursor-pointer font-semibold";
    summary.textContent = `v${entry.version} (${entry.date})`;
    const list = document.createElement("ul");
    list.className = "list-disc list-inside space-y-1 mt-1";
    entry.changes.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
    details.append(summary, list);
    box.appendChild(details);
  });
}

function initVersionInfo() {
  const version = typeof APP_VERSION !== "undefined" ? APP_VERSION : "?";
  const build = typeof APP_BUILD !== "undefined" ? APP_BUILD : "?";
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set("version-toggle", `v${version}`);
  set("version-number", version);
  set("version-build", build);
  renderChangelog();
  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => set("version-cache", keys.join(", ") || "-"))
      .catch(() => set("version-cache", "-"));
  } else {
    set("version-cache", "-");
  }
}

// ---------------------------------------------------------------------------
// Zufallsauswahl: selten gespielte Songs werden klar bevorzugt
// ---------------------------------------------------------------------------
const RECENT_SONG_LIMIT = 4; // so viele zuletzt gespielte Songs werden uebersprungen
const RANDOM_WEIGHT_POWER = 4; // je hoeher, desto staerker die Bevorzugung
const recentSongIds = [];

function rememberPlayed(id) {
  if (!id) return;
  const index = recentSongIds.indexOf(id);
  if (index !== -1) recentSongIds.splice(index, 1);
  recentSongIds.push(id);
  while (recentSongIds.length > RECENT_SONG_LIMIT) recentSongIds.shift();
}

// Waehlt einen Song aus der Liste:
// 1. Zuletzt gespielte Songs werden uebersprungen (sofern genug andere da sind).
// 2. Das Gewicht richtet sich nach dem Abstand zum am seltensten gespielten Song der Auswahl:
//    gleich oft wie der seltenste = Gewicht 1, einmal oefter = 1/16, zweimal = 1/81 usw.
//    Dadurch bleibt die Bevorzugung auch dann scharf, wenn alle Songs schon oft liefen.
function pickWeightedSong(songs) {
  if (!songs.length) return null;
  const skip = Math.min(RECENT_SONG_LIMIT, songs.length - 1);
  const recent = skip > 0 ? recentSongIds.slice(-skip) : [];
  let candidates = songs.filter((song) => !recent.includes(song.id));
  if (!candidates.length) candidates = songs;

  const counts = candidates.map((song) => songPlayCounts[song.id] || 0);
  const minCount = Math.min(...counts);
  const weights = counts.map((count) =>
    Math.max(0.0005, 1 / Math.pow(1 + (count - minCount), RANDOM_WEIGHT_POWER))
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function playRandomTrack() {
  const candidateCategories = ["ass_angriff", "block", "sonstiges", "noch_mehr", "noch_mehr2"];
  const songs = candidateCategories.flatMap((key) => (categories[key] ? categories[key].items : []));
  const chosen = pickWeightedSong(songs);
  if (!chosen) {
    alert("Keine Songs in den zufaelligen Kategorien geladen.");
    return;
  }
  playAudio(chosen.url, chosen.display, chosen.category, chosen.id);
}

// Zufaelliger Song aus einer Markierungs-Gruppe ("top" oder "clap")
function playRandomMarked(group) {
  const def = MARK_GROUPS[group];
  if (!def) return;
  const songs = getAllSongs().filter((song) => marks[group].has(song.id));
  const chosen = pickWeightedSong(songs);
  if (!chosen) {
    showToast(`Noch keine geladenen Songs in „${def.label}“ markiert.`);
    return;
  }
  playAudio(chosen.url, chosen.display, chosen.category, chosen.id);
}

function playRandomOpponentTrack() {
  const cat = categories["gegner"];
  const chosen = pickWeightedSong(cat && Array.isArray(cat.items) ? cat.items : []);
  if (!chosen) {
    alert("Keine Songs in der Gegner-Kategorie geladen.");
    return;
  }
  playAudio(chosen.url, chosen.display, "gegner", chosen.id);
}

// -----------------------------
// WebRTC Remote-Control (Player)
// -----------------------------

function initPairingUI() {
  const { toggle, panel, createOfferBtn, refreshOfferBtn, applyAnswerBtn, scanAnswerBtn, stopScanBtn, closeBtn } = rtcState.ui;
  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      panel.classList.toggle("hidden");
      if (!panel.classList.contains("hidden")) {
        panel.scrollTop = 0;
      }
    });
  }
  if (closeBtn && panel) {
    closeBtn.addEventListener("click", () => panel.classList.add("hidden"));
  }
  if (createOfferBtn) createOfferBtn.addEventListener("click", startPlayerOffer);
  if (refreshOfferBtn) refreshOfferBtn.addEventListener("click", () => {
    cleanupPlayerRTC();
    resetPairingUI();
    startPlayerOffer();
  });
  if (applyAnswerBtn) applyAnswerBtn.addEventListener("click", applyAnswerFromInput);
  if (scanAnswerBtn) scanAnswerBtn.addEventListener("click", startAnswerScan);
  if (stopScanBtn) stopScanBtn.addEventListener("click", stopAnswerScan);
}

function resetPairingUI() {
  const { offerText, answerText, offerQr, log, status } = rtcState.ui;
  if (offerText) offerText.value = "";
  if (answerText) answerText.value = "";
  if (offerQr) offerQr.innerHTML = "";
  if (log) log.textContent = "";
  if (status) status.textContent = "Getrennt";
}

function updatePairingStatus(text) {
  if (rtcState.ui.status) {
    rtcState.ui.status.textContent = text;
  }
}

function logPairing(message) {
  const el = rtcState.ui.log;
  if (!el) return;
  const ts = new Date().toLocaleTimeString();
  el.textContent = `[${ts}] ${message}\n${el.textContent}`.slice(0, 2000);
}

function cleanupPlayerRTC() {
  if (rtcState.channel) {
    try {
      rtcState.channel.close();
    } catch (e) {
      console.warn("Channel close failed", e);
    }
  }
  if (rtcState.pc) {
    try {
      rtcState.pc.close();
    } catch (e) {
      console.warn("PC close failed", e);
    }
  }
  rtcState.pc = null;
  rtcState.channel = null;
  rtcState.offerCandidates = [];
  rtcState.status = "disconnected";
  stopAnswerScan();
  updatePairingStatus("Getrennt");
}

async function startPlayerOffer() {
  try {
    cleanupPlayerRTC();
    updatePairingStatus("Verbinde...");
    logPairing("Erzeuge Offer...");
    const pc = new RTCPeerConnection({ iceServers: [] });
    rtcState.pc = pc;
    rtcState.offerCandidates = [];
    const channel = pc.createDataChannel("remote");
    rtcState.channel = channel;
    wireDataChannel(channel);
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        rtcState.offerCandidates.push(ev.candidate);
      }
    };
    pc.oniceconnectionstatechange = () => {
      logPairing(`ICE: ${pc.iceConnectionState}`);
    };
    pc.onconnectionstatechange = () => {
      logPairing(`Connection: ${pc.connectionState}`);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        updatePairingStatus("Getrennt");
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceComplete(pc);
    const payload = {
      type: "offer",
      sdp: pc.localDescription.sdp,
      ice: rtcState.offerCandidates,
    };
    const encoded = encodeSignalPayload(payload);
    renderOfferQr(encoded);
    if (rtcState.ui.offerText) rtcState.ui.offerText.value = encoded;
    updatePairingStatus("Offer bereit");
    logPairing("Offer bereit. QR/Text an Remote senden.");
  } catch (err) {
    console.error(err);
    logPairing(`Fehler beim Offer: ${err.message || err}`);
    updatePairingStatus("Fehler");
  }
}

function renderOfferQr(text) {
  const target = rtcState.ui.offerQr;
  if (!target) return;
  target.innerHTML = "";
  if (typeof QRCode === "undefined") {
    target.textContent = "QR-Bibliothek fehlt.";
    return;
  }
  new QRCode(target, {
    text,
    width: 160,
    height: 160,
    correctLevel: QRCode.CorrectLevel.L,
  });
}

async function applyAnswerFromInput() {
  try {
    if (!rtcState.pc) {
      logPairing("Kein aktiver Offer. Bitte neu starten.");
      return;
    }
    const text = (rtcState.ui.answerText?.value || "").trim();
    if (!text) {
      logPairing("Keine Answer im Feld gefunden.");
      return;
    }
    const payload = decodeSignalPayload(text);
    if (!payload || payload.type !== "answer" || !payload.sdp) {
      logPairing("Ungültige Answer.");
      return;
    }
    await rtcState.pc.setRemoteDescription(new RTCSessionDescription({ type: payload.type, sdp: payload.sdp }));
    if (Array.isArray(payload.ice)) {
      for (const cand of payload.ice) {
        try {
          await rtcState.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn("Konnte ICE-Kandidat nicht setzen:", err);
        }
      }
    }
    updatePairingStatus("Answer gesetzt");
    logPairing("Answer übernommen. Warte auf DataChannel...");
  } catch (err) {
    console.error(err);
    logPairing(`Fehler beim Anwenden der Answer: ${err.message || err}`);
    updatePairingStatus("Fehler");
  }
}

function wireDataChannel(channel) {
  if (!channel) return;
  channel.onopen = () => {
    rtcState.status = "connected";
    updatePairingStatus("Verbunden");
    logPairing("Remote verbunden.");
    unlockAudioForRemote();
    sendSongsListToRemote();
  };
  channel.onclose = () => {
    rtcState.status = "disconnected";
    updatePairingStatus("Getrennt");
    logPairing("Remote getrennt.");
  };
  channel.onerror = (err) => logPairing(`Channel-Fehler: ${err?.message || err}`);
  channel.onmessage = handleRemoteMessage;
}

function handleRemoteMessage(event) {
  let msg = null;
  try {
    msg = JSON.parse(event.data);
  } catch (err) {
    console.warn("Ungültige Nachricht", err);
    return;
  }
  if (!msg) return;
  if (msg.type === "command") {
    handleRemoteCommand(msg.command, msg.payload || {});
  }
}

function handleRemoteCommand(command, payload) {
  switch (command) {
    case "play": {
      const ok = playSongFromRemote(payload);
      if (!ok) logPairing("Song nicht gefunden.");
      break;
    }
    case "stop":
      stopAudio();
      break;
    case "randomStandard":
      playRandomTrack();
      break;
    case "randomOpponent":
      playRandomOpponentTrack();
      break;
    case "special":
      handleSpecialFromRemote(payload);
      break;
    case "volume":
      handleRemoteVolume(payload);
      break;
    case "requestSongs":
      sendSongsListToRemote();
      break;
    default:
      logPairing(`Unbekannter Command: ${command}`);
  }
  sendAck(command);
}

function playSongFromRemote(payload) {
  if (!payload) return false;
  const { id, category } = payload;
  if (!id || !category) return false;
  const song = findSongById(category, id);
  if (!song) return false;
  playAudio(song.url, song.display, category, song.id);
  return true;
}

function findSongById(categoryKey, songId) {
  const cat = categories[categoryKey];
  if (!cat || !Array.isArray(cat.items)) return null;
  return cat.items.find((song) => song.id === songId || song.name === songId) || null;
}

function handleSpecialFromRemote(payload) {
  if (!payload || !payload.type) return;
  if (payload.type === "timeout" && specialTracks.timeout) {
    playAudio(specialTracks.timeout.url, specialTracks.timeout.display || "Timeout");
    return;
  }
  if (payload.type === "walkon" && specialTracks.walkon) {
    playAudio(specialTracks.walkon.url, specialTracks.walkon.display || "Walk-On");
    return;
  }
  if (payload.type === "pause") {
    const id = payload.id;
    const target = specialTracks.pauses.find(
      (p) => p.number === Number(id) || p.display === id || p.name === id || (typeof id === "string" && id && p.display === id)
    );
    if (target) {
      const label = target.display || `Pause ${target.number || ""}`;
      playAudio(target.url, label);
    }
  }
}

function handleRemoteVolume(payload) {
  if (!payload || typeof payload.value === "undefined") return;
  let val = Number(payload.value);
  if (val > 1) {
    val = val / 100;
  }
  val = Math.min(1, Math.max(0, val));
  setVolume(val);
}

function sendChannelMessage(obj) {
  if (!rtcState.channel || rtcState.channel.readyState !== "open") return;
  try {
    rtcState.channel.send(JSON.stringify(obj));
  } catch (err) {
    console.warn("Konnte Nachricht nicht senden:", err);
  }
}

function sendAck(command) {
  sendChannelMessage({ type: "ack", command });
}

function sendSongsListToRemote() {
  if (!rtcState.channel || rtcState.channel.readyState !== "open") return;
  const payload = buildSongsListPayload();
  sendChannelMessage({ type: "songsList", data: payload });
}

function buildSongsListPayload() {
  const songs = [];
  remoteCategories.forEach((key) => {
    const cat = categories[key];
    if (!cat || !Array.isArray(cat.items)) return;
    cat.items.forEach((song) => {
      songs.push({ id: song.id, display: song.display, category: key });
    });
  });
  const specials = {
    timeout: specialTracks.timeout
      ? { id: specialTracks.timeout.name, display: specialTracks.timeout.display || "Timeout" }
      : null,
    walkon: specialTracks.walkon
      ? { id: specialTracks.walkon.name, display: specialTracks.walkon.display || "Walk-On" }
      : null,
    pauses: Array.isArray(specialTracks.pauses)
      ? specialTracks.pauses.map((p) => ({
          id: p.number || p.name,
          display: p.display || `Pause ${p.number || ""}`,
          number: p.number || null,
        }))
      : [],
  };
  return { songs, specials };
}

function sendNowPlayingStatus(data) {
  if (!rtcState.channel || rtcState.channel.readyState !== "open") return;
  const payload = {
    title: data?.title || "",
    category: data?.category || null,
    duration: data?.duration || 0,
    stopped: !!data?.stopped,
  };
  sendChannelMessage({ type: "nowPlaying", data: payload });
}

function encodeSignalPayload(obj) {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeSignalPayload(str) {
  const clean = (str || "").trim();
  const json = decodeURIComponent(escape(atob(clean)));
  return JSON.parse(json);
}

function waitForIceComplete(pc) {
  return new Promise((resolve) => {
    if (!pc || pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const checkState = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", checkState);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", checkState);
  });
}

function unlockAudioForRemote() {
  const el = getAudioElement();
  if (!el) return;
  ensureAudioGraph();
  resumeAudioContext();
  // Versuch, Autoplay-Sperre zu loesen: kurz stumm spielen/pause
  try {
    const prevMuted = el.muted;
    el.muted = true;
    el.play().then(() => {
      el.pause();
      el.muted = prevMuted;
      if (gainNode) gainNode.gain.value = volumeLevel;
    }).catch(() => {
      el.muted = prevMuted;
    });
  } catch (err) {
    console.warn("Unlock fehlgeschlagen", err);
  }
}

async function startAnswerScan() {
  const { video, canvas } = rtcState.scanner;
  const { scanAnswerBtn, stopScanBtn } = rtcState.ui;
  if (!video || !canvas) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    rtcState.scanner.stream = stream;
    video.srcObject = stream;
    await video.play();
    video.classList.remove("hidden");
    canvas.classList.add("hidden");
    if (scanAnswerBtn) scanAnswerBtn.classList.add("hidden");
    if (stopScanBtn) stopScanBtn.classList.remove("hidden");
    tickAnswerScan();
    logPairing("Scanner gestartet.");
  } catch (err) {
    console.error(err);
    logPairing("Kamera/Scanner nicht verfügbar.");
  }
}

function tickAnswerScan() {
  const { video, canvas, ctx } = rtcState.scanner;
  if (!video || !canvas || !ctx) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (typeof jsQR !== "undefined") {
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code && code.data) {
        stopAnswerScan();
        if (rtcState.ui.answerText) rtcState.ui.answerText.value = code.data;
        logPairing("Answer-QR gelesen. Bitte anwenden.");
        return;
      }
    }
  }
  rtcState.scanner.frameReq = requestAnimationFrame(tickAnswerScan);
}

function stopAnswerScan() {
  const { stream, frameReq, video } = rtcState.scanner;
  const { scanAnswerBtn, stopScanBtn } = rtcState.ui;
  if (frameReq) cancelAnimationFrame(frameReq);
  rtcState.scanner.frameReq = null;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  rtcState.scanner.stream = null;
  if (video) {
    video.pause();
    video.srcObject = null;
    video.classList.add("hidden");
  }
  if (scanAnswerBtn) scanAnswerBtn.classList.remove("hidden");
  if (stopScanBtn) stopScanBtn.classList.add("hidden");
}
