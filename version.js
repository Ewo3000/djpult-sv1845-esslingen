// Zentrale Versionsnummer (wird von der Seite UND vom Service Worker genutzt).
// MAJOR.MINOR: MAJOR bei grossen Aenderungen/neuen Features, MINOR bei kleineren Anpassungen.
// Bei jeder Aenderung: APP_VERSION/APP_BUILD hochzaehlen UND oben in APP_CHANGELOG einen Eintrag ergaenzen.
// -> neuer Cache, und das Pult zeigt auf dem Geraet, welche Version mit welchen Aenderungen laeuft.
const APP_VERSION = "4.11";
const APP_BUILD = "2026-10-06";

// Neueste Version zuerst.
const APP_CHANGELOG = [
  {
    version: "4.11",
    date: "2026-10-06",
    changes: ["Info- und Versionsfeld schließen sich beim Tippen daneben (zum Beispiel auf einen Song); es ist immer nur eines offen."],
  },
  {
    version: "4.10",
    date: "2026-10-06",
    changes: ["Zufall: Vorhören in der Verwaltung zählt nicht mehr als zuletzt gespielt; Anleitung erklärt die Sperre der letzten 4 Songs."],
  },
  {
    version: "4.9",
    date: "2026-10-06",
    changes: ["Anleitung und Analyse-Werkzeug nennen jetzt den Ordner „Diesen Ordner Laden“."],
  },
  {
    version: "4.8",
    date: "2026-10-06",
    changes: ["Fix: Das Drop-Schild am Song-Button bleibt nicht mehr stehen, wenn ein Song aus einer anderen Kategorie gestartet wird."],
  },
  {
    version: "4.7",
    date: "2026-10-06",
    changes: [
      "Song-Analyse misst jetzt auch den Pegel jedes Songs (nach dem Update einmal neu ausführen).",
      "Reiter Zu leise: Vorschläge für Songs ab 3 dB unter dem Median, mit Abstand in dB und Anhören.",
    ],
  },
  {
    version: "4.6",
    date: "2026-10-06",
    changes: [
      "Fix: Songs mit Umlauten oder Akzenten (zum Beispiel Mädchen auf dem Pferd, Sarà perché ti amo) bekommen jetzt ihre Kurve; Markierungen und Zähler gelten geräteübergreifend.",
    ],
  },
  {
    version: "4.5",
    date: "2026-10-06",
    changes: ["Fix: Anhören ab dem Drop bricht bei manchen Songs (FLAC auf dem iPad) nicht mehr ab; notfalls startet der Song von vorn."],
  },
  {
    version: "4.4",
    date: "2026-10-06",
    changes: ["Langdruck-Menü am Song: Drop-Zeit direkt korrigieren, „Kein Drop“ wählen und ab dem Drop anhören."],
  },
  {
    version: "4.3",
    date: "2026-10-06",
    changes: [
      "Songs ohne Kurve sind mit einem kleinen ≈ markiert; Hinweis und Drops-Reiter nennen die Songs beim Namen.",
      "Verwaltung zeigt, was noch ungesichert ist (Markierungen und Drop-Korrekturen).",
    ],
  },
  {
    version: "4.2",
    date: "2026-10-06",
    changes: [
      "Verwaltung: neuer Reiter Drops mit erkannter Drop-Zeit pro Song, Anhören ab kurz vor dem Drop und manueller Korrektur.",
      "Reiter Langer Aufbau zeigt Vorschläge (erster Drop ab 10 s) zum Übernehmen.",
      "Korrekturen werden mit den Markierungen in markierungen.json gesichert.",
    ],
  },
  {
    version: "4.1",
    date: "2026-10-06",
    changes: ["Now Playing ist breiter (nutzt den freien Platz der oberen Leiste), die Kurve ist dadurch besser lesbar."],
  },
  {
    version: "4.0",
    date: "2026-10-06",
    changes: [
      "Neu: Lautstärkekurve des laufenden Songs in Now Playing, mit Markierung des Drops.",
      "Neu: Drop-Countdown (Drop in 5 … 3 rot, DROP!) im Now Playing und am laufenden Song-Button.",
      "Neu: Song-Analyse als Werkzeug (tools/analyse.html), erzeugt waveforms.json im Musikordner.",
      "Hinweis beim Laden, wenn Songs noch keine Kurve haben.",
    ],
  },
  {
    version: "3.9",
    date: "2026-10-06",
    changes: ["Now Playing zeigt links die Restzeit und rechts die bereits gespielte Zeit."],
  },
  {
    version: "3.8",
    date: "2026-10-06",
    changes: [
      "Info-Feld neu: größer, in Reiter gegliedert (Start, Bedienung, Dateien, Markierungen, Remote und App), mit allen vier Markierungen.",
      "Info-, Versions- und Markierungsfenster enden immer über der unteren Leiste.",
    ],
  },
  {
    version: "3.7",
    date: "2026-10-06",
    changes: [
      "Erinnerung ans Sichern: kleiner Hinweis nach ein paar Änderungen und beim Start, wenn noch etwas ungesichert ist.",
      "Letzter Stand wiederherstellbar (vor Zurücksetzen und vor dem Einlesen einer anderen Datei).",
    ],
  },
  {
    version: "3.6",
    date: "2026-10-06",
    changes: [
      "Zwei neue Markierungen ohne Button: Langer Aufbau (Drop kommt spät) und Zu leise (Lautstärke nacharbeiten).",
      "Beide stehen im Menü beim langen Druck, in der Verwaltung als Reiter und in der markierungen.json.",
    ],
  },
  {
    version: "3.5",
    date: "2026-10-06",
    changes: ["Stop-Button größer und mit Symbol; Eigene Punkte und Gegnerpunkte etwas schmaler."],
  },
  {
    version: "3.4",
    date: "2026-10-06",
    changes: [
      "Sichern erzeugt keine zusätzliche Textdatei mehr.",
      "Beim Laden wird bei mehreren Markierungsdateien (markierungen 2.json …) automatisch die neueste genommen.",
    ],
  },
  {
    version: "3.3",
    date: "2026-10-06",
    changes: [
      "Zufall schärfer: Songs mit den wenigsten Wiedergaben werden klar bevorzugt, oft gespielte kommen deutlich seltener.",
      "Die zuletzt gespielten Songs werden beim Zufall übersprungen (gilt für alle vier Zufall-Buttons).",
    ],
  },
  {
    version: "3.2",
    date: "2026-10-06",
    changes: [
      "Neu: Zufall-Buttons Top-Stimmung und Mitklatschen in der unteren Leiste.",
      "Untere Leiste neu aufgeteilt (Pause-Buttons, Eigene/Gegnerpunkte und Stop etwas schmaler).",
    ],
  },
  {
    version: "3.1",
    date: "2026-10-06",
    changes: ["Markierungen: In den Gruppen-Reitern stehen jetzt beide Schalter (Top und Klatschen) plus Entfernen."],
  },
  {
    version: "3.0",
    date: "2026-10-06",
    changes: [
      "Neu: Markierungen Top-Stimmung und Mitklatschen (lange auf einen Song drücken oder über den Button Markierungen).",
      "Verwaltungsfenster mit Suche, Anhören, Entfernen und Verschieben zwischen den Gruppen.",
      "Sichern als markierungen.json in den Musikordner; wird beim Laden der Songs automatisch eingelesen.",
    ],
  },
  {
    version: "2.7",
    date: "2026-10-06",
    changes: [
      "Heatmap deutlicher: selten gespielte Songs leuchten, oft gespielte werden blasser; Song mit den wenigsten Wiedergaben hat einen hellen Rahmen.",
    ],
  },
  {
    version: "2.6",
    date: "2026-10-06",
    changes: [
      "Zufall-Buttons umbenannt: Eigene Punkte (Stimmungslieder) und Gegnerpunkte (Durchatmen).",
    ],
  },
  {
    version: "2.5",
    date: "2026-10-05",
    changes: ["Remote-Seite hat oben einen Button zurück zum DJ-Pult."],
  },
  {
    version: "2.4",
    date: "2026-10-05",
    changes: [
      "Stabilität: Audio wird nach einer iPad-Unterbrechung (Sperren, Geführter Zugriff) wieder fortgesetzt.",
      "Sichtbare Meldung, wenn ein Song nicht abgespielt werden kann.",
      "Beim erneuten Laden werden alte Dateiverweise freigegeben (weniger Speicher).",
    ],
  },
  {
    version: "2.3",
    date: "2026-10-05",
    changes: ["Neues App-Symbol für den Home-Bildschirm (Wappen mit Soundwave-Hintergrund)."],
  },
  {
    version: "2.2",
    date: "2026-10-05",
    changes: [
      "Laufender Song ist im Raster hervorgehoben (Rahmen, Leuchten, Equalizer).",
      "Now Playing zeigt einen Fortschrittsbalken der Restzeit.",
      "Kopfleiste aufgeräumt: eine geschlossene Leiste, Reset dezenter.",
      "Leichte Animationen (Drücken, Info-Felder); abschaltbar über die Systemeinstellung Bewegung reduzieren.",
    ],
  },
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
