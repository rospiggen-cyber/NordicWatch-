import assert from "node:assert/strict";
import fs from "node:fs";
const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
for(const token of ["MILITARY_CAPABILITY_CHANGE","ballistic missile","successfully tested","approved for purchase","North Atlantic","military-capability-change"])assert(html.includes(token),`client news discovery missing ${token}`);
assert.match(html,/Math\.max\(standard,capability\.score\)/);
assert.match(html,/event\.tags\.join/);
console.log("capability news integration tests passed");
