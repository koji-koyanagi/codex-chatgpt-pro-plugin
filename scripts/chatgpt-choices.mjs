import { connectToPage } from "../src/cdp-client.mjs";
import { readChatGptChoices, setChatGptChoices } from "../src/chatgpt-choices.mjs";
import {
  AUTH_LOGIN_REQUIRED,
  LOGIN_REQUIRED_EXIT_CODE,
  loginRequiredMessage,
  pageProbe,
} from "../src/chatgpt-page.mjs";
import { DEFAULT_CDP_PORT, DEFAULT_TARGET_URL } from "../src/runtime-config.mjs";

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const port = Number(process.env.CHROME_REMOTE_DEBUGGING_PORT || DEFAULT_CDP_PORT);
const target = process.env.BROWSER_TARGET_URL || DEFAULT_TARGET_URL;
const requestedLevel = arg("level") || arg("intelligence") || process.env.CHATGPT_LEVEL || null;
const requestedModel = arg("model") || process.env.CHATGPT_MODEL || null;

try {
  const cdp = await connectToPage(port, { matchUrl: target });
  await cdp.send("Runtime.enable");
  const probe = await pageProbe(cdp);

  if (probe.isLoggedOut) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          errorCode: AUTH_LOGIN_REQUIRED,
          error: "not_logged_in",
          nextAction: "manual_login",
          message: loginRequiredMessage(),
          target,
        },
        null,
        2,
      ),
    );
    await cdp.close().catch(() => {});
    process.exit(LOGIN_REQUIRED_EXIT_CODE);
  }

  const result = requestedLevel || requestedModel
    ? await setChatGptChoices(cdp, { level: requestedLevel, model: requestedModel })
    : await readChatGptChoices(cdp);

  await cdp.close().catch(() => {});
  console.log(JSON.stringify({ ok: true, target, ...result }, null, 2));
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        errorCode: "chatgpt.choice_control_failed",
        error: String(error?.message || error),
        target,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
