# Subagent Browser Contract

Use this contract when a Codex subagent or MCP-capable browser operator drives
the dedicated ChatGPT website profile.

## Startup

1. Run `npm install` once.
2. Run `npm run setup:login` to open `https://chatgpt.com/` in a normal Chrome
   window with CDP on `http://127.0.0.1:9222`.
3. Run `npm run login:check` to verify the profile is authenticated.
4. Run `npm run levels:list` to read account/model/intelligence choices from
   the live website.
5. Run `npm run cdp:smoke` to verify the endpoint.
6. Use the project `.codex/config.toml` to expose the `chrome_devtools` MCP
   server in a fresh Codex session.

The persistent human-login profile is `.devspace/chrome-profiles/chatgpt-pro`.
Do not commit it.

## Login Boundary

If ChatGPT asks for login, the human completes login in the visible browser
window. The browser operator must not enter passwords, OTPs, solve CAPTCHA, or
inspect cookies/session storage.

The standard machine-readable failure is:

- receipt `errorCode`: `auth.login_required`
- process exit code: `20`
- next action: `manual_login`

After login:

```bash
npm run login:check
npm run levels:list
BROWSER_OBSERVER=1 npm run live:chatgpt
```

## Choice Control

Do not hardcode thinking/model labels. Read them from the website:

```bash
npm run levels:list
npm run levels:set -- --level=Pro
npm run choices:set -- --model=5.4
```

For smoke runs, set requested choices through env:

```bash
CHATGPT_LEVEL=Pro CHATGPT_MODEL=5.5 BROWSER_OBSERVER=1 npm run live:chatgpt
```

Receipts include the account plan, available choices, and selected/current
choices. Treat `account.isPro` as subscription detection and
`intelligence.current` as the active thinking/intelligence level.
Use `CHATGPT_RESPONSE_TIMEOUT_MS` for slower levels such as `High` or `Pro`.
Live smoke starts a fresh ChatGPT page by default; set `CHATGPT_NEW_CHAT=0` only
when the task intentionally targets the current conversation.

## Required Live Proof

A browser operator must be able to:

1. Attach to the live ChatGPT website target through CDP.
2. Detect whether login is missing and report `auth.login_required`.
3. Detect account plan and current/available intelligence/model choices.
4. Optionally select requested level/model labels.
5. Find the composer.
6. Type a unique smoke prompt.
7. Send it.
8. Wait for a new assistant message containing the unique response token.
9. Return the receipt and artifacts.

The proof bundle is written to `.devspace/runs/<run-id>/` and includes
`receipt.json`, `receipt.md`, `run.json`, `final.png`, `snapshot.json`,
`console.json`, and `network.json`.

## Safety Notes

The Chrome DevTools MCP server can inspect and modify everything visible in the
connected Chrome profile. Keep ChatGPT Pro work in the dedicated
`.devspace/chrome-profiles/chatgpt-pro` profile and avoid mixing unrelated
personal browsing state into that profile.
