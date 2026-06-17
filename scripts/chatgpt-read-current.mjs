import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { connectToPage, now } from "../src/cdp-client.mjs";
import { pageProbe, redactedProbe } from "../src/chatgpt-page.mjs";
import { waitForAssistantResponse } from "../src/chatgpt-composer.mjs";
import { connectToChatGptSession } from "../src/chatgpt-sessions.mjs";
import { acquireBrowserProfileLock } from "../src/browser-lock.mjs";
import { writeJson } from "../src/observe.mjs";
import { ensureProjectState } from "../src/project-state.mjs";
import {
  DEFAULT_CDP_PORT,
  DEFAULT_TARGET_URL,
  runDir as makeRunDir,
  runId as makeRunId,
} from "../src/runtime-config.mjs";
import { sealRunEnvelope, threadEchoMode } from "../src/chatgpt/run-envelope.mjs";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

const port = Number(process.env.CHROME_REMOTE_DEBUGGING_PORT || DEFAULT_CDP_PORT);
const targetUrl = process.env.BROWSER_TARGET_URL || DEFAULT_TARGET_URL;
const session = arg("session") || arg("alias") || process.env.CHATGPT_SESSION || "";
const responseTimeoutMs = Number(process.env.CHATGPT_RESPONSE_TIMEOUT_MS || 480_000);
const stableMs = Number(process.env.CHATGPT_RESPONSE_STABLE_MS || 5_000);
const lockTimeoutMs = Number(arg("lock-timeout-ms") || process.env.CHATGPT_LOCK_TIMEOUT_MS || 600_000);
const noWaitForLock = flag("no-wait");
const staleLockTtlMs = Number(arg("stale-lock-ttl-ms") || process.env.CHATGPT_STALE_LOCK_TTL_MS || 900_000);
const runId = `${makeRunId()}-chatgpt-read-current`;
const runDir = makeRunDir(runId);
mkdirSync(runDir, { recursive: true });
const project = ensureProjectState();

let cdp = null;
let browserLock = null;
let assistantText = "";
let envelope = null;
const stdoutThreadEcho = threadEchoMode() === "enabled";
const started = now();
const receipt = {
  loop: "chatgpt-read-current",
  target: targetUrl,
  session: session || null,
  project,
  startedAt: new Date().toISOString(),
  responseTimeoutMs,
};

try {
  browserLock = await acquireBrowserProfileLock({
    runId,
    alias: session,
    project,
    timeoutMs: lockTimeoutMs,
    noWait: noWaitForLock,
    staleLockTtlMs,
  });
  receipt.owner = browserLock.owner;
  receipt.lock = browserLock.receipt();

  if (session) {
    const connected = await connectToChatGptSession(port, session);
    cdp = connected.cdp;
    receipt.sessionTarget = {
      targetId: connected.target.id,
      title: connected.target.title,
      url: connected.target.url,
    };
    receipt.roomTarget = connected.roomTarget || null;
  } else {
    cdp = await connectToPage(port, { matchUrl: targetUrl });
  }
  await cdp.send("Runtime.enable");
  await cdp.send("DOM.enable");

  const before = await pageProbe(cdp);
  writeJson(resolve(runDir, "initial-probe.json"), redactedProbe(before));

  const response = await waitForAssistantResponse(cdp, Math.max(0, before.assistantTurns.length - 1), {
    timeoutMs: responseTimeoutMs,
    stableMs,
  });
  assistantText = response.assistantText;
  writeFileSync(resolve(runDir, "assistant.md"), assistantText);

  Object.assign(receipt, {
    ok: true,
    completedAt: new Date().toISOString(),
    conversationUrl: response.probe?.url || before.url,
    title: before.title,
    assistantTextLength: response.assistantText.length,
    response: {
      textSha256: sha256(response.assistantText),
      charCount: response.assistantText.length,
      finishDetectedBy: response.finishDetectedBy,
    },
    stableMs: response.stableMs,
    totalMs: Math.round(now() - started),
    artifacts: {
      assistant: resolve(runDir, "assistant.md"),
      initialProbe: resolve(runDir, "initial-probe.json"),
    },
  });
} catch (error) {
  Object.assign(receipt, {
    ok: false,
    completedAt: new Date().toISOString(),
    errorCode: error?.errorCode || "response.read_failed",
    error: String(error?.message || error),
    failure: error?.details || undefined,
    totalMs: Math.round(now() - started),
  });
  if (error?.details?.owner && !receipt.owner) receipt.owner = error.details.owner;
  if (error?.details?.lock && !receipt.lock) receipt.lock = error.details.lock;
} finally {
  envelope = sealRunEnvelope({
    kind: "read",
    runDir,
    receipt,
    receivedMarkdown: assistantText,
    stdoutRendered: stdoutThreadEcho,
  });
  if (cdp) await cdp.close().catch(() => {});
  if (browserLock) {
    try {
      receipt.lock = await browserLock.release();
    } catch (error) {
      receipt.lock = {
        ...(receipt.lock || browserLock.receipt()),
        releaseErrorCode: error?.errorCode || "lock.release_failed",
        releaseError: String(error?.message || error),
      };
      receipt.lockReleaseFailure = error?.details || null;
    } finally {
      browserLock = null;
    }
  }
  writeJson(resolve(runDir, "receipt.json"), receipt);
}

console.log(JSON.stringify(receipt, null, 2));
if (stdoutThreadEcho) {
  console.log("");
  console.log(envelope.transcriptMarkdown.trimEnd());
}
process.exit(receipt.ok ? 0 : 1);
