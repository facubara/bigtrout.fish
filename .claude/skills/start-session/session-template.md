# Session: YYYY-MM-DD HH:MM

**Goal**: [What this session aims to accomplish]
**Agent Roles**: [Which agent roles were used: SpecCurator, FrontendIntegrator, etc.]

## Model Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Subagent Model | `inherit` | Model for subagent tasks: `inherit`, `haiku`, `sonnet`, `opus` |

*`inherit` = use conversation model. Use `haiku` for cost savings on bounded tasks.*

---

## Work Summary

[2-3 sentence summary of what was accomplished]

## Files Changed

### Created
- `path/to/new-file.ts` - [brief purpose]

### Modified
- `path/to/existing-file.py` - [what changed]

### Deleted
- `path/to/removed-file.ts` - [why removed]

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| [Topic] | [What was decided] | [Why] |

*Note: Create an ADR in `docs/adr/` for significant architectural decisions*

## Security Checklist

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All data is synthetic (no real customer/company data)
- [ ] No proprietary algorithms exposed (using stubs)
- [ ] Environment variables used for configuration

## Commit Message

```
[type](scope): [short description]

- [Change 1]
- [Change 2]
- [Change 3]

Session: docs/sessions/YYYY-MM-DD-HHMM-session.md
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Commit types**: feat, fix, docs, refactor, test, chore

## Next Steps

- [ ] [Follow-up task 1]
- [ ] [Follow-up task 2]

## Notes

[Any additional context, blockers, or observations]

---
*Session ended: YYYY-MM-DD HH:MM*
