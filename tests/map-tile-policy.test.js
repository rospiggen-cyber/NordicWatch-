const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// The OSM tile service requires a valid Referer for browser requests.
// A document-wide no-referrer policy causes newly loaded tiles to receive 403.
assert.match(html, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
assert.doesNotMatch(html, /<meta name="referrer" content="no-referrer">/);

// Keep the tile endpoint aligned with the OSM Foundation usage policy.
assert.match(html, /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
assert.doesNotMatch(html, /https:\/\/\{s\}\.tile\.openstreetmap\.org/);

// Attribution must remain visible for the OSM basemap.
assert.match(html, /attribution:"&copy; OpenStreetMap contributors"/);

console.log("OSM tile policy configuration tests passed");
