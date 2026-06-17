# Codex ChatGPT Pro Plugin

Give Codex an intelligence lifeline: a Codex skill for calling ChatGPT Pro
through a persistent logged-in browser session, with repo-scoped threads,
repomix-style repo monofile attachment, visible login handling, transcripts,
and receipts.

This is a working production system in development. The core path is live:
Codex can open the ChatGPT website, keep a dedicated Chrome profile, select the
Pro/intelligence level exposed by the website, attach repo context, send a
blocking message, read the anchored assistant response, and preserve the exact
exchange back into the Codex session.

Use it for high-level work: architecture, system specs, feature design,
research synthesis, tradeoff review, cross-repo planning, and hard debugging
strategy. Do not spend the line on trivial syntax checks unless you are testing
the transport.

## Demo

ChatGPT Pro line call:

[![ChatGPT Pro line demo](docs/assets/chatgpt-pro-line-demo.gif)](docs/assets/chatgpt-pro-line-demo.mp4)

Repo monofile attachment:

[![Repo monofile attach demo](docs/assets/repo-monofile-attach.gif)](docs/assets/repo-monofile-attach.mp4)

## What It Does

- Opens `https://chatgpt.com/` in a dedicated persistent Chrome profile.
- Exposes CDP on `http://127.0.0.1:9222` for deterministic browser control.
- Keeps human login visible; automation never enters passwords, OTPs, CAPTCHA,
  cookies, or session storage.
- Uses a global browser lock so multiple Codex agents do not write into the
  same ChatGPT profile at once.
- Binds ChatGPT conversation rooms to the current git repo, with linked
  worktrees sharing the same room registry and separate repos staying isolated.
- Generates repo context as a single `repo-context.md` monofile with manifest,
  line ranges, hashes, LOC, and zip output.
- Uploads bulky context through the ChatGPT composer and records attachment
  evidence in receipts.
- Echoes the exact sent/received ChatGPT exchange into the Codex thread.
- Exports visible ChatGPT history for a bound room and reads it later without
  touching the browser.

## Install

From a local checkout:

```bash
npm install
npm run plugin:sync
codex --enable plugins plugin marketplace add "$PWD"
codex --enable plugins plugin add codex-chatgpt-pro-plugin@codex-chatgpt-pro-plugin
```

For source development, run the CLI directly:

```bash
./bin/chatgpt-pro init
./bin/chatgpt-pro doctor --warm
# complete visible login if prompted
./bin/chatgpt-pro doctor --live
./bin/chatgpt-pro status --alias=main
./bin/chatgpt-pro call --alias=main --prompt="Confirm the ChatGPT Pro line is ready for this repo."
```

If `doctor --live` exits with `auth.login_required` and process exit `20`,
finish login in the visible browser window and rerun:

```bash
./bin/chatgpt-pro doctor --live
```

## Everyday Use

Continue the repo's main ChatGPT room:

```bash
./bin/chatgpt-pro call --alias=main --prompt-file=prompt.md
```

Open a clean long-lived critic room:

```bash
./bin/chatgpt-pro rooms new --alias=critic
./bin/chatgpt-pro call --alias=critic --prompt-file=review.md
```

Bind an existing human ChatGPT thread to this repo:

```bash
./bin/chatgpt-pro rooms rebind --alias=spec --conversation-url=https://chatgpt.com/c/...
./bin/chatgpt-pro history export --alias=spec --last=20
```

Attach generated repo context:

```bash
./bin/chatgpt-pro call --alias=main --repo-context=upload --prompt="Review this repo architecture."
```

Generate the repo context bundle without sending:

```bash
./bin/chatgpt-pro context bundle --name=focused
```

The bundle lands in `.devspace/context-bundles/<id>/`:

- `repo-context.md`: source tree, LOC, file contents, and source-map tables
- `manifest.json`: machine-readable file and directory records with line ranges
- `repo-context.zip`: zipped context artifacts

## Thread Echo Contract

Interactive Codex use must keep the ChatGPT exchange in the Codex session log.
`chatgpt-pro call` prints this block by default:

```md
## Message Sent To ChatGPT Pro

...

## Message Received From ChatGPT Pro

...
```

Paste that exact block into the Codex thread. Do not summarize or rewrite it.
For attachment calls, the sent block is the exact text typed into ChatGPT; file
bodies are represented by paths, bytes, hashes, and upload evidence in the
receipt.

## Repo Rooms

Rooms are repo-owned ChatGPT conversation bindings:

- `main`: long-lived repo collaboration
- `debug`: focused failure investigation
- `critic`: independent review
- `scratch`: disposable prompt/context checks

Room lifecycle commands:

```bash
./bin/chatgpt-pro rooms project
./bin/chatgpt-pro rooms list
./bin/chatgpt-pro rooms show --alias=main
./bin/chatgpt-pro rooms new --alias=critic
./bin/chatgpt-pro rooms rebind --alias=spec --conversation-url=https://chatgpt.com/c/...
./bin/chatgpt-pro rooms repair --alias=main
```

Project identity is stored in local git config as `chatgpt-pro.projectId`.
Linked worktrees share that id. Room state lives in:

```text
~/.chatgpt-pro-codex/projects/<projectId>/chatgpt-sessions.json
```

