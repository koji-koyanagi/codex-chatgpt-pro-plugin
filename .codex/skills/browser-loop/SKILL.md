---
name: browser-loop
description: Drive the live ChatGPT website through the dedicated CDP profile and return a proof receipt.
---

# Browser Loop

This is the narrow live loop for the current repo. It operates the real
ChatGPT website in a dedicated Chrome profile and returns receipt artifacts.

For packaged AI-to-AI collaboration behavior, prefer the repo-local
`chatgpt-pro-line` skill. This browser-loop skill documents the lower-level
runtime; `chatgpt-pro-line` documents the canonical agent behavior.

## Startup

1. `npm run setup:login` opens/reuses `https://chatgpt.com/` in a normal Chrome window.
2. `npm run login:check` verifies the profile is authenticated.
3. `npm run levels:list` reads account/model/intelligence choices from the website.
4. `npm run cdp:smoke` verifies CDP on `http://127.0.0.1:9222`.
5. `BROWSER_OBSERVER=1 npm run live:chatgpt` runs the proof.
6. `npm run chatgpt:call -- --prompt-file=prompt.md` runs the conversational path.

The persistent human-login profile is `.devspace/chrome-profiles/chatgpt-pro`.
If ChatGPT asks for login, the human completes login in the visible browser
window. Do not enter passwords, OTPs, solve CAPTCHA, or inspect cookies/session
storage.

Login-required failure code:

- receipt `errorCode`: `auth.login_required`
- process exit code: `20`
- next action: `manual_login`

## Choice Control

Read live choices rather than hardcoding labels:

- `npm run levels:list`
- `npm run levels:set -- --level=Pro`
- `npm run choices:set -- --model=5.4`

Smoke runs can request choices with `CHATGPT_LEVEL`, `CHATGPT_INTELLIGENCE`, and
`CHATGPT_MODEL`. Receipts include `account.isPro`, the active intelligence
level, available intelligence options, active model, and available model
options.

Live smoke starts a fresh ChatGPT page by default. Set `CHATGPT_NEW_CHAT=0` only
when testing the current conversation on purpose.

For real work, prefer named session rooms:

- `npm run sessions:list`
- `npm run sessions:alias -- --name=main`
- `npm run sessions:new -- --name=debug`
- `npm run chatgpt:call -- --alias=main --prompt-file=prompt.md`
- `npm run chatgpt:call -- --alias=main --context-dir=.devspace/context/current --prompt="..."`
- `CHATGPT_SESSION=main npm run chatgpt:read`

Use existing aliases when continuity matters. Use fresh chats for clean critique
or health checks.

## Health Check Loop

1. Attach to the live ChatGPT target through CDP.
2. Probe login/composer state.
3. Read account/model/intelligence choices from the live website.
4. Optionally select requested level/model labels.
5. Type a prompt asking for a unique response token.
6. Send the prompt.
7. Wait for a new assistant message containing the token.
8. Emit receipt artifacts.

## Conversational Loop

1. Build a concise Codex session digest and optional repo context bundle.
2. Select a named ChatGPT room or create a fresh chat.
3. Send a natural prompt with the digest/context. Use `--context-dir` when a
   directory contains `codex-session-digest.md`, `repo-context.md`,
   `diff.patch`, or `test-output.txt`.
4. Wait through transient states like `Pro thinking` and `Stop answering`.
5. Read the newest completed assistant response.
6. Save `prompt.md`, `assistant.md`, `receipt.json`, screenshots, console, and network artifacts.
7. Apply the resulting repo change locally, then call ChatGPT again with the diff
   and test receipt when useful.

## Proof Artifacts

`npm run live:chatgpt` writes:

- `receipt.json` and `receipt.md`
- `run.json`
- `final.png`
- `snapshot.json`
- `console.json`
- `network.json`

When `BROWSER_OBSERVER=1` is set, the command prints a run-inspector URL.

`npm run chatgpt:call` also writes `input.md`, `prompt.md`, `assistant.md`, and
`transcript.md` with titled sent/received sections. `npm run chatgpt:read` can
recover the newest response from the active conversation if a long Pro answer
outlives an earlier runner.
