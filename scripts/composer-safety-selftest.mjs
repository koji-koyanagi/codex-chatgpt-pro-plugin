import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/chatgpt-composer.mjs", "utf8");

assert.match(source, /data-testid"\) === "send-button"/);
assert.match(source, /candidate\.id === "composer-submit-button"/);
assert.match(source, /composer-submit/);
assert.match(source, /音声\|マイク/);
assert.equal(source.includes("looksLikeSend = /send|submit/i"), false);

console.log(JSON.stringify({ ok: true, tested: "composer-safety" }, null, 2));
