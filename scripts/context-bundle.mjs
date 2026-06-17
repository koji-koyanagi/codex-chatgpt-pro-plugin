import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { repoRoot, devspaceRoot, runId } from "../src/runtime-config.mjs";

const contextRoot = resolve(devspaceRoot, "context-bundles");
const maxFileBytes = Number(process.env.CONTEXT_MAX_FILE_BYTES || 120_000);
const maxTotalBytes = Number(process.env.CONTEXT_MAX_TOTAL_BYTES || 1_500_000);

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function sh(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}

function listFiles() {
  const result = sh("find", [
    ".",
    "-type",
    "f",
    "!",
    "-path",
    "./node_modules/*",
    "!",
    "-path",
    "./.devspace/*",
    "!",
    "-path",
    "./.git/*",
    "!",
    "-name",
    "package-lock.json",
  ]);
  if (result.status !== 0) throw new Error(result.stderr || "find failed");
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((path) => path.replace(/^\.\//, ""))
    .sort();
}

function repoTree(files) {
  return files.map((file) => `- ${file}`).join("\n");
}

function extensionLanguage(path) {
  const map = new Map([
    [".js", "javascript"],
    [".mjs", "javascript"],
    [".json", "json"],
    [".md", "markdown"],
    [".toml", "toml"],
  ]);
  return map.get(extname(path)) || "";
}

function locSummary(files) {
  const rows = files.map((file) => {
    const text = readFileSync(resolve(repoRoot, file), "utf8");
    return {
      file,
      bytes: Buffer.byteLength(text),
      lines: text.length ? text.split("\n").length : 0,
    };
  });
  return {
    files: rows.length,
    bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    lines: rows.reduce((sum, row) => sum + row.lines, 0),
    byFile: rows,
  };
}

function fileSection(file) {
  const path = resolve(repoRoot, file);
  const statBytes = readFileSync(path).length;
  if (statBytes > maxFileBytes) {
    return `## ${file}\n\nSkipped: file is ${statBytes} bytes, above CONTEXT_MAX_FILE_BYTES=${maxFileBytes}.\n`;
  }
  const text = readFileSync(path, "utf8");
  return [
    `## ${file}`,
    "",
    `\`\`\`${extensionLanguage(file)}`,
    text.replaceAll("```", "``\\`"),
    "```",
    "",
  ].join("\n");
}

function buildBundle({ name }) {
  const id = `${runId()}-${name || "repo-context"}`;
  const dir = resolve(contextRoot, id);
  mkdirSync(dir, { recursive: true });

  const files = listFiles();
  const loc = locSummary(files);
  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    repoRoot,
    maxFileBytes,
    maxTotalBytes,
    loc,
    files,
  };

  let includedBytes = 0;
  const sections = [];
  for (const file of files) {
    const bytes = readFileSync(resolve(repoRoot, file)).length;
    if (includedBytes + Math.min(bytes, maxFileBytes) > maxTotalBytes) {
      sections.push(`## ${file}\n\nSkipped: bundle reached CONTEXT_MAX_TOTAL_BYTES=${maxTotalBytes}.\n`);
      continue;
    }
    sections.push(fileSection(file));
    includedBytes += Math.min(bytes, maxFileBytes);
  }

  const contextMd = [
    `# Repo Context Bundle: ${basename(repoRoot)}`,
    "",
    `Created: ${manifest.createdAt}`,
    `Repo root: ${repoRoot}`,
    "",
    "## Metadata",
    "",
    `- files: ${loc.files}`,
    `- lines: ${loc.lines}`,
    `- bytes: ${loc.bytes}`,
    "",
    "## Repo Structure",
    "",
    repoTree(files),
    "",
    "## LOC By File",
    "",
    "| File | Lines | Bytes |",
    "| --- | ---: | ---: |",
    ...loc.byFile.map((row) => `| ${row.file} | ${row.lines} | ${row.bytes} |`),
    "",
    "# File Contents",
    "",
    ...sections,
  ].join("\n");

  const manifestPath = resolve(dir, "manifest.json");
  const contextPath = resolve(dir, "repo-context.md");
  const zipPath = resolve(dir, "repo-context.zip");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(contextPath, contextMd);

  const zip = sh("zip", ["-qr", zipPath, "manifest.json", "repo-context.md"], { cwd: dir });
  const zipped = zip.status === 0 && existsSync(zipPath);

  return {
    id,
    dir,
    manifest: manifestPath,
    context: contextPath,
    zip: zipped ? zipPath : null,
    loc: {
      files: loc.files,
      lines: loc.lines,
      bytes: loc.bytes,
    },
  };
}

try {
  const result = buildBundle({ name: arg("name") });
  console.log(JSON.stringify({ ok: true, result }, null, 2));
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        errorCode: "context.bundle_failed",
        error: String(error?.message || error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
