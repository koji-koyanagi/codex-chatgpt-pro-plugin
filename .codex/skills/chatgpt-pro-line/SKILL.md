---
name: chatgpt-pro-line
description: Use the packaged ChatGPT Pro communication line for blocking AI-to-AI reasoning through the persistent browser session.
---

# ChatGPT Pro Line

## Intended Use

Use ChatGPT Pro for higher-level intelligence tasks where a second strong model
can materially improve the work:

- system architecture and technical strategy
- product and feature design decisions
- specification drafting and critique
- research synthesis, including online research when appropriate
- risk analysis, tradeoff review, and planning across files/repos/agents
- debugging strategy for confusing failures after Codex has gathered evidence

Do not burn the line on trivial syntax, mechanical edits, or proof-only smoke
tests except when validating the transport itself. Transport tests prove the
line works; they are not the product.

Ask for high-leverage judgment, not merely the smallest next patch. It is fine
to request the most intelligent or bold implementation direction given the
evidence; Codex can still execute that direction in small, testable slices.
Invite ChatGPT Pro to disagree, ask clarifying questions, propose a different
architecture, or recommend larger prerequisite work when that is the
professional answer. The line is for senior planning and system judgment, not
for rubber-stamping the current implementation.

## Canonical Command

```bash
chatgpt-pro call \
  --alias=main \
  --prompt-file=prompt.md \
  --context-dir=.devspace/context/current \
  --response-mode=blocking
```

Equivalent minimal form:

```bash
chatgpt-pro call --alias=main --prompt="..."
```

Inside this development repo, `npm run chatgpt:call -- ...` remains a local
alias for the same behavior.

By default, `chatgpt-pro call` selects the live `Pro` intelligence level when
the website exposes it. Use `--level=...` / `--intelligence=...` or
`CHATGPT_LEVEL` to choose another live label. Use `--no-default-pro` only for
transport debugging where changing the selector would obscure the failure.

## Required Live Thread Output

When using this line in a Codex conversation, repeat the exchange verbatim in
the thread using these exact headings:

```md
## Message Sent To ChatGPT Pro

...

## Message Received From ChatGPT Pro

...
```

The run artifact `transcript.md` must use the same headings. The canonical
renderer is `src/transcript.mjs`.

`chatgpt-pro call` prints this exact thread-echo block by default after the
receipt paths. Copy the printed block into the Codex thread. Do not summarize,
paraphrase, trim, or rewrite the `Message Sent To ChatGPT Pro` or
`Message Received From ChatGPT Pro` sections. Additional commentary may come
before or after the exact block, but not inside it.

`chatgpt-pro read` prints the exact received message. Machine callers may set
`CHATGPT_THREAD_ECHO=0`, but interactive Codex use should leave echoing on and
receipts must record `threadEcho.mode`, `threadEcho.transcriptSha256`,
`threadEcho.sentSha256`, and `threadEcho.receivedSha256`.

Verify transcript integrity when needed:

```bash
chatgpt-pro transcript verify --receipt=.devspace/runs/<run-id>/receipt.json
```

## Response Mode

Default and only implemented mode:

- `blocking`: send the prompt, wait for the anchored assistant response, write
  artifacts, then continue.

Reserved for later:

- `event`: send and return a run id immediately, then read/poll later.

If a caller requests anything except `blocking`, the command should fail rather
than pretending event mode exists.

## Context

By default, `chatgpt-pro call` generates and attaches a repo context monofile
unless `--no-repo-context` or `CHATGPT_ATTACH_REPO_CONTEXT=0` is set. The
bundle lives under `.devspace/context-bundles/<id>/` and includes:

- `repo-context.md`: one markdown file containing repo structure, LOC, file
  contents, and a source map
- `manifest.json`: machine-readable file and directory records, including line
  ranges in `repo-context.md`
- `repo-context.zip`: zipped `repo-context.md` plus `manifest.json`

Generate it directly when needed:

```bash
chatgpt-pro context bundle
npm run context:bundle
```

Prefer `--context-dir` over hand-stitching prompts when adding more context.
Recognized files:

- `codex-session-digest.md`
- `chatgpt-history.md`
- `repo-context.md`, or `manifest.json` when repo context is absent
- `diff.patch`
- `test-output.txt`

The wrapper composes `input.md`, records hashes/budgets/omissions in
`receipt.json`, and saves the exact exchange in `transcript.md`.

For human-driven ChatGPT threads, bind the thread URL to a repo alias and export
visible history before asking Codex to continue from it:

```bash
chatgpt-pro sessions alias --name=spec --rebind-alias --conversation-url=https://chatgpt.com/c/...
chatgpt-pro history export --alias=spec --last=20
chatgpt-pro history export --alias=spec
```

The history export writes `chatgpt-history.md` and `history.json` under
`.devspace/chatgpt-history/<alias>/...`, including both user and assistant
messages. Use `--last=N` for a recent window or omit it for the full visible
conversation.

## Repo-Scoped Rooms

Aliases are owned by the current repo. Before using a room alias, the wrapper
checks `.devspace/state/chatgpt-project.json`, the git-level
`chatgpt-pro.projectId`, and the canonical session registry:

```text
~/.chatgpt-pro-codex/projects/<projectId>/chatgpt-sessions.json
```

Linked git worktrees share the same project id and therefore the same rooms.
Separate git repositories get separate project ids. Non-git folders fall back
to a realpath-derived project id.

Room policy:

