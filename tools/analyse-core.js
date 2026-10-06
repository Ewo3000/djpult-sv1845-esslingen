// Analyse eines Songs: Lautstaerkekurve (2 Punkte pro Sekunde) und Drop-Erkennung.
// Reine Rechenfunktionen ohne Browser-Abhaengigkeit, damit App und Analyse-Werkzeug dasselbe nutzen.
(function (root) {
  const CURVE_RATE = 2; // Kurvenpunkte pro Sekunde
  const WINDOW_S = 0.25; // Fenster fuer die Energiemessung
  const FLOOR_DB = -60;
  // Drop-Erkennung (anhand deiner bestaetigten Songs abgestimmt)
  const DROP_PRE_S = 4; // Vergleichsfenster vor dem Drop
  const DROP_POST_S = 3; // Vergleichsfenster nach dem Drop
  const DROP_MIN_PRE_S = 0.75; // mindestens so viel Song muss davor vorhanden sein
  const DROP_QUIET_BELOW_DB = 4; // davor mindestens so viel leiser als das Hochniveau (Pegel ODER Bass)
  const DROP_REACH_WITHIN_DB = 4; // danach nahe am Hochniveau des Songs
  const DROP_MIN_JUMP_DB = 6.5; // Mindestsprung (gewichtet Pegel/Bass)
  const DROP_EARLY_MIN_JUMP_DB = 5; // etwas milder bei 2 bis 10 s, dort ist das Vergleichsfenster kurz
  const DROP_EARLY_UNTIL_S = 10;
  const DROP_LATE_FROM_S = 30; // ein erster Drop ab hier muss stark sein ...
  const DROP_LATE_FIRST_MIN_JUMP_DB = 9; // ... sonst zaehlt er nicht
  const DROP_FULL_JUMP_DB = 15; // ab hier volle Sicherheit
  const DROP_SILENT_START_DB = 12; // erstes Fenster so viel unter dem Hochniveau = Einblendung
  const DROP_MIN_GAP_S = 8; // Mindestabstand zwischen zwei Drops

  function toMono(channels) {
    if (channels.length === 1) return channels[0];
    const length = channels[0].length;
    const mono = new Float32Array(length);
    for (let c = 0; c < channels.length; c += 1) {
      const data = channels[c];
      for (let i = 0; i < length; i += 1) mono[i] += data[i] / channels.length;
    }
    return mono;
  }

  // einfacher Tiefpass (Einpol), reicht, um Bass/Kick von den Hoehen zu trennen
  function lowpass(samples, sampleRate, cutoff) {
    const out = new Float32Array(samples.length);
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / sampleRate;
    const alpha = dt / (rc + dt);
    let prev = 0;
    for (let i = 0; i < samples.length; i += 1) {
      prev += alpha * (samples[i] - prev);
      out[i] = prev;
    }
    return out;
  }

  function windowDb(samples, sampleRate, windowSec) {
    const size = Math.max(1, Math.round(sampleRate * windowSec));
    const count = Math.floor(samples.length / size);
    const result = new Float32Array(count);
    for (let w = 0; w < count; w += 1) {
      let sum = 0;
      const start = w * size;
      for (let i = 0; i < size; i += 1) {
        const v = samples[start + i];
        sum += v * v;
      }
      const rms = Math.sqrt(sum / size);
      result[w] = Math.max(FLOOR_DB, 20 * Math.log10(Math.max(rms, 1e-6)));
    }
    return result;
  }

  function mean(array, from, to) {
    const start = Math.max(0, from);
    const end = Math.min(array.length, to);
    if (end <= start) return NaN;
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += array[i];
    return sum / (end - start);
  }

  function percentile(values, p) {
    const sorted = Array.from(values).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
  }

  function buildCurve(allDb, duration) {
    const perPoint = Math.round(1 / WINDOW_S / CURVE_RATE); // Fenster pro Kurvenpunkt
    const points = Math.max(1, Math.ceil(duration * CURVE_RATE));
    const raw = new Float32Array(points);
    for (let p = 0; p < points; p += 1) {
      const v = mean(allDb, p * perPoint, (p + 1) * perPoint);
      raw[p] = Number.isNaN(v) ? FLOOR_DB : v;
    }
    const lo = percentile(raw, 0.05);
    const hi = percentile(raw, 0.99);
    const span = Math.max(6, hi - lo);
    const curve = new Uint8Array(points);
    for (let p = 0; p < points; p += 1) {
      curve[p] = Math.round(255 * Math.min(1, Math.max(0, (raw[p] - lo) / span)));
    }
    return curve;
  }

  function smooth(array, size) {
    return Array.from(array, (_, i) => mean(array, i - Math.floor(size / 2), i + Math.ceil(size / 2)));
  }

  // Findet alle Drops: deutlicher, anhaltender Anstieg von Pegel und Bass nach einem leiseren Abschnitt,
  // der danach das Hochniveau des Songs erreicht. Ergebnis: Liste {time, confidence, jump}.
  function detectDrops(allDbIn, lowDbIn) {
    // Beginnt der Song mit einem nahezu stillen ersten Fenster (Einblendung), wuerde der Anstieg danach
    // wie ein Drop aussehen. Dann die ersten 0,5 s wie das folgende Fenster behandeln.
    const allDb = Array.from(allDbIn);
    const lowDb = Array.from(lowDbIn);
    if (allDb.length > 4 && allDb[0] < percentile(smooth(allDb, 4), 0.85) - DROP_SILENT_START_DB) {
      for (let i = 0; i < 2; i += 1) {
        allDb[i] = allDb[2];
        lowDb[i] = lowDb[2];
      }
    }
    const sAll = smooth(allDb, 4);
    const sLow = smooth(lowDb, 4);
    const refAll = percentile(sAll, 0.85);
    const refLow = percentile(sLow, 0.85);
    const pre = Math.round(DROP_PRE_S / WINDOW_S);
    const post = Math.round(DROP_POST_S / WINDOW_S);
    const n = allDb.length;
    const jumps = new Array(n).fill(-Infinity);
    for (let t = Math.round(DROP_MIN_PRE_S / WINDOW_S); t < n - Math.round(1.5 / WINDOW_S); t += 1) {
      const preAll = mean(sAll, t - pre, t);
      const postAll = mean(sAll, t, t + post);
      const preLow = mean(sLow, t - pre, t);
      const postLow = mean(sLow, t, t + post);
      if ([preAll, postAll, preLow, postLow].some(Number.isNaN)) continue;
      if (preAll > refAll - DROP_QUIET_BELOW_DB && preLow > refLow - DROP_QUIET_BELOW_DB) continue;
      if (postAll < refAll - DROP_REACH_WITHIN_DB) continue;
      jumps[t] = 0.4 * (postAll - preAll) + 0.6 * (postLow - preLow);
    }
    const gap = Math.round(DROP_MIN_GAP_S / WINDOW_S);
    const drops = [];
    for (let t = 0; t < n; t += 1) {
      const seconds = t * WINDOW_S;
      const threshold = seconds >= 2 && seconds < DROP_EARLY_UNTIL_S ? DROP_EARLY_MIN_JUMP_DB : DROP_MIN_JUMP_DB;
      if (jumps[t] < threshold) continue;
      let isMax = true;
      for (let k = Math.max(0, t - gap); k <= Math.min(n - 1, t + gap); k += 1) {
        if (jumps[k] > jumps[t]) {
          isMax = false;
          break;
        }
      }
      if (!isMax) continue;
      const confidence = Math.min(1, Math.max(0, (jumps[t] - 5) / (DROP_FULL_JUMP_DB - 5)));
      drops.push({
        time: Math.round(seconds * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
        jump: Math.round(jumps[t] * 10) / 10,
      });
    }
    // Ein erster Drop erst spaet im Song muss stark sein; schwache Spruenge ohne frueheren Drop sind meist keine
    const kept = [];
    drops.forEach((drop) => {
      if (kept.length === 0 && drop.time >= DROP_LATE_FROM_S && drop.jump < DROP_LATE_FIRST_MIN_JUMP_DB) return;
      kept.push(drop);
    });
    return kept;
  }

  // Pegel eines Songs: "level" = Pegel der lauten Teile, "integrated" = Gesamtpegel (mit relativem Gate)
  function loudnessStats(allDb) {
    const audible = Array.from(allDb).filter((v) => v > FLOOR_DB + 0.5);
    if (!audible.length) return { level: FLOOR_DB, integrated: FLOOR_DB };
    const meanDb = (values) => 10 * Math.log10(values.reduce((sum, v) => sum + Math.pow(10, v / 10), 0) / values.length);
    const ungated = meanDb(audible);
    const gated = audible.filter((v) => v > ungated - 10);
    return {
      level: Math.round(percentile(audible, 0.85) * 10) / 10,
      integrated: Math.round(meanDb(gated.length ? gated : audible) * 10) / 10,
    };
  }

  // channels: Array von Float32Array (Rohdaten je Kanal), sampleRate in Hz
  function analyzeSamples(channels, sampleRate) {
    const mono = toMono(channels);
    const duration = mono.length / sampleRate;
    const allDb = windowDb(mono, sampleRate, WINDOW_S);
    const lowDb = windowDb(lowpass(mono, sampleRate, 150), sampleRate, WINDOW_S);
    return {
      duration: Math.round(duration * 10) / 10,
      curve: buildCurve(allDb, duration),
      drops: detectDrops(allDb, lowDb),
      loudness: loudnessStats(allDb),
    };
  }

  // Rohe Energiewerte (fuer Auswertung und Feinabstimmung der Erkennung)
  function computeWindows(channels, sampleRate) {
    const mono = toMono(channels);
    return {
      duration: mono.length / sampleRate,
      allDb: windowDb(mono, sampleRate, WINDOW_S),
      lowDb: windowDb(lowpass(mono, sampleRate, 150), sampleRate, WINDOW_S),
    };
  }

  const api = { analyzeSamples, computeWindows, detectDrops, CURVE_RATE, WINDOW_S };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DjAnalyse = api;
})(typeof self !== "undefined" ? self : this);
