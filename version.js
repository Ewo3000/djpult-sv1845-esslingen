// Zentrale Versionsnummer (wird von der Seite UND vom Service Worker genutzt).
// MAJOR.MINOR: MAJOR bei grossen Aenderungen/neuen Features, MINOR bei kleineren Anpassungen.
// Bei jeder Aenderung: APP_VERSION/APP_BUILD hochzaehlen UND oben in APP_CHANGELOG einen Eintrag ergaenzen.
// -> neuer Cache, und das Pult zeigt auf dem Geraet, welche Version mit welchen Aenderungen laeuft.
const APP_VERSION = "2.1";
const APP_BUILD = "2026-10-05";

// Neueste Version zuerst.
const APP_CHANGELOG = [
  {
    version: "2.1",
    date: "2026-10-05",
    changes: [
      "Fix iPad-Safari: Kopfleiste verdeckt nach dem Laden der Songs nicht mehr die erste Reihe.",
    ],
  },
  {
    version: "2.0",
    date: "2026-10-05",
    changes: [
      "Neues Design: dezente Farben, Emojis entfernt, mehr Platz für Songtitel.",
      "Spalten mit Farblinie und Songanzahl, grüne Spalten heißen Sonstiges 1–3.",
      "Play-Zähler als kleine Zahl im Button; Heatmap-Logik unverändert.",
    ],
  },
  {
    version: "1.5",
    date: "2026-10-05",
    changes: [
      "App-Installation verbessert: vollständiges Manifest, neue Symbole (auch 512 px, abgerundet).",
      "Info-Feld erklärt, wie man die App installiert.",
    ],
  },
  {
    version: "1.4",
    date: "2026-10-05",
    changes: [
      "Versions-Feld zeigt jetzt die Änderungen jeder Version.",
      "Info-Feld ist eine ausführliche Bedienungsanleitung.",
    ],
  },
  {
    version: "1.3",
    date: "2026-10-05",
    changes: [
      "iPad: Vollbild-Start vom Home-Bildschirm, Symbol, kein versehentliches Zoomen.",
      "Aufgeräumt: altes docs-Verzeichnis und Debug-Ausgaben entfernt.",
    ],
  },
  {
    version: "1.2",
    date: "2026-10-05",
    changes: ["Fix: Updates kommen zuverlässig an (kein veralteter Cache mehr)."],
  },
  {
    version: "1.1",
    date: "2026-10-05",
    changes: [
      "Neu: Versionsanzeige neben dem Info-Button.",
      "Offline-Cache nur noch für App-Dateien, Updates im Hintergrund.",
    ],
  },
  {
    version: "1.0",
    date: "2025-12-19",
    changes: [
      "Ausgangsstand: Kategorien, Suche, Zufall, Play-Zähler mit Heatmap, Remote per WebRTC.",
    ],
  },
];