- `main`: long-lived repo collaboration and implementation planning.
- `debug`: focused failure investigation while the bug family is the same.
- `critic`: independent review; prefer `--fresh` or `--new` for clean critique.
- `scratch`: disposable experiments and prompt tests.

Use:

```bash
npm run sessions:project
npm run sessions:list
npm run sessions:alias -- --name=main
```

Thread modes:

```bash
chatgpt-pro call --alias=main --prompt="..."       # continue repo-owned main
chatgpt-pro call --alias=critic --fresh --prompt="..." # new unbound thread, alias hint only
chatgpt-pro call --alias=critic --new --prompt="..."   # new thread bound to critic
chatgpt-pro call --alias=main --rebind-alias --conversation-url=https://chatgpt.com/c/... --prompt="..."
```

`--fresh` must not mutate the alias. `--new` requires an alias and moves that
alias to the newly opened thread while preserving lineage. `--rebind-alias`
points an alias at an already-open conversation and should be used only as an
explicit repair/migration step.

For normal multi-agent use, do not open a new tab on every call. Create or bind
a repo-owned room once, then keep using that alias:

```bash
chatgpt-pro call --alias=critic --new --prompt="Start a clean review room for this repo."
chatgpt-pro call --alias=critic --prompt-file=next-review.md
```

Use `--fresh` for clean one-off reviews where you explicitly do not want to
change the alias. Use `--new` when the alias should move to a new long-lived
thread.

If an alias belongs to another repo, fail closed with
`session.alias_project_mismatch`. Rebind only when deliberate:

```bash
npm run sessions:alias -- --name=main --rebind-alias
npm run chatgpt:call -- --alias=main --rebind-alias --prompt="..."
```

Before every alias `call` or `read`, the wrapper must verify the browser target
is showing the alias's expected ChatGPT conversation URL. If the saved target id
is stale or points at a different thread, repair by finding an already-open
target with the expected conversation id or by opening the expected URL. Do not
send or read from a target that is not bound to the room; receipts should expose
`roomTarget.targetBoundToRoom`.

## Global Browser Lock

Calls share one logged-in browser profile. The wrapper serializes access with a
package-global browser-profile lock at:

```text
~/.chatgpt-pro-codex/locks/browser-profile.lock/
```

Default behavior is blocking: wait up to 10 minutes for the lock, heartbeat
while held, reclaim stale locks only when the owner appears dead, and record
`owner` plus `lock` fields in the receipt.

Useful flags:

```bash
chatgpt-pro call --alias=main --lock-timeout-ms=600000 --prompt="..."
chatgpt-pro call --alias=main --no-wait --prompt="..."
chatgpt-pro read --alias=main --stale-lock-ttl-ms=900000
```

V1 allows only one live `call` or `read` at a time. Do not bypass the wrapper to
drive a parallel ChatGPT tab through the same profile.

Room registry writes use a separate per-project state lock:

```text
~/.chatgpt-pro-codex/projects/<projectId>/state.lock/
```

Use the global browser lock for live ChatGPT control. Use the project-state lock
only around short `chatgpt-sessions.json` read/modify/write sections, and write
state atomically. Do not hold the project-state lock during the full blocking
ChatGPT response wait.

## Non-Interference

The canonical message path must not use OS-level mouse or keyboard automation.
It should use the dedicated Chrome/CDP target:

- DOM focus for the composer
- CDP `Input.insertText` for text insertion
- DOM button click for send

The line is text-only. Do not use ChatGPT voice, dictation, microphone, audio
capture, or spoken commands. If the website drifts into a voice-oriented
surface, wait for or navigate back to the text composer and continue through
the normal text prompt path.

Do not use Computer Use, AppleScript, shell UI automation, CDP mouse dispatch, or
CDP key dispatch for the canonical call path.

Run:

```bash
npm run test:non-interference
```

## Failure Posture

Fail closed when provenance is unclear:

- `auth.login_required`: human login needed in the visible browser
- `lock.busy`: another run owns the browser profile lock and `--no-wait` was used
- `lock.timeout`: timed out waiting for another run to release the browser profile
- `lock.release_failed`: the lock owner changed before release
- `state_lock.busy`: another process owns the project session-registry lock
- `state_lock.timeout`: timed out waiting for the project session-registry lock
- `state_lock.release_failed`: the project lock owner changed before release
- `session.alias_required`: `--new` or `--rebind-alias` was used without an alias
- `session.thread_mode_conflict`: incompatible thread flags were combined
- `session.alias_project_mismatch`: requested alias belongs to another repo
- `model.option_unavailable`: requested Pro/model/level choice is unavailable
- `composer.clear_failed`: stale composer text could not be cleared before typing
- `composer.input_mismatch`: composer text did not match the prompt before send
- `send.no_user_message_observed`: send was attempted but no new user message appeared
- `send.prompt_echo_mismatch`: the observed user message does not match the prompt
- `response.no_assistant_after_user`: no assistant response appeared after the sent message
- `response.possibly_stale`: response could not be bound to the sent prompt
- `mode.unsupported`: requested response mode is not implemented

## Do Not

- Bypass `chatgpt-pro call` for normal work.
- Hand-stitch repo context when the monofile/context-dir path can budget,
  source-map, hash, and record it.
- Hide login/auth failures from the human.
- Use a fresh ChatGPT tab for every call by default.
- Implement event mode, hooks, background polling, file upload defaults, or
  automatic tab cleanup before the blocking line is boringly reliable.
