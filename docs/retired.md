# Retired Files

This ledger records files moved out of the public surface during cleanup. Files
are moved to `recycle-bin/` locally and the folder is gitignored; git history is
the durable recovery path.

| Date | Original path | Retired path | Reason |
| --- | --- | --- | --- |
| 2026-06-17 | `.codex/skills/browser-loop/SKILL.md` | `recycle-bin/20260617/.codex/skills/browser-loop.SKILL.md` | Lower-level dummy/browser-loop agent contract was superseded by the packaged `chatgpt-pro-line` skill and docs. |
| 2026-06-17 | `scripts/chatgpt-sessions.mjs` | `recycle-bin/20260617/scripts/chatgpt-sessions.mjs` | Public `sessions` compatibility command was removed; product surface is repo-owned `rooms`. |
| 2026-06-17 | `prompts/chatgpt-pro-system-improvement.md` | `recycle-bin/20260617/prompts/chatgpt-pro-system-improvement.md` | One-off planning prompt from system bring-up; README and call contract now document the operating contract. |
