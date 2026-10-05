// Zentrale Versionsnummer (wird von der Seite UND vom Service Worker genutzt).
// MAJOR.MINOR: MAJOR bei grossen Aenderungen/neuen Features, MINOR bei kleineren Anpassungen.
// Bei jeder Aenderung: APP_VERSION/APP_BUILD hochzaehlen UND oben in APP_CHANGELOG einen Eintrag ergaenzen.
// -> neuer Cache, und das Pult zeigt auf dem Geraet, welche Version mit welchen Aenderungen laeuft.
const APP_VERSION = "1.4";
const APP_BUILD = "2026-10-05";

// Neueste Version zuerst.
const APP_CHANGELOG = [
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
