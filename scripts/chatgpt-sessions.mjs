import {
  activateChatGptSession,
  aliasChatGptSession,
  closeChatGptSession,
  listChatGptSessions,
  newChatGptSession,
  rebindChatGptSessionAlias,
} from "../src/chatgpt-sessions.mjs";
import { DEFAULT_CDP_PORT, DEFAULT_TARGET_URL } from "../src/runtime-config.mjs";
import { ensureProjectState } from "../src/project-state.mjs";

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

const command = process.argv[2] || "list";
const port = Number(process.env.CHROME_REMOTE_DEBUGGING_PORT || DEFAULT_CDP_PORT);
const name = arg("name") || arg("session") || process.env.CHATGPT_SESSION || null;
const targetId = arg("target") || arg("target-id") || null;
const conversationUrl = arg("conversation-url") || arg("url") || null;
const url = arg("url") || process.env.BROWSER_TARGET_URL || DEFAULT_TARGET_URL;
const rebind = flag("rebind") || flag("rebind-alias");

try {
  let result;
  if (command === "list") result = await listChatGptSessions(port);
  else if (command === "new") result = await newChatGptSession(port, { name, url });
  else if (command === "activate") result = await activateChatGptSession(port, { name, targetId });
  else if (command === "alias") result = rebind
    ? await rebindChatGptSessionAlias(port, { name, targetId, conversationUrl })
    : await aliasChatGptSession(port, { name, targetId, conversationUrl });
  else if (command === "close") result = await closeChatGptSession(port, { name, targetId });
  else if (command === "project") result = ensureProjectState();
  else throw new Error(`Unknown sessions command: ${command}`);

  console.log(JSON.stringify({ ok: true, command, result }, null, 2));
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        command,
        errorCode: error?.errorCode || "chatgpt.session_control_failed",
        ...(error?.details ? { details: error.details } : {}),
        error: String(error?.message || error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
