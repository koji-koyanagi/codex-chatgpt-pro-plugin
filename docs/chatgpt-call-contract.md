# ChatGPT Call Contract

The product surface is a conversational browser call, not a stateless API. Codex
brings a prompt, session-history digest, repo context, and artifacts; ChatGPT Pro
answers in the website; Codex records what happened and applies the next patch.

Smoke tests stay as health checks. Real work should use `chatgpt-pro call`.
Inside this development repo, `npm run chatgpt:call -- ...` remains an alias.

The intended value of the line is professional-level model collaboration:
architecture decisions, system specs, feature design, research synthesis, risk
analysis, planning across agents/repos, and hard debugging strategy. ChatGPT Pro
should be invited to disagree, ask clarifying questions, propose a different
architecture, and name prerequisite work when that is the right answer. Do not
treat ChatGPT Pro as just a transport smoke-test endpoint.

## Minimal Call

Input:

```json
{
  "prompt": "natural language request",
  "session": {
    "mode": "new | alias",
    "alias": "main"
  },
  "context": {
    "codexHistoryDigest": "markdown",
    "repoContext": "repo-context.md",
    "artifacts": ["receipt.json", "final.png"]
  },
  "options": {
    "intelligence": "Pro",
    "model": "5.5",
    "responseMode": "blocking",
    "timeoutMs": 300000
  }
}
```

Output:

```json
{
  "ok": true,
  "conversationUrl": "https://chatgpt.com/c/...",
  "assistant": "markdown response text",
  "receipt": "receipt.json"
}
```

The implementation should promise only these things:

- choose or create a ChatGPT browser session
- prove the requested alias belongs to the current repo
- acquire the global browser-profile lock before touching the shared profile
- place a well-formed prompt into the real website
- optionally paste or attach context
- wait for and extract the newest assistant response
- return receipt artifacts that make the run inspectable

V1 implements only `responseMode: "blocking"`: Codex sends, waits, reads,
records the transcript, then continues. Event/interrupt mode is reserved for a
later API where send can return a run id and response capture can happen
separately.

`chatgpt-pro call` defaults to the live `Pro` intelligence level when available.
Callers may override with `--level`, `--intelligence`, `CHATGPT_LEVEL`, or
`CHATGPT_INTELLIGENCE`. `--no-default-pro` is only for transport debugging.

The canonical call path must not use OS-level mouse or keyboard automation. For
message insertion it should use DOM focus, CDP `Input.insertText`, and a DOM
button click. Run `npm run test:non-interference` before changing this path.

The call path is text-only. It must not use ChatGPT voice, dictation,
microphone, audio capture, or spoken commands.

## Session Rooms

Treat ChatGPT conversations as rooms:

- `main`: default repo collaboration thread
- `debug`: focused failures, traces, and stack output
- `critic`: fresh skeptical review with compressed context only
- `scratch`: disposable experiments

Use an existing alias when continuity matters. Use a new chat for clean critique,
independent tasks, or health checks. Do not create one tab per call by default.
Aliases are repo-owned. `main` means `main` for the current project, not any
tab or conversation globally named `main`.

Thread modes:

```bash
chatgpt-pro call --alias main
```

Continue the active repo-owned room.

```bash
chatgpt-pro call --alias critic --fresh
```

Open a new unbound thread. The alias is only a hint for the receipt and
`freshThreads` history; it does not replace the active `critic` room.

```bash
chatgpt-pro call --alias critic --new
```

Open a new thread and bind `critic` to it. The previous active thread remains in
lineage as archived.

```bash
chatgpt-pro call --alias main --rebind-alias --conversation-url https://chatgpt.com/c/...
```

Deliberately point an alias at an already-open conversation.

If the human pastes a ChatGPT conversation URL and asks Codex to work from that
thread, bind it deliberately:

```bash
chatgpt-pro sessions alias --name spec --rebind-alias --conversation-url https://chatgpt.com/c/...
chatgpt-pro history export --alias=spec --last=20
chatgpt-pro history export --alias spec
```

The history export includes both user and assistant messages visible in the
thread. Use `--last=N` for a recent window or omit it for the full visible
conversation.

For multi-agent/multi-repo operation, the posture is:

- one shared logged-in browser profile
- one global browser-profile lock around active browser control
- separate repo-owned aliases for separate agents/tasks/repos
- reuse each alias by default
- use `--new` only when deliberately moving an alias to a new long-lived thread
- use `--fresh` only for one-off clean rooms

Project state:

- `.devspace/state/chatgpt-project.json`: local pointer with `projectId`,
  `repoRoot`, display name, and canonical registry path
- `git config --local chatgpt-pro.projectId`: git-level identity used by linked
  worktrees
- `~/.chatgpt-pro-codex/projects/<projectId>/chatgpt-sessions.json`: room
  records, lineage, recent runs, and fresh thread records owned by that project

If an alias record has a different `projectId`, the call should fail with
`session.alias_project_mismatch`. The only escape hatch is an explicit
`--rebind-alias`, which records that the alias was deliberately rebound.

Before every alias `call` or `read`, the runner verifies the browser target is
showing the alias's expected ChatGPT conversation URL. If the saved target id is
stale or points at a different conversation, the runner repairs by finding an
already-open target with the expected conversation id or opening that URL.
Receipts expose this as `roomTarget.targetBoundToRoom`.

Interactive calls must echo the exact exchange into the Codex thread:

