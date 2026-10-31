const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "situation-ui.js"), "utf8");
const start = source.indexOf("function generateBrief(kind){");
const end = source.indexOf("\nfunction initSituationUI()", start);
assert.ok(start >= 0 && end > start, "Brief handler must be present");
const handler = source.slice(start, end);

assert.match(handler, /BX\.build\(/, "Brief must still build the evidence assessment");
assert.match(handler, /generateBriefLiveDetails\(kind\)/, "Brief must retain live details");
assert.doesNotMatch(handler, /\bawait\b/, "Opening a brief must not wait on a remote response");
assert.doesNotMatch(handler, /\bloadNews\s*\(/, "News is refreshed independently");
assert.doesNotMatch(handler, /\binitEventEngine\s*\(/, "Events are refreshed independently");
assert.match(handler, /finally\s*\{briefPending=false\}/, "Re-entry guard must be released");

console.log("Non-blocking Morning/Evening Brief configuration passed");
