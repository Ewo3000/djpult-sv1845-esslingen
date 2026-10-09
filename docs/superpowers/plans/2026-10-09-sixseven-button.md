# 6/7 Button und Kategorie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ersetze die Buttons „Top-Stimmung“ und „Mitklatschen“ in der unteren Leiste durch einen Vollhöhe-Button „6/7“ mit Hintergrund `#d97706`, der ausschließlich Tracks mit `_SIXSEVEN` abspielt, und binde ihn auch an die Remote-App an.

**Architecture:** Tracks mit Namensbestandteil `_SIXSEVEN` werden in `script.js` erkannt und in `specialTracks.sixseven` verwaltet, wodurch sie vom 7-Spalten-Raster getrennt bleiben. Die Wiedergabelogik `playSixSeven()` wählt bei Einzeltracks direkt und bei mehreren Tracks nach dem bewährten Zufalls- und Wiederholungsschutz-Algorithmus aus. `index.html` und `remote.html` erhalten die entsprechenden Buttons mit WebRTC-Anbindung.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 Audio & WebRTC, Tailwind CSS & Vanilla CSS (`style.css`), Node.js (für Unit-Tests).

## Global Constraints

- Exakte Farbe für den Button „6/7“: `#d97706` (Hover `#b45309`).
- Exakter Titel: `6/7` (kein Subtitel).
- Dateinamen-Erkennung: Case-insensitive Erkennung von `_SIXSEVEN` in Audio-Dateien (`.mp3`, `.flac`, `.wav`, `.ogg`).
- Songs mit `_SIXSEVEN` dürfen NICHT in den 7 Raster-Spalten erscheinen und NICHT von „Eigene Punkte“ / „Gegnerpunkte“ abgespielt werden.
- Die Markierungs-Tabs und Kontextmenüs für `top` und `clap` im Verwaltungsmenü bleiben erhalten.

---

### Task 1: Dateierkennung und Datenmodell für `_SIXSEVEN` (`script.js`)

**Files:**
- Modify: `script.js:37-187`
- Test: `tests/test-sixseven-parsing.js`

**Interfaces:**
- Consumes: Dateinamen von Audio-Dateien aus `filepicker`
- Produces: `specialTracks.sixseven` (Array von Song-Objekten), bereinigter `display`-Name via `cleanName()`

- [ ] **Step 1: Test für `cleanName` und `_SIXSEVEN`-Klassifizierung schreiben**

Create `tests/test-sixseven-parsing.js`:
```javascript
const assert = require("assert");

function cleanName(filename) {
  return filename
    .replace(/_BLOCK/i, "")
    .replace(/_HIT/i, "")
    .replace(/_ACE/i, "")
    .replace(/_OPP/i, "")
    .replace(/_FUN/i, "")
    .replace(/_TIMEOUT/i, "")
    .replace(/_WALKON/i, "")
    .replace(/_SIXSEVEN/i, "")
    .replace(/_PAUSE\d*/i, "")
    .replace(/\.(mp3|flac|wav|ogg)$/i, "")
    .trim();
}

// Tests
assert.strictEqual(cleanName("Song_SIXSEVEN.mp3"), "Song");
assert.strictEqual(cleanName("Cool Track_sixseven.wav"), "Cool Track");
assert.strictEqual(cleanName("My Track.mp3"), "My Track");

console.log("Parsing tests passed!");
```

- [ ] **Step 2: Test ausführen und sicherstellen, dass er fehlschlägt oder läuft**

Run: `node tests/test-sixseven-parsing.js`
Expected: PASS (zeigt Korrektheit der `cleanName`-Regex-Logik).

- [ ] **Step 3: `script.js` anpassen**

In `script.js`:
1. In `cleanName(filename)` die Ersetzung `.replace(/_SIXSEVEN/i, "")` vor `_PAUSE` einfügen.
2. In `specialTracks` das Feld `sixseven: []` initialisieren:
```javascript
const specialTracks = {
  timeout: null,
  walkon: null,
  sixseven: [],
  pauses: [],
};
```
3. In `resetCategories()` sicherstellen:
```javascript
specialTracks.sixseven = [];
```
4. In `revokeAllSongUrls()` sicherstellen, dass `specialTracks.sixseven.forEach(t => t && t.url && urls.push(t.url))` enthalten ist.
5. In `handleFiles(fileList)`:
Prüfung auf `upper.includes("_SIXSEVEN")` vor der Zuordnung zu den normalen Spalten (`ass_angriff`, `block`, etc.):
```javascript
    if (upper.includes("_SIXSEVEN")) {
      specialTracks.sixseven.push({
        id: nfc(file.name),
        name: file.name,
        display: cleanName(file.name),
        category: "sixseven",
        size: file.size,
        url: URL.createObjectURL(file),
      });
      return; // Nicht in normale Kategorien einsortieren
    }
```

