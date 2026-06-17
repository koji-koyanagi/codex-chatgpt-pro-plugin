import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = resolve(repoRoot, "plugins", "codex-chatgpt-pro-plugin");

const entries = [
  [".codex-plugin", ".codex-plugin"],
  ["skills", "skills"],
  ["bin", "bin"],
  ["src", "src"],
  ["scripts", "scripts"],
  ["docs", "docs"],
  ["LICENSE", "LICENSE"],
  ["README.md", "README.md"],
  ["package.json", "package.json"],
  ["package-lock.json", "package-lock.json"],
];

rmSync(pluginRoot, { recursive: true, force: true });
mkdirSync(pluginRoot, { recursive: true });

for (const [source, destination] of entries) {
  cpSync(resolve(repoRoot, source), resolve(pluginRoot, destination), {
    recursive: true,
    dereference: true,
    filter: (path) => {
      const normalized = path.split("/").join("/");
      return !normalized.includes("/.DS_Store")
        && !normalized.includes("/.devspace/")
        && !normalized.includes("/.git/")
        && !normalized.includes("/node_modules/")
        && !normalized.includes("/docs/assets");
    },
  });
}

console.log(JSON.stringify({
  ok: true,
  synced: pluginRoot,
  entries: entries.map(([, destination]) => destination),
}, null, 2));
