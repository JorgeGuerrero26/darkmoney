## Approach
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.

## Git workflow
- Make one commit per logical unit, never one global commit with unrelated work.
- Before staging, review `git status` and identify which files belong to each topic.
- Group files by theme and use `git add <specific files>`. Avoid `git add -A` when multiple topics are mixed in the worktree.
- Use scoped, imperative commit messages, for example `fix(snapshot): ...`, `feat(obligations): ...`, or `refactor(workspace-data): ...`.
- After each important group, verify with `npm run typecheck` before moving on.
- During multi-phase refactors, create checkpoint commits such as `wip(refactor-X): phase N - <what is ready>`.
- Do not use `git checkout <file>` or `git restore <file>` on unbacked work.
