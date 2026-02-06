# Commit Message Conventions

## Format

```
type(scope): short description

- Detail 1
- Detail 2

Session: docs/sessions/YYYY-MM-DD-HHMM-session.md
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Types

| Type | Use When |
|------|----------|
| `feat` | Adding new functionality |
| `fix` | Fixing a bug |
| `docs` | Documentation-only changes |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks (deps, config, tooling) |

## Scope

The scope should indicate the affected area:

| Scope | Area |
|-------|------|
| `embed` | Embeddable widget feature |
| `admin` | Admin panel |
| `auth` | Authentication system |
| `chat` | Chat/conversation functionality |
| `api` | Backend API routes |
| `graph` | LangGraph workflow |
| `db` | Database layer |
| `ui` | UI components |
| `adr` | Architecture Decision Records |
| `skills` | Claude Code skills |

## Rules

1. **Title line**: Max 72 characters, imperative mood ("add", not "added")
2. **Body**: Bullet points describing what changed
3. **Session reference**: Always include the session file path
4. **Co-author**: Always include the Claude co-author line
5. **No period** at the end of the title line
