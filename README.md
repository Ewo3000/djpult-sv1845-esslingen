# Volleyball DJ Pult (statische PWA)

- DJ-Pult für die Volleyball-Halle: Musik-Snippets nach Kategorien abspielen (Play, Stop mit Fade, Lautstärke).
- Wichtige Dateien: `index.html` (UI), `script.js` (Logik & Button-Aufbau), `style.css` (Styles), `service-worker.js` (Offline-Cache der App-Dateien), `manifest.json` (App-Metadaten), `remote.html`/`remote.js` (Fernbedienung), `static/images/`.
- Die Musik liegt **nicht** im Repo (Urheberrecht). Sie wird in der App über die Dateiauswahl geladen und nicht gecacht.
- Lokal testen: Im Repo-Ordner `python -m http.server 8000` starten, dann `http://localhost:8000` öffnen.
- Hosting: Der Ordner kann 1:1 auf statischen Hostern (z. B. GitHub Pages) genutzt werden.
- Deploy: Der Workflow `Deploy to Public Repo` (manuell auslösbar) schiebt `main` ins öffentliche Repo.

## Musikordner

Ordner mit den Songs auswählen; Unterordner `special_music/` enthält die Spezialtracks. Die Kategorie ergibt sich aus dem Dateinamen:

| Suffix im Namen | Kategorie |
| --- | --- |
| `_HIT`, `_ACE` | Ass/Angriff |
| `_BLOCK` | Block |
| `_OPP` | Gegner |
| `_FUN` | Lustig |
| ohne Suffix | verteilt auf die drei grünen Spalten |

Spezial (`special_music/`): `_TIMEOUT`, `_WALKON`, `_PAUSE1`, `_PAUSE2`, ... Unterstützte Formate: mp3, flac, wav, ogg.

## Kurven und Drop-Countdown

- `tools/analyse.html` (am PC in Chrome/Edge öffnen) berechnet pro Song die Lautstärkekurve und erkennt Drops. Ergebnis: `waveforms.json` im Ordner `Diesen Ordner Laden`.
- Die App liest die Datei beim Laden der Songs automatisch ein und zeigt Kurve und Countdown (5 / 3 / DROP) im Now-Playing an.
- Nur neue oder geänderte Songs werden neu berechnet. Die App weist beim Laden auf Songs ohne Kurve hin.
- Die Analyse-Logik steckt in `tools/analyse-core.js` (läuft komplett im Browser, nichts wird hochgeladen).

## WebRTC-Remote (Tablet = Player, Handy = Remote)
- Player-Seite öffnen (`index.html`), Songs laden, dann `Remote koppeln` öffnen.
- `Offer erzeugen` → QR/Text am Remote-Gerät (`remote.html`) scannen/einfügen.
- Remote erzeugt automatisch eine Answer → QR/Text zurück zum Player (`Answer anwenden`).
- Sobald der DataChannel offen ist: Status "Verbunden", Remote fordert Songs an.
- Commands (JSON über DataChannel): `play`, `stop`, `randomStandard`, `randomOpponent`, `special{timeout|walkon|pause}`, `volume`, `requestSongs`; Player sendet `songsList` (ohne Gegner-Kategorie) und `nowPlaying`.
- Fallback: Offer/Answer können jederzeit per Text kopiert/eingefügt werden; QR-Scan via Kamera (jsQR) möglich.