Before every alias `call` or `read`, the runner checks that the browser target
is on the room's expected ChatGPT conversation URL. If the target is stale, it
repairs by finding or opening the saved conversation URL before sending or
reading.

## Command Surface

- `npm run chrome`: launch the dedicated visible ChatGPT browser.
- `npm run chrome:headless`: launch the same profile headless.
- `npm run chrome:debug`: launch with verbose CDP/profile output.
- `npm run cdp:smoke`: verify `/json/version` and `/json/list`.
- `npm run levels:list`: read account plan, active intelligence, available
  intelligence labels, active model, and available model labels from the live
  website.
- `npm run levels:set -- --level=Pro`: select a live intelligence label.
- `npm run choices:set -- --model=5.4`: select a live model label.
- `npm run rooms:list`: list repo-owned room records without touching CDP.
- `npm run context:bundle -- --name=focused`: build repo context artifacts.
- `npm run chatgpt:call -- --alias=main --message-file=prompt.md`: source-repo
  alias for `chatgpt-pro call`.
- `npm run chatgpt:read`: capture the newest response through the browser lock.
- `npm run history:export -- --alias=spec --last=20`: export visible history.
- `npm run plugin:sync`: refresh the materialized install bundle.
- `npm run test:v1`: run the deterministic package gate.
- `npm run test:live`: run the live browser proof suite.
- `npm test`: runs deterministic tests only; it does not require Chrome or a
  logged-in ChatGPT website session.

The installed plugin exposes the `chatgpt-pro-line` skill and packaged CLI at
`bin/chatgpt-pro`. Inside a plugin install, agents resolve
`<plugin-root>/bin/chatgpt-pro` from the skill location unless `chatgpt-pro` is
already on `PATH`.

## Runtime Switches

- `BROWSER_TARGET_URL`: defaults to `https://chatgpt.com/`.
- `BROWSER_PROFILE_NAME`: defaults to `chatgpt-pro`.
- `BROWSER_POSTURE=headed|headless`: visible vs headless Chrome.
- `CHROME_REMOTE_DEBUGGING_PORT`: defaults to `9222`.
- `BROWSER_OBSERVER=1`: prints a run-inspector URL.
- `KEEP_OBSERVER=1`: keeps the inspector alive after a run finishes.
- `CHATGPT_DEFAULT_LEVEL`: defaults to `Pro` for `chatgpt-pro call`.
- `CHATGPT_LEVEL` / `CHATGPT_INTELLIGENCE`: choose a discovered intelligence
  label.
- `CHATGPT_MODEL`: choose a discovered model label.
- `CHATGPT_RESPONSE_TIMEOUT_MS`: assistant response timeout. Default:
  `240000`.
- `CHATGPT_REPO_CONTEXT_MODE=auto|upload|inline|off`: generated repo context
  behavior.
- `CHATGPT_UPLOAD_FILES`: comma-separated upload paths.
- `CHATGPT_LOCK_TIMEOUT_MS`: global browser-profile lock wait. Default:
  `600000`.
- `CHATGPT_PRO_HOME`: override the shared runtime home. Useful for isolated
  development or install tests.

## Artifacts

Each live call writes under `.devspace/runs/<run-id>/`:

- `receipt.json` and `receipt.md`
- `transcript.md`
- `prompt.md`
- `assistant.md`
- `run.json`
- `final.png`
- `snapshot.json`
- `console.json`
- `network.json`

Receipts include prompt/response hashes, selected model/intelligence state,
lock owner/wait/held timing, conversation URL, attachment metadata, response
character count, and `messageAnchor.responseBoundToSentPrompt`.

## Verification

Development loop:

```bash
npm run test:v1
npm run plugin:sync
npm run test:plugin-package
npm run test:plugin-install
```

Live proof loop:

```bash
npm run live:doctor
npm run live:history-export
npm run live:rooms-rebind
npm run live:rooms-repair
npm run live:repo-thread-matrix
```

`npm run live:repo-thread-matrix` creates fixture git repos plus a linked
worktree, proves worktree-shared room identity, proves separate-repo thread
isolation, continues one alias in the same ChatGPT thread, opens another alias
in a different thread, exports visible history, and reads the compiled history
artifacts back from disk.

## Failure Codes

- `auth.login_required`: visible human login is needed.
- `chatgpt.composer_missing`: ChatGPT loaded but the text composer was not
  found.
- `chatgpt.response_timeout`: no anchored assistant response stabilized before
  timeout.
- `lock.busy`: another run owns the browser lock and this run used `--no-wait`.
- `lock.timeout`: another run did not release the browser lock in time.
- `state_lock.busy`: another process owns the project state lock.
- `session.alias_project_mismatch`: requested alias belongs to another repo.
- `composer.input_mismatch`: composer text did not match the prompt before send.
- `input.attachment_upload_failed`: ChatGPT did not show upload evidence.
- `history.visible_message_count_too_low`: exported history had too few visible
  messages.
- `mode.unsupported`: requested mode is intentionally not implemented.

See [docs/chatgpt-call-contract.md](docs/chatgpt-call-contract.md) for the full
contract and [docs/subagent-browser-contract.md](docs/subagent-browser-contract.md)
for lower-level CDP/browser-operator details.
