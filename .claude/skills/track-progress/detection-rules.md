# Detection Rules Reference

Rules for auto-detecting task completion by scanning the codebase. Each task in `tracker.json` can have a `detect` array of conditions. ALL conditions must pass for the task to be considered `done`. If SOME pass, it's `in-progress`.

## Condition Types

### `file_exists`

Check if one or more files exist.

```json
{ "type": "file_exists", "paths": ["src/app/page.tsx", "src/app/layout.tsx"] }
```

- Use Glob to check. Supports glob patterns: `"src/components/canvas/*.ts"`
- ALL paths must match for this condition to pass

### `file_contains`

Check if a file contains a specific string or regex pattern.

```json
{ "type": "file_contains", "path": "src/lib/trout/sizing.ts", "pattern": "computeTroutScore" }
```

- Use Grep with the pattern on the specified file
- The pattern is treated as a regex (escape special chars if needed)

### `export_exists`

Check if a module exports a specific name (function, class, const, type).

```json
{ "type": "export_exists", "path": "src/lib/db/schema.ts", "name": "holders" }
```

- Grep for `export (const|function|class|type|interface) {name}` or `export \{ ... {name} ... \}`

### `dir_not_empty`

Check if a directory exists and contains at least one file.

```json
{ "type": "dir_not_empty", "path": "public/assets/sprites" }
```

- Use Glob with `{path}/*` and check if results are non-empty

### `package_installed`

Check if a dependency exists in package.json (dependencies or devDependencies).

```json
{ "type": "package_installed", "packages": ["pixi.js", "@upstash/redis"] }
```

- Read `package.json` and check both `dependencies` and `devDependencies`
- ALL listed packages must be present

### `env_var_defined`

Check if an environment variable name appears in `.env.example`, `.env.local`, or `.env`.

```json
{ "type": "env_var_defined", "vars": ["DATABASE_URL", "REDIS_URL"] }
```

- Grep for `^{VAR_NAME}=` across env files
- ALL vars must be found in at least one env file

### `lines_gt`

Check if a file has more than N lines (useful to distinguish stubs from real implementations).

```json
{ "type": "lines_gt", "path": "src/lib/trout/movement.ts", "min": 30 }
```

- Read the file and count lines
- Passes if line count > `min`

### `config_key`

Check if a specific key exists in a JSON/JS config file.

```json
{ "type": "config_key", "path": "vercel.json", "key": "crons" }
```

- Read and parse the file, check if the key path exists

## Evaluation Logic

```
for each task with detect conditions:
  passed = count conditions that pass
  total  = count total conditions

  if passed == total:
    status = "done"
  elif passed > 0:
    status = "in-progress"
  else:
    status remains unchanged
```

Only upgrade status (pending → in-progress → done). Never downgrade automatically. If a task was manually set to `done` but detection says otherwise, flag it as a warning but don't change it.

## Notes

- Detection is a heuristic — it checks for evidence of implementation, not correctness
- Tasks without `detect` fields can only be updated manually
- Keep detection rules simple and fast — they run on every scan
- File paths are relative to the project root