- [ ] **Step 4: Überprüfen mit Node Syntax-Check**

Run: `node -c script.js`
Expected: Kein Syntaxfehler (Exit code 0).

- [ ] **Step 5: Commit**

```bash
git add tests/test-sixseven-parsing.js script.js
git commit -m "feat: parse and store _SIXSEVEN tracks in specialTracks"
```

---

### Task 2: Wiedergabelogik `playSixSeven()` und Button-Zustand (`script.js`)

**Files:**
- Modify: `script.js:2640-2720` (bei den Zufalls- und Spezialfunktionen) und WebRTC-Message-Handler
- Test: `tests/test-sixseven-logic.js`

**Interfaces:**
- Consumes: `specialTracks.sixseven`, `recentPlayed`, `playCounts`
- Produces: `playSixSeven()`, `updateSpecialButtons()` Aktualisierung, WebRTC DataChannel Action `"playSixSeven"`

- [ ] **Step 1: Test für Auswahl-Logik schreiben**

Create `tests/test-sixseven-logic.js`:
```javascript
const assert = require("assert");

function pickSixSeven(tracks, recentPlayed, playCounts) {
  if (!tracks || tracks.length === 0) return null;
  if (tracks.length === 1) return tracks[0];

  const available = tracks.filter(t => !recentPlayed.includes(t.name));
  const pool = available.length > 0 ? available : tracks;

  // Min play count
  let minCount = Infinity;
  pool.forEach(t => {
    const c = playCounts[t.name] || 0;
    if (c < minCount) minCount = c;
  });
  const candidates = pool.filter(t => (playCounts[t.name] || 0) === minCount);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

const tracks = [
  { name: "song1.mp3" },
  { name: "song2.mp3" }
];
assert.strictEqual(pickSixSeven([tracks[0]], [], {}).name, "song1.mp3");

const chosen = pickSixSeven(tracks, ["song1.mp3"], {});
assert.strictEqual(chosen.name, "song2.mp3");

console.log("Logic tests passed!");
```

- [ ] **Step 2: Test ausführen**

Run: `node tests/test-sixseven-logic.js`
Expected: PASS

- [ ] **Step 3: `playSixSeven()` und Button-Update in `script.js` implementieren**

1. Funktion `playSixSeven()` erstellen:
```javascript
function playSixSeven() {
  const tracks = specialTracks.sixseven || [];
  if (tracks.length === 0) {
    showToast("Keine Songs mit _SIXSEVEN geladen");
    return;
  }
  if (tracks.length === 1) {
    playAudioTrack(tracks[0]);
    return;
  }

  // Zufallsauswahl mit Berücksichtigung von recentPlayed und playCounts
  const available = tracks.filter((t) => !recentPlayed.includes(t.name));
  const pool = available.length > 0 ? available : tracks;

  let minCount = Infinity;
  pool.forEach((t) => {
    const count = playCounts[t.name] || 0;
    if (count < minCount) minCount = count;
  });
  const candidates = pool.filter((t) => (playCounts[t.name] || 0) === minCount);
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  playAudioTrack(picked);
}
```
2. In `updateSpecialButtons()` den Zustand des Buttons `#btn-sixseven` aktualisieren:
```javascript
  const btnSixSeven = document.getElementById("btn-sixseven");
  if (btnSixSeven) {
    const hasSixSeven = specialTracks.sixseven && specialTracks.sixseven.length > 0;
    btnSixSeven.classList.toggle("opacity-50", !hasSixSeven);
    btnSixSeven.classList.toggle("cursor-not-allowed", !hasSixSeven);
    btnSixSeven.classList.toggle("opacity-100", hasSixSeven);
    btnSixSeven.classList.toggle("cursor-pointer", hasSixSeven);
  }
```
3. Im WebRTC DataChannel Message Handler (`channel.onmessage` in `script.js`):
Bei `data.action === "playSixSeven"` oder `data.command === "playSixSeven"`:
```javascript
else if (action === "playSixSeven" || command === "playSixSeven") {
  playSixSeven();
}
```
4. `window.playSixSeven = playSixSeven;` deklarieren.

- [ ] **Step 4: Syntax-Prüfung**

Run: `node -c script.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test-sixseven-logic.js script.js
git commit -m "feat: implement playSixSeven logic and WebRTC handler"
```

---

### Task 3: UI-Anpassung `index.html` und Styling `style.css`

**Files:**
- Modify: `index.html:320-335`
- Modify: `style.css:580-590`

