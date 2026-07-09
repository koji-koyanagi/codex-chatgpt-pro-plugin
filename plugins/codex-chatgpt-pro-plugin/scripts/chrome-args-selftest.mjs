import assert from "node:assert/strict";

const { buildChromeArgs, chromeExtraArgsFromEnv } = await import(
  `../src/chrome-session.mjs?chrome-args=${Date.now()}`
);

const previous = {
  CHATGPT_PRO_CHROME_LANG: process.env.CHATGPT_PRO_CHROME_LANG,
  CHATGPT_PRO_CHROME_ARGS: process.env.CHATGPT_PRO_CHROME_ARGS,
  CHROME_EXTRA_ARGS: process.env.CHROME_EXTRA_ARGS,
};

try {
  process.env.CHATGPT_PRO_CHROME_LANG = "en-US";
  delete process.env.CHATGPT_PRO_CHROME_ARGS;
  delete process.env.CHROME_EXTRA_ARGS;
  assert.deepEqual(chromeExtraArgsFromEnv(), ["--lang=en-US", "--accept-lang=en-US,en"]);
  assert.ok(buildChromeArgs().includes("--lang=en-US"));

  process.env.CHATGPT_PRO_CHROME_ARGS = '["--disable-extensions","--lang=en-US"]';
  assert.deepEqual(chromeExtraArgsFromEnv(), [
    "--lang=en-US",
    "--disable-extensions",
    "--lang=en-US",
  ]);

  delete process.env.CHATGPT_PRO_CHROME_LANG;
  process.env.CHATGPT_PRO_CHROME_ARGS = "--disable-extensions --lang=en-US";
  assert.deepEqual(chromeExtraArgsFromEnv(), ["--disable-extensions", "--lang=en-US"]);

  assert.throws(
    () => buildChromeArgs({
      userDataDir: `${process.env.HOME}/Library/Application Support/Google/Chrome/Default`,
    }),
    /OS\/default Chrome profile/,
  );
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log(JSON.stringify({ ok: true, tested: "chrome-args" }, null, 2));
