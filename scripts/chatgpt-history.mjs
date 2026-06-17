import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { acquireBrowserProfileLock } from "../src/browser-lock.mjs";
import { connectToChatGptSession } from "../src/chatgpt-sessions.mjs";
import { snapshotConversationMessages } from "../src/chatgpt-messages.mjs";
import { ensureProjectState } from "../src/project-state.mjs";
import { DEFAULT_CDP_PORT, devspaceRoot, runId as makeRunId } from "../src/runtime-config.mjs";

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function historyMarkdown({ project, alias, target, roomTarget, messages, exportedAt, last }) {
  const lines = [
    "# ChatGPT Conversation History",
    "",
    `Exported: ${exportedAt}`,
    `Project: ${project.displayName}`,
    `Project id: ${project.projectId}`,
    `Alias: ${alias}`,
    `Conversation URL: ${target.url}`,
    `Messages exported: ${messages.length}${last ? ` (last ${last})` : " (all visible)"}`,
    `Room target bound: ${roomTarget?.targetBoundToRoom === true}`,
    "",
  ];

  for (const message of messages) {
    lines.push(
      `## Message ${message.ordinal} - ${message.role}`,
      "",
      `sha256: ${message.textSha256}`,
      `chars: ${message.charCount}`,
      "",
      message.text || "_empty_",
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

const command = process.argv[2] || "export";
const alias = arg("alias") || arg("session") || process.env.CHATGPT_SESSION || "main";
const conversationUrl = arg("conversation-url") || "";
const last = Number(arg("last") || process.env.CHATGPT_HISTORY_LAST || 0);
const port = Number(process.env.CHROME_REMOTE_DEBUGGING_PORT || DEFAULT_CDP_PORT);
const project = ensureProjectState();
const id = `${makeRunId()}-chatgpt-history-${alias}`;
const outDir = resolve(arg("out-dir") || resolve(devspaceRoot, "chatgpt-history", alias, id));
const lockTimeoutMs = Number(arg("lock-timeout-ms") || process.env.CHATGPT_LOCK_TIMEOUT_MS || 600_000);
const staleLockTtlMs = Number(arg("stale-lock-ttl-ms") || process.env.CHATGPT_STALE_LOCK_TTL_MS || 900_000);

let browserLock = null;
let cdp = null;

try {
  if (command !== "export") throw new Error(`Unknown history command: ${command}`);
  mkdirSync(outDir, { recursive: true });
  browserLock = await acquireBrowserProfileLock({
    runId: id,
    alias,
    project,
    timeoutMs: lockTimeoutMs,
    noWait: flag("no-wait"),
    staleLockTtlMs,
  });
  const connected = await connectToChatGptSession(port, alias, {
    allowRebind: flag("rebind-alias"),
    conversationUrl,
  });
  cdp = connected.cdp;
  const allMessages = await snapshotConversationMessages(cdp);
  const messages = last > 0 ? allMessages.slice(-last) : allMessages;
  const exportedAt = new Date().toISOString();
  const md = historyMarkdown({
    project,
    alias,
    target: connected.target,
    roomTarget: connected.roomTarget,
    messages,
    exportedAt,
    last,
  });
  const json = {
    ok: true,
    command,
    exportedAt,
    project,
    alias,
    target: {
      id: connected.target.id,
      title: connected.target.title,
      url: connected.target.url,
    },
    roomTarget: connected.roomTarget,
    messageCount: messages.length,
    totalVisibleMessageCount: allMessages.length,
    messages,
    artifacts: {
      markdown: resolve(outDir, "chatgpt-history.md"),
      json: resolve(outDir, "history.json"),
    },
  };
  writeFileSync(json.artifacts.markdown, md);
  writeFileSync(json.artifacts.json, `${JSON.stringify(json, null, 2)}\n`);
  console.log(JSON.stringify(json, null, 2));
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    command,
    errorCode: error?.errorCode || "history.export_failed",
    ...(error?.details ? { details: error.details } : {}),
    error: String(error?.message || error),
  }, null, 2));
  process.exitCode = 1;
} finally {
  if (cdp) await cdp.close().catch(() => {});
  if (browserLock) await browserLock.release().catch(() => {});
}
