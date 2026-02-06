---
name: start-session
description: Initialize a clean, reproducible working session with context and tracking
disable-model-invocation: true
---

# Start Session

Begin a new work session with proper tracking and context.

## Reference Files

Read this supporting file before proceeding:
- `session-template.md` — Session file template

## Instructions

When this skill is invoked:

### 1. Create Session File
- Generate filename: `docs/sessions/YYYY-MM-DD-HHMM-session.md` using current date/time
- Copy the template from the `session-template.md` supporting file in this skill directory
- Fill in the date/time in the header

### 2. Read Recent Context
- Read the 2-3 most recent session files in `docs/sessions/` to understand recent work
- Check `docs/adr/` for any recent ADRs that provide context
- Summarize what was done recently for continuity

### 3. Verify Git State
- Run `git status` to check for uncommitted changes
- If uncommitted changes exist from a previous session, warn the user
- Show current branch name

### 4. Initialize Session
- Parse `$ARGUMENTS` for the session goal (ask user if not provided)
- Ask for model preference if not specified: `inherit` (default), `haiku`, `sonnet`, `opus`
- Identify which agent roles will likely be needed based on the goal
- Create a TodoWrite list with initial tasks
- Fill in the session file with goal and agent roles

### 5. Confirm Ready
- Report the session file path
- Show recent context summary
- Show git state (branch, clean/dirty)
- Confirm ready to begin work

## Parameters

- `$ARGUMENTS` — Optional: Session goal (if not provided, will ask)
- `--model=<value>` — Optional: Subagent model preference (`inherit`, `haiku`, `sonnet`, `opus`). Default: `inherit`

## Example Usage

```
/start-session Implement market research dashboard
/start-session --model=haiku Build dashboard components
```

## Notes

- Always update the session file as work progresses
- Track every file created/modified/deleted
- Record decisions with brief rationale
