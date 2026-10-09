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
assert.strictEqual(cleanName("Party_SIXSEVEN.ogg"), "Party");

console.log("Parsing tests passed!");
