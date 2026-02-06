---
name: end-session
description: Summarize session, commit all changes, and close with clean git state
disable-model-invocation: true
---

# End Session

Complete the current work session: document, commit, and close.

## Reference Files

Read this supporting file before proceeding:
- `commit-conventions.md` — Commit message format and type reference

## Instructions

When this skill is invoked, execute this **complete workflow** — after it runs, the working directory should be clean and the session fully recorded in git history.

### 1. Find Current Session File
- Look for the most recent session file in `docs/sessions/`
- If `$ARGUMENTS` provides a path, use that instead
- If no session file exists, warn the user and offer to create a retroactive one

### 2. Complete Session Documentation

Update the session file with:

- **Files Changed** — gathered from `git status` and `git diff`:
  - Created: new untracked files
  - Modified: changed tracked files
  - Deleted: removed files
- **Decisions Made** — capture any significant choices made during the session
- **Summary** — 2-3 sentences of what was accomplished
- **Next Steps** — follow-up tasks for future sessions

### 3. Security Check

Scan staged/changed files for potential secrets:
- `.env` files or files containing `API_KEY`, `SECRET`, `PASSWORD`, `TOKEN`
- Credential files (`.pem`, `.key`, `credentials.json`)
- Warn the user if any are found — do NOT stage them

### 4. Generate Commit Message

Read `commit-conventions.md` for format reference. Generate a conventional commit message:

```
type(scope): short description

- Bullet point of change 1
- Bullet point of change 2

Session: docs/sessions/YYYY-MM-DD-HHMM-session.md
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Update the "Commit Message" section in the session file.

### 5. Stage Files

- Stage all changed files (including the session file itself)
- Exclude any files flagged in the security check
- Show the user what will be staged before proceeding

### 6. Commit

- Execute the commit with the generated message
- Use HEREDOC format for the commit message
- Report the commit hash

### 7. Report

Show the user:
- What was committed (file list)
- The commit hash
- Next steps from the session file
- Confirm working directory is clean

## Parameters

- `$ARGUMENTS` — Optional: Path to session file (auto-detects most recent if not provided)

## Example Usage

```
/end-session
/end-session docs/sessions/2026-02-04-1000-session.md
```
