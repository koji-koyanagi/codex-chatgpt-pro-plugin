import assert from "node:assert/strict";
import {
  accessSync,
  constants,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(".");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const pluginName = pkg.name;
const codexHome = mkdtempSync(resolve(tmpdir(), "chatgpt-pro-plugin-home-"));

function executable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveCodexCommand() {
  if (process.env.CODEX_CLI && executable(process.env.CODEX_CLI)) return process.env.CODEX_CLI;
  const candidates = String(process.env.PATH || "")
    .split(":")
    .filter(Boolean)
    .map((dir) => resolve(dir, "codex"))
    .filter(executable);
  return candidates.find((path) => !path.includes("/node_modules/.bin/"))
    || candidates[0]
    || "codex";
}

const codexCommand = resolveCodexCommand();

function run(command, args, { cwd = repoRoot, env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      ...env,
    },
  });
  assert.equal(
    result.status,
    0,
    [
      `${command} ${args.join(" ")}`,
      result.stderr,
      result.stdout,
    ].filter(Boolean).join("\n"),
  );
  return result;
}

function runCodex(args, options = {}) {
  const result = spawnSync(codexCommand, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      ...(options.env || {}),
    },
  });
  if (
    result.status !== 0
    && (args.includes("--json") || args.includes("--available"))
    && /unexpected argument '--(json|available)'/.test(`${result.stderr}\n${result.stdout}`)
  ) {
    return runCodex(args.filter((arg) => arg !== "--json" && arg !== "--available"), options);
  }
  assert.equal(
    result.status,
    0,
    [
      `${codexCommand} ${args.join(" ")}`,
      result.stderr,
      result.stdout,
    ].filter(Boolean).join("\n"),
  );
  return result;
}

function walk(dir, hits = []) {
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    hits.push(path);
    if (stat.isDirectory()) walk(path, hits);
  }
  return hits;
}

function maybeJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function commandOutput(result) {
  return result.stdout?.trim() || result.stderr?.trim() || "";
}

try {
  run(codexCommand, ["--version"]);
  const addMarketplace = runCodex(["--enable", "plugins", "plugin", "marketplace", "add", repoRoot, "--json"]);

  const available = runCodex(["--enable", "plugins", "plugin", "list", "--available", "--json"]);

  const install = runCodex(["--enable", "plugins", "plugin", "add", `${pluginName}@${pluginName}`, "--json"]);

  const installed = runCodex(["--enable", "plugins", "plugin", "list", "--json"]);

  const installJson = maybeJson(commandOutput(install));
  let pluginRoot = installJson?.installedPath || "";
  if (!pluginRoot) {
    const manifests = walk(codexHome)
      .filter((path) => path.endsWith(".codex-plugin/plugin.json"))
      .map((path) => ({
        path,
        manifest: JSON.parse(readFileSync(path, "utf8")),
      }));
    const installedManifest = manifests.find((candidate) => candidate.manifest.name === pluginName);
    assert.ok(installedManifest, `installed plugin manifest not found under ${codexHome}`);
    pluginRoot = resolve(installedManifest.path, "..", "..");
  }
  const installedManifestPath = resolve(pluginRoot, ".codex-plugin", "plugin.json");
  assert.ok(existsSync(installedManifestPath), `installed plugin manifest not found: ${installedManifestPath}`);
  assert.equal(JSON.parse(readFileSync(installedManifestPath, "utf8")).name, pluginName);
  const installedEntries = walk(pluginRoot);
  for (const disallowed of ["/.git/", "/.devspace/", "/node_modules/", "/docs/assets"]) {
    assert.equal(
      installedEntries.some((path) => path.includes(disallowed)),
      false,
      `installed plugin cache must not contain ${disallowed}`,
    );
  }
  const skillPath = resolve(pluginRoot, "skills", "chatgpt-pro-line", "SKILL.md");
  const cliPath = resolve(pluginRoot, "bin", "chatgpt-pro");
  const skill = readFileSync(skillPath, "utf8");
  assert.match(skill, /<plugin-root>\/bin\/chatgpt-pro/);
  assert.match(skill, /Repo-Scoped Rooms/);

  const help = run(process.execPath, [cliPath, "help"], { cwd: repoRoot });
  assert.match(help.stdout, /chatgpt-pro <command>/);
  assert.match(help.stdout, /rooms <command>/);
  assert.match(help.stdout, /history export/);

  console.log(JSON.stringify({
    ok: true,
    tested: "plugin-install-smoke",
    codexCommand,
    codexHome,
    marketplace: maybeJson(commandOutput(addMarketplace)) || "marketplace-add-emitted-no-json",
    available: maybeJson(commandOutput(available)) || "plugin-list-available-emitted-no-json",
    installed: maybeJson(commandOutput(install)) || "json-output-unparsed",
    installedList: maybeJson(commandOutput(installed)) || "plugin-list-emitted-no-json",
    pluginRoot,
    skillPath,
    cliPath,
  }, null, 2));
} finally {
  rmSync(codexHome, { recursive: true, force: true });
}