**Interfaces:**
- Consumes: `playSixSeven()`
- Produces: HTML-Button `#btn-sixseven` in `.bottom-bar`

- [ ] **Step 1: `index.html` aktualisieren**

In `index.html`:
Die beiden Buttons `playRandomMarked('top')` und `playRandomMarked('clap')` in der unteren Leiste ersetzen durch:
```html
    <button id="btn-sixseven" onclick="playSixSeven()"
      class="bg-[#d97706] hover:bg-[#b45309] text-white rounded-xl px-2 py-4 shadow-md flex items-center justify-center text-3xl font-bold transition-opacity opacity-50 cursor-not-allowed"
      title="6/7 (_SIXSEVEN)">
      6/7
    </button>
```
Auch im Anleitungstext (`info-panel` in `index.html`) den Punkt zu den unteren Buttons aktualisieren, sodass der Button 6/7 erklärt wird.

- [ ] **Step 2: `style.css` prüfen & anpassen**

Sicherstellen, dass die 6 Spalten der `.bottom-bar` auf allen Bildschirmgrößen perfekt ausgerichtet sind:
```css
.bottom-bar {
  grid-template-columns: 0.85fr 1.9fr 1.15fr 1.05fr 1.05fr 1.35fr;
}
```
Auf mobilen Geräten oder kleineren Bildschirmen sicherstellen, dass `#btn-sixseven` eine Mindesthöhe und gut bedienbare Touch-Größe hat.

- [ ] **Step 3: Validierung im Browser / HTML Check**

Run: `grep -n "btn-sixseven" index.html`
Expected: Gefunden mit korrekten Klassen und Attributen.
Run: `grep -n "playRandomMarked" index.html`
Expected: Keine Vorkommen mehr in der unteren Leiste von `index.html`.

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: replace top/clap buttons with 6/7 button in index.html"
```

---

### Task 4: Fernbedienung anpassen (`remote.html` & `remote.js`)

**Files:**
- Modify: `remote.html:74-82`
- Modify: `remote.js:35-100`

**Interfaces:**
- Consumes: Klick auf Fernbedienung
- Produces: WebRTC Command `"playSixSeven"`

- [ ] **Step 1: Button in `remote.html` einfügen**

In `remote.html` im Abschnitt `Spezial`:
```html
    <section class="bg-gray-800 rounded-lg p-4 shadow space-y-2">
      <div class="font-semibold text-sm">Spezial</div>
      <div class="grid grid-cols-3 md:grid-cols-5 gap-3">
        <button id="special-timeout" class="bg-yellow-500 hover:bg-yellow-600 rounded px-3 py-2 font-semibold">Timeout</button>
        <button id="special-walkon" class="bg-blue-500 hover:bg-blue-600 rounded px-3 py-2 font-semibold">Walk-On</button>
        <button id="special-sixseven" class="bg-[#d97706] hover:bg-[#b45309] text-white font-bold rounded px-3 py-2">6/7</button>
        <div id="special-pauses" class="grid grid-cols-2 gap-2 col-span-2"></div>
      </div>
    </section>
```

- [ ] **Step 2: Event Listener in `remote.js` ergänzen**

In `remote.js`:
1. `btnSixSeven: document.getElementById("special-sixseven")` in `uiElements` ergänzen.
2. Event-Listener hinzufügen:
```javascript
if (ui.btnSixSeven) {
  ui.btnSixSeven.addEventListener("click", () => sendCommand("playSixSeven"));
}
```

- [ ] **Step 3: Syntax Check**

Run: `node -c remote.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add remote.html remote.js
git commit -m "feat: add 6/7 button to remote control"
```

---

### Task 5: Changelog in `version.js` aktualisieren und Gesamtprüfung

**Files:**
- Modify: `version.js`
- Test: Vollständiger Workflow-Check mit Dummy-Dateien

**Interfaces:**
- Consumes: Versionsnummer und Release-Notes
- Produces: Aktualisierte App-Version mit Beschreibung des 6/7-Features

- [ ] **Step 1: `version.js` aktualisieren**

In `version.js` Versionsnummer anpassen / neuen Eintrag im Changelog ergänzen:
- „Neu: Button 6/7 in der unteren Leiste und auf der Remote für Tracks mit Endung _SIXSEVEN.“
- „Entfernt: Buttons Top-Stimmung und Mitklatschen aus der unteren Leiste.“

- [ ] **Step 2: End-to-End Verifikation mit Test-Script**

Create and run an automated verification test `tests/test-integration.js` that parses all changed HTML and JS files, verifies syntax, button IDs, and command mappings.
Run: `node tests/test-integration.js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add version.js tests/test-integration.js
git commit -m "chore: update version changelog and add integration tests"
```
