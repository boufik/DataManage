# Project rules for Claude Code

## 1. Git: The Absolute Boundary
* I must **manage `git` entirely on my own**. You must **NEVER** run `git add`, `git commit`, `git push`, `git pull`, `git checkout`, `git reset`, `git stash`, `git rebase`, `git merge`, `git branch`, `git switch`, or any other command that modifies repository state or working tree via git. So, no `git`-related commands for you.
* Read-only `git` inspection (`git status`, `git diff`, `git log`, `git show`) is allowed for you, mainly when needed for context.
* Do not suggest commit messages or PR descriptions unless I explicitly ask.
* *Summary*: I must retain **full control of `git`**, so you (the agent) must never run any `git` command that modifies the repository state.

## 2. Change workflow: Always Keep Me In The Loop
* Before writing or editing ANY file, **describe in plain text**:
   - Which files you intend to modify?
   - What the change does?
   - Why is the change needed?
   - Are there any side effects or files that might also need changes later?
* Wait for my explicit `"Go Ahead"` approval before making the edit.
* Make ONE logical change at a time. Do not batch unrelated edits.
* After each accepted edit, give me a **one-line summary of what changed**.
* Never run formatters, linters or test commands without asking me first.
* *Summary*: Before editing any file, you (the agent) must describe the planned change and wait for my explicit `"Go Ahead"` approval with one logical change at a time.

## 3. Scope Discipline
* Touch only files directly **related to the task** I described.
* If you think a change requires editing files outside the obvious scope, you must STOP and ASK me.
* Do not refactor "while you're in there." **Do not rename things I didn't ask to rename**.
* *Summary*: You must stay strictly within the scope of the requested task.

## 4. When Unsure
* Ask! Never guess! Never invent file paths, API names, or library functions!
* *Summary*: You must ask rather than guess when anything is unclear.