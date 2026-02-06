---
name: track-progress
description: Track, auto-detect, and manage all implementation tasks for the Big Trout Fish project
disable-model-invocation: true
---

# Track Progress

Full project progress tracker — auto-detects completion from code, shows status reports, and manages the task list.

## Reference Files

Read these supporting files before proceeding:
- `tracker.json` — Source-of-truth task database (Phase → Epic → Task)
- `detection-rules.md` — Rules for auto-detecting task completion from codebase evidence

## Instructions

When this skill is invoked:

### 1. Parse Command

Check `$ARGUMENTS` for a subcommand:

| Subcommand | Action |
|-----------|--------|
| *(empty)* | Run full report (scan + status) |
| `scan` | Auto-detect progress from code, update tracker, show diff |
| `report` | Show progress report without scanning |
| `update <task-id> <status>` | Manually set a task status (`done`, `in-progress`, `blocked`, `skip`) |
| `add <epic-id> "<title>"` | Add a new task to an existing epic |
| `remove <task-id>` | Remove a task from the tracker |
| `detail <epic-id>` | Show all tasks in an epic with full details |
| `next` | Show the recommended next tasks to work on (unblocked, highest priority) |
| `blocked` | Show all blocked tasks and what's blocking them |

If no subcommand is recognized, default to full report (scan + status).

### 2. Load Tracker

- Read `tracker.json` from this skill's directory (`.claude/skills/track-progress/tracker.json`)
- Parse the JSON structure: `{ phases: [{ id, name, epics: [{ id, name, tasks: [...] }] }] }`
- Count totals: total tasks, done, in-progress, blocked, pending

### 3. Auto-Detect Progress (if `scan` or default)

Read `detection-rules.md` for the full detection ruleset. For each task that has a `detect` field:

- **`file_exists`** — Check if the specified file path(s) exist using Glob
- **`file_contains`** — Check if a file contains a specific string/pattern using Grep
- **`export_exists`** — Check if a module exports a specific name
- **`dir_not_empty`** — Check if a directory exists and has files
- **`package_installed`** — Check if a dependency is in `package.json`
- **`env_var_defined`** — Check if a variable appears in `.env.example` or `.env.local`
- **`lines_gt`** — Check if a file has more than N lines (not just a stub)

For each detection:
- If ALL conditions pass → mark task as `done` (if not already)
- If SOME conditions pass → mark as `in-progress` (if currently `pending`)
- If NONE pass → leave current status unchanged

When status changes are detected, show a diff:
```
[DETECTED] 1.1.2 "Initialize Next.js project" — pending → done
[DETECTED] 2.3.1 "Implement SpatialGrid class" — pending → in-progress
```

### 4. Save Updates

- Write the updated `tracker.json` back to disk
- Preserve all fields, only modify `status` and `updatedAt` for changed tasks

### 5. Show Progress Report

Generate and display this report format:

```
═══════════════════════════════════════════════════
  BIG TROUT FISH — Project Progress
═══════════════════════════════════════════════════

  Overall: ██████░░░░░░░░░░░░░░ 28/94 (29.8%)

─── Phase 1: MVP (1-2 Weeks) ──────────────────
  Progress: ████████░░░░░░░░░░░░ 22/56 (39.3%)

  [1.1] Project Setup          ████████████████████ 8/8   (100%)
  [1.2] Rendering Engine        ██████████░░░░░░░░░░ 5/10  (50%)
  [1.3] Spatial & Culling       ░░░░░░░░░░░░░░░░░░░░ 0/5   (0%)
  [1.4] Movement & Simulation   ██░░░░░░░░░░░░░░░░░░ 1/6   (16.7%)
  ...

─── Phase 2: Post-MVP ─────────────────────────
  Progress: ██░░░░░░░░░░░░░░░░░░ 6/38 (15.8%)

  ...

═══════════════════════════════════════════════════
  Last scanned: 2026-02-06 15:30
  Next recommended: 1.3.1 "Implement SpatialGrid class"
═══════════════════════════════════════════════════
```

Use these status symbols in detailed views:
- `[x]` done
- `[~]` in-progress
- `[!]` blocked
- `[-]` skipped
- `[ ]` pending

### 6. Show Recommendations (if `next` or default)

Identify the top 3-5 tasks to work on next based on:
1. Phase 1 before Phase 2
2. Tasks whose dependencies (blockedBy) are all `done`
3. Tasks earlier in the epic ordering (foundational work first)
4. Tasks marked as `priority: high`

Display each with its ID, title, epic context, and detection criteria.

### 7. Handle Manual Updates (if `update`, `add`, `remove`)

**For `update <task-id> <status>`:**
- Find the task by ID (e.g., `1.3.2`)
- Validate the status is one of: `done`, `in-progress`, `blocked`, `pending`, `skip`
- If setting to `blocked`, use AskUserQuestion to ask what's blocking it
- Update the task and save

**For `add <epic-id> "<title>"`:**
- Find the epic by ID (e.g., `1.3`)
- Generate the next sequential task ID
- Use AskUserQuestion to collect: description, detection rules (optional), blockedBy (optional), priority
- Add the task and save

**For `remove <task-id>`:**
- Confirm with the user before removing
- Remove from any blockedBy references in other tasks
- Save

## Parameters

- `$ARGUMENTS` — Optional subcommand and arguments (see table in Step 1)

## Example Usage

```
/track-progress                          # Full scan + report
/track-progress scan                     # Scan code and update tracker
/track-progress report                   # Report only (no scan)
/track-progress next                     # Show recommended next tasks
/track-progress detail 1.2               # Show all tasks in Rendering Engine epic
/track-progress update 1.3.2 done        # Mark task as done
/track-progress add 1.2 "Add bubble particle effects"
/track-progress remove 2.4.3             # Remove a task
/track-progress blocked                  # Show all blocked tasks
```
