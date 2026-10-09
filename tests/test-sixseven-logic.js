const assert = require("assert");

function pickSixSeven(tracks, recentPlayed, playCounts) {
  if (!tracks || tracks.length === 0) return null;
  if (tracks.length === 1) return tracks[0];

  const available = tracks.filter((t) => !recentPlayed.includes(t.name));
  const pool = available.length > 0 ? available : tracks;

  let minCount = Infinity;
  pool.forEach((t) => {
    const count = playCounts[t.name] || 0;
    if (count < minCount) minCount = count;
  });
  const candidates = pool.filter((t) => (playCounts[t.name] || 0) === minCount);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

const tracks = [
  { name: "song1.mp3" },
  { name: "song2.mp3" },
  { name: "song3.mp3" },
];

// Single track
assert.strictEqual(pickSixSeven([tracks[0]], [], {}).name, "song1.mp3");

// Filter recentPlayed
assert.strictEqual(pickSixSeven(tracks, ["song1.mp3", "song2.mp3"], {}).name, "song3.mp3");

// Filter by playCounts
const chosenLow = pickSixSeven(tracks, [], { "song1.mp3": 5, "song2.mp3": 1, "song3.mp3": 4 });
assert.strictEqual(chosenLow.name, "song2.mp3");

console.log("Logic tests passed!");
