const fs = require("fs");
const path = require("path");
const assert = require("assert");

const repoDir = path.resolve(__dirname, "..");

// 1. Check index.html
const indexHtml = fs.readFileSync(path.join(repoDir, "index.html"), "utf8");
assert(indexHtml.includes('id="btn-sixseven"'), "index.html missing btn-sixseven");
assert(indexHtml.includes("6/7"), "index.html missing 6/7 label");
assert(indexHtml.includes("bg-[#d97706]"), "index.html missing bg-[#d97706]");
assert(!indexHtml.includes("playRandomMarked('top')"), "index.html still has top marked button");
assert(!indexHtml.includes("playRandomMarked('clap')"), "index.html still has clap marked button");

// 2. Check remote.html
const remoteHtml = fs.readFileSync(path.join(repoDir, "remote.html"), "utf8");
assert(remoteHtml.includes('id="special-sixseven"'), "remote.html missing special-sixseven");
assert(remoteHtml.includes("6/7"), "remote.html missing 6/7 button text");
assert(remoteHtml.includes("bg-[#d97706]"), "remote.html missing bg-[#d97706]");

// 3. Check remote.js
const remoteJs = fs.readFileSync(path.join(repoDir, "remote.js"), "utf8");
assert(remoteJs.includes('document.getElementById("special-sixseven")'), "remote.js missing special-sixseven selector");
assert(remoteJs.includes('sendCommand("playSixSeven")'), "remote.js missing sendCommand('playSixSeven')");

// 4. Check script.js
const scriptJs = fs.readFileSync(path.join(repoDir, "script.js"), "utf8");
assert(scriptJs.includes("/_SIXSEVEN/i"), "script.js cleanName missing _SIXSEVEN regex");
assert(scriptJs.includes("sixseven: []"), "script.js specialTracks missing sixseven array");
assert(scriptJs.includes("function playSixSeven()"), "script.js missing function playSixSeven");
assert(scriptJs.includes('case "playSixSeven":'), "script.js missing WebRTC playSixSeven command handler");
assert(scriptJs.includes('payload.type === "sixseven"'), "script.js missing sixseven special payload handler");

// 5. Check version.js
const versionJs = fs.readFileSync(path.join(repoDir, "version.js"), "utf8");
assert(versionJs.includes('APP_VERSION = "4.29"'), "version.js missing APP_VERSION 4.29");
assert(versionJs.includes("6/7"), "version.js changelog missing 6/7");

console.log("All integration assertions passed cleanly!");