```md
## Message Sent To ChatGPT Pro

...

## Message Received From ChatGPT Pro

...
```

`chatgpt-pro call` prints this block by default. Agents must paste that exact
block into the Codex thread. Do not summarize, paraphrase, trim, or rewrite the
`Message Sent To ChatGPT Pro` or `Message Received From ChatGPT Pro` sections.
Additional commentary may come before or after the exact block, but not inside
it. Machine consumers may set `CHATGPT_THREAD_ECHO=0`.

Receipts must include:

```json
{
  "threadEcho": {
    "mode": "enabled",
    "stdoutRendered": true,
    "contract": "agent_must_paste_verbatim",
    "enforcement": "stdout_rendered_not_verified",
    "transcriptSha256": "...",
    "sentSha256": "...",
    "receivedSha256": "..."
  }
}
```

Verify the sealed envelope with:

```bash
chatgpt-pro transcript verify --receipt=.devspace/runs/<run-id>/receipt.json
```

The prompt should say whether the call is a continuation or fresh view:

```md
You are in the `main` ChatGPT session. This is a continuation of the repo
implementation thread.
```

or:

```md
This is a fresh review. Do not rely on earlier ChatGPT conversation memory.
Everything relevant is below.
```

## Concurrency

V1 uses one shared logged-in Chrome profile and one global browser-profile lock:

```text
~/.chatgpt-pro-codex/locks/browser-profile.lock/
```

Only one `chatgpt:call` or `chatgpt:read` may control the profile at a time.
The default is to wait for the lock. `--no-wait` fails immediately with
`lock.busy`; `--lock-timeout-ms` bounds the wait; `--stale-lock-ttl-ms` controls
dead-owner reclaim. Receipts include `owner` and `lock` fields with run id, pid,
repo/project identity, wait time, held time, and stale-lock reclaim status.

Shared project room state has its own short-held lock:

```text
~/.chatgpt-pro-codex/projects/<projectId>/state.lock/
```

Use this lock only around `chatgpt-sessions.json` read/modify/write sections:
alias bind/rebind, fresh-thread recording, alias recent-run updates, and init.
Do not hold it while waiting for ChatGPT to answer. State writes must be atomic:
write a temp file, fsync, then rename into place. The global browser lock remains
the long-lived lock for live website control.

## Codex History Digest

Do not dump a whole transcript by default. Send a digest first, and attach raw
history only when it matters.

```md
# Codex Session Digest

## Goal
...

## Current State
- ...

## Decisions Already Made
- ...

## Changed Files Since Last ChatGPT Call
- `path`: summary

## Commands / Receipts
- `npm test`: pass/fail plus artifact path

## Open Questions For ChatGPT
- ...

## Available Raw Artifacts
- `codex-session-full.md`
- `repo-context.md`
- `receipt.json`
```

Default rule: paste the digest every time, paste raw recent turns only when they
carry important nuance, and attach raw artifacts behind file paths.

## Context Tiers

By default, `chatgpt-pro call` generates and attaches a repo context monofile
unless `--no-repo-context` or `CHATGPT_ATTACH_REPO_CONTEXT=0` is set. The bundle
lives under `.devspace/context-bundles/<id>/`:

- `repo-context.md`: repo structure, LOC, file contents, and source-map tables
- `manifest.json`: machine-readable file and directory records with line ranges
  into `repo-context.md`
- `repo-context.zip`: zip of both artifacts

The bundle command is:

```bash
chatgpt-pro context bundle --name focused
```

Paste directly when content is small and central:

- exact question
- session digest
- short diff
- relevant error output
- one or two key excerpts

Upload files when context is useful but too bulky to paste:

- `repo-context.md`
- `codex-session-full.md`
- `test-output.txt`
- `diff.patch`
- screenshots

Use zip only for broad repo inspection, hidden coupling, or architecture review.
Zip bundles must exclude dependencies, browser profiles, build output, caches,
and unrelated binaries.

## Receipts

For `chatgpt-pro call`, receipt data should include:

- CDP endpoint and browser profile
- lock owner, wait time, held time, and stale-lock reclaim status
- session alias, tab id, and conversation URL
- detected account plan, model, and intelligence level
- desired model/intelligence and whether the call defaulted to Pro
- prompt SHA-256 and character count
- response mode
- attachment paths, sizes, hashes, and upload status
- send method and whether a user message appeared
- message anchor proof, including `responseBoundToSentPrompt`
- response SHA-256, character count, and completion detector
- screenshot, snapshot, console, and network artifacts
- stable error code and suggested human action when recoverable

## Next Failure Codes

- `browser.cdp_unreachable`
- `browser.target_not_found`
- `lock.busy`
- `lock.timeout`
- `lock.release_failed`
- `auth.login_required`
- `auth.plan_not_pro`
- `session.not_found`
- `session.alias_conflict`
- `session.alias_project_mismatch`
- `session.alias_required`
- `session.thread_mode_conflict`
- `session.stale_conversation`
- `page.load_timeout`
- `page.composer_not_found`
- `model.option_unavailable`
- `model.selection_failed`
- `composer.clear_failed`
- `composer.input_mismatch`
- `input.paste_failed`
- `input.attachment_upload_failed`
- `send.no_user_message_observed`
- `send.blocked_by_modal`
- `response.timeout`
- `response.incomplete`
- `response.empty`
- `response.possibly_stale`
- `receipt.incomplete`

Keep codes stable and grep-friendly. Put the nuance in the human message and
receipt details.
