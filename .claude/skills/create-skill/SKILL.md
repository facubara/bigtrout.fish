---
name: create-skill
description: Scaffold a new skill directory with SKILL.md and optional supporting files
disable-model-invocation: true
---

# Create Skill

Generate a new skill following the project's established conventions.

## Reference Files

Read these before proceeding:
- Existing skills in `skills/start-session/SKILL.md` and `skills/end-session/SKILL.md` for tone and structure reference

## Instructions

When this skill is invoked:

### 1. Gather Inputs

Use `AskUserQuestion` to collect any of the following that `$ARGUMENTS` doesn't cover:

- **Skill name** (required) -- lowercase, kebab-case (e.g., `add-indicator`, `run-backtest`)
- **Purpose** (required) -- one sentence describing what the skill does and when it should be used
- **Steps** (required) -- what the skill should do, in the user's words (this skill will formalize them)

### 2. Validate

- Check `skills/` for naming conflicts. If a skill with the same name exists, warn the user and ask for a different name.
- Reject names that are too generic (e.g., `do-stuff`, `helper`, `misc`).
- If the skill has more than 10 steps, suggest splitting it into two skills.

### 3. Create Skill Directory

```
skills/{skill-name}/
  SKILL.md          -- main skill definition (always created)
  {supporting}.md   -- optional supporting files (templates, conventions, etc.)
```

### 4. Write SKILL.md

Use this exact structure:

```markdown
---
name: {skill-name}
description: {one-line description}
disable-model-invocation: true
---

# {Display Name}

{One sentence purpose.}

## Reference Files

Read this supporting file before proceeding:
- `{file}.md` -- {description}

(Omit this section if no supporting files are needed.)

## Instructions

When this skill is invoked:

### 1. {First Step Title}
- {Concrete action}
- {Concrete action}

### 2. {Second Step Title}
- {Concrete action}

(Continue numbered steps...)

## Parameters

- `$ARGUMENTS` -- {What the user can pass when invoking the skill}

## Example Usage

\```
/{skill-name}
/{skill-name} {example argument}
\```
```

### 5. Write Supporting Files (if needed)

If the skill requires templates, conventions, or reference data:
- Create them as separate `.md` files in the skill directory
- Reference them in the `Reference Files` section of `SKILL.md`
- Follow the pattern used by `start-session/session-template.md` and `end-session/commit-conventions.md`

### 6. Confirm

- Show the user the created file(s)
- Report the skill directory path
- Show how to invoke: `/{skill-name}` or `/{skill-name} {args}`

## Parameters

- `$ARGUMENTS` -- Optional: Skill name and/or description (e.g., `add-indicator Scaffold a new technical indicator`)

## Example Usage

```
/create-skill
/create-skill add-indicator
/create-skill add-indicator Scaffold a new technical indicator with signal normalization
```

## Constraints

- One skill per directory. One `SKILL.md` per directory.
- Skill names must be kebab-case, 2-4 words, descriptive of the action.
- Every step in the generated skill must be a concrete, verifiable action. No vague instructions.
- Do not duplicate existing skills.
- Do not create skills for one-off, non-repeatable tasks.
- Match the tone and depth of existing skills in the project.
