import { connectToPage } from "../src/cdp-client.mjs";
import {
  AUTH_LOGIN_REQUIRED,
  LOGIN_REQUIRED_EXIT_CODE,
  loginRequiredMessage,
  pageProbe,
  redactedProbe,
} from "../src/chatgpt-page.mjs";
import { DEFAULT_CDP_PORT, DEFAULT_TARGET_URL } from "../src/runtime-config.mjs";

const port = Number(process.env.CHROME_REMOTE_DEBUGGING_PORT || DEFAULT_CDP_PORT);
const target = process.env.BROWSER_TARGET_URL || DEFAULT_TARGET_URL;

try {
  const cdp = await connectToPage(port, { matchUrl: target, retries: 5 });
  await cdp.send("Runtime.enable");
  const probe = await pageProbe(cdp);
  await cdp.close().catch(() => {});

  const result = {
    ok: !probe.isLoggedOut && !!probe.composer,
    errorCode: null,
    target,
    probe: redactedProbe(probe),
  };

  if (probe.isLoggedOut) {
    result.errorCode = AUTH_LOGIN_REQUIRED;
    result.error = "not_logged_in";
    result.nextAction = "manual_login";
    result.message = loginRequiredMessage();
    console.log(JSON.stringify(result, null, 2));
    process.exit(LOGIN_REQUIRED_EXIT_CODE);
  }

  if (!probe.composer) {
    result.errorCode = "chatgpt.composer_missing";
    result.error = "composer_not_found";
    result.message = "ChatGPT is reachable, but the composer is not visible. Inspect the visible browser window.";
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  result.message = "ChatGPT profile is logged in and ready.";
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        errorCode: "chrome.cdp_unavailable",
        error: String(error?.message || error),
        message: "Chrome CDP is not reachable. Run npm run setup:login first.",
        target,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
