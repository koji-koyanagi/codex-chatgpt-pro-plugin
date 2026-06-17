import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildRepoContextBundle } from "../src/repo-context-bundle.mjs";

const contextRoot = mkdtempSync(resolve(tmpdir(), "chatgpt-repo-context-"));

try {
  const result = buildRepoContextBundle({
    name: "selftest",
    contextRoot,
    maxFileBytes: 200_000,
    maxTotalBytes: 2_000_000,
  });
  assert.equal(existsSync(result.context), true);
  assert.equal(existsSync(result.manifest), true);
  assert.equal(existsSync(result.zip), true);

  const text = readFileSync(result.context, "utf8");
  const manifest = JSON.parse(readFileSync(result.manifest, "utf8"));
  assert.equal(manifest.contextFile, "repo-context.md");
  assert.equal(typeof manifest.contextSha256, "string");
  assert.ok(manifest.files.length > 0);
  assert.ok(manifest.directories.length > 0);
  assert.ok(text.includes("# Source Map"));
  assert.ok(text.includes("## File: package.json"));

  const packageRecord = manifest.files.find((entry) => entry.file === "package.json");
  assert.equal(packageRecord.context.included, true);
  assert.ok(packageRecord.context.startLine > 0);
  assert.ok(packageRecord.context.endLine >= packageRecord.context.startLine);
} finally {
  rmSync(contextRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, tested: "repo-context-bundle" }, null, 2));
