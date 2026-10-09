# Design-Spezifikation: 6/7 Button und Kategorie für DJ-Pult SV1845 Esslingen

**Datum:** 2026-10-09  
**Status:** Bestätigt / Freigegeben  

---

## 1. Übersicht & Ziel
In der DJ-Pult PWA für die SV 1845 Esslingen sollen die beiden bisherigen Buttons **„★ Top-Stimmung“** und **„👏 Mitklatschen“** in der unteren Bedienleiste entfernt werden.
Stattdessen wird ein neuer Aktionsbutton mit dem Titel **„6/7“** eingefügt, der ausschließlich Titel mit der Dateiendung / dem Namensbestandteil `_SIXSEVEN` abspielt. Die bestehenden Markierungsfunktionen für Favoriten im Menü bleiben erhalten. Der neue Button wird ebenfalls auf der Handy-Fernbedienung (`remote.html`) integriert.

---

## 2. Benutzeroberfläche & Layout

### 2.1 Haupt-PWA (`index.html`)
- **Untere Leiste (`bottom-bar`):**
  - Entfernung des 2-Button-Containers (`top` / `clap`).
  - Neuer Vollhöhe-Button `#btn-sixseven` an gleicher Position:
    - **Beschriftung:** Ausschließlich `6/7` (kein Subtitel).
    - **Styling:** Hintergrund `#d97706` (Hover `#b45309`), weißer Text, abgerundet (`rounded-xl`), Schatten (`shadow-md`), vertikal und horizontal zentriert (`flex items-center justify-center text-2xl font-bold`).
    - **Status:** Standardmäßig leicht gedimmt (z. B. `opacity-50` oder visueller Indikator), wenn keine Songs mit `_SIXSEVEN` geladen sind; voll aktiv (`opacity-100 cursor-pointer`), sobald mindestens ein Titel vorhanden ist.
- **Layout-Raster (`style.css`):**
  - Die 6-Spalten-Struktur der `.bottom-bar` bleibt intakt: `grid-template-columns: 0.85fr 1.9fr 1.15fr 1.05fr 1.05fr 1.35fr;`.

### 2.2 Fernbedienung (`remote.html`)
- Ergänzung eines Buttons `#special-sixseven` mit Beschriftung `6/7` und Hintergrundfarbe `#d97706` in der Spezial- oder Schnellzugriffs-Sektion.

---

## 3. Datenverarbeitung & Spiellogik (`script.js` & `remote.js`)

### 3.1 Dateierkennung & Bereinigung
- `cleanName(filename)`: Entfernt `_SIXSEVEN` (case-insensitive) aus dem Anzeigenamen der Songs.
- `handleFiles(fileList)`:
  - Erkennung von `upper.includes("_SIXSEVEN")`.
  - Gefundene Titel werden in `specialTracks.sixseven` abgelegt (als Array von Song-Objekten mit `id`, `name`, `display`, `size`, `url`).
  - Titel mit `_SIXSEVEN` werden **nicht** in die 7 Hauptspalten (`categories`) eingetragen und erscheinen daher nicht im großen Pult-Raster.
  - Reset und Ressourcen-Freigabe (`resetCategories()`, `revokeAllSongUrls()`): `specialTracks.sixseven` wird bereinigt und Blob-URLs werden freigegeben.

### 3.2 Abspiel-Logik (`playSixSeven()`)
- Wenn keine Songs mit `_SIXSEVEN` geladen sind: Kurzer Hinweis / Feedback („Keine Songs mit _SIXSEVEN geladen“).
- Wenn genau 1 Song vorhanden ist: Dieser wird direkt mit `playAudioTrack(song)` abgespielt.
- Wenn mehrere Songs vorhanden sind:
  - Intelligente Zufallsauswahl analog zu den bestehenden Kategorien:
    - Berücksichtigung der Spielzähler (`playCount`): selten gespielte Tracks werden bevorzugt.
    - Überspringen der zuletzt gespielten 4 Songs (`recentPlayed`), um direkte Wiederholungen zu vermeiden.
- Integration in Play-Counting & History: Gespielte `_SIXSEVEN`-Tracks aktualisieren den Spielzähler und die History.
- Wellenform- & Drop-Anzeige: Wellenformen aus `waveforms.json` und Drop-Countdowns funktionieren auch für `_SIXSEVEN`-Tracks im Now-Playing-Banner.

### 3.3 Remote-Anbindung (`remote.js`)
- Button `#special-sixseven` sendet den Befehl `{ action: "specialSixSeven" }` bzw. `{ action: "playSixSeven" }` über den WebRTC-DataChannel.
- In `script.js` wird die eingehende Nachricht ausgewertet und ruft `playSixSeven()` auf.

### 3.4 Markierungen
- Die Markierungs-Tabs und das Kontextmenü (langes Drücken) für *Top-Stimmung* und *Mitklatschen* bleiben im Verwaltungsdialog (`marks-panel`) erhalten, sodass DJs Songs weiterhin als Favoriten kategorisieren können.

---

## 4. Tests & Validierung
1. **Laden von Testdateien:**
   - Dateinamen mit `_SIXSEVEN` (z. B. `Song_SIXSEVEN.mp3`).
   - Überprüfung, dass die Songs nicht im 7-Spalten-Raster auftauchen.
2. **Klick auf „6/7“:**
   - Ohne Songs: Hinweis-Meldung.
   - Mit 1 Song: Song startet zuverlässig.
   - Mit mehreren Songs: Zufallsauswahl funktioniert ohne direkte Wiederholungen.
3. **UI & Farbgebung:**
   - Button zeigt exakt `6/7`, Farbe `#d97706`, kein Subtitel.
   - Layout auf Desktop und Mobile/iPad bricht nicht um.
4. **Remote-Test:**
   - Klick auf der Fernbedienung steuert das DJ-Pult korrekt an.
