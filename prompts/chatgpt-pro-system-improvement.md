You are ChatGPT Pro. Codex is operating this ChatGPT website session through a local Chrome DevTools Protocol harness from the repo `/Users/paulhan/dev/chat-gpt-pro-codex-plugin`.

We are designing a communications line between Codex and ChatGPT Pro, not a rigid bitstream protocol. The desired feel is closer to a telephone call between two capable AIs: Codex can bring repo files, test receipts, session history, screenshots, and questions; ChatGPT Pro can reason, critique, plan, and help debug; Codex then applies changes locally and can come back with more context.

Current proof:

- Dedicated persistent Chrome profile: `.devspace/chrome-profiles/chatgpt-pro`
- Real website target: `https://chatgpt.com/`
- CDP endpoint: `http://127.0.0.1:9222`
- Manual login is visible and explicit. If auth expires, we return `auth.login_required` and ask the human to log in.
- We can detect account plan and it currently reads as Pro.
- We dynamically read intelligence/model choices from the website. Current intelligence options are `Instant`, `Medium`, `High`, `Extra High`, `Pro`; current level is `Pro`. Current model root is `GPT-5.5`, current option `5.5`.
- We have a green live proof receipt where Codex typed a prompt, clicked the DOM send button, and read back the assistant message from the real website.
- We started adding multi-session primitives: list ChatGPT tabs, create new tab/session, alias a tab, activate/close by alias, and choose an existing conversation vs a new one.
- We started adding repo context bundle artifacts: `manifest.json`, `repo-context.md`, and `repo-context.zip`, with file tree, LOC, and file contents.

User direction:

- Move away from stiff smoke tests for real work.
- Preserve smoke tests only as health checks.
- Use ChatGPT Pro recursively to improve this system.
- Attach Codex session history and repo context deliberately to each query where useful.
- Support multiple ChatGPT session histories, likely through multiple browser tabs or conversation URLs with aliases.
- Support fluid back-and-forth: Codex sends context, ChatGPT thinks and responds, Codex applies changes, then sends the updated state back.
- Do not overbuild. Delete speculative layers when a smaller live surface works.

Please review this system as an engineering collaborator. Give a concrete improvement plan with:

1. The smallest product contract for a useful `chatgpt:call` / future plugin tool.
2. How to represent Codex session history so it is useful to you without becoming noisy.
3. How to choose between existing ChatGPT session history, a new chat, and named parallel chats.
4. How to attach repo context and artifacts, including when to paste text vs upload files/zip.
5. What failure codes and receipts we should add next.
6. What we should delete or avoid building.
7. The next 3 implementation steps Codex should make in this repo.

Be direct and practical. Assume Codex can run local scripts, inspect/edit files, control this browser through CDP, and rerun tests.
