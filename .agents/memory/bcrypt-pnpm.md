---
name: bcrypt pnpm approval
description: How to enable bcrypt native build in this pnpm workspace
---

## Rule

bcrypt requires a native build (node-gyp). pnpm blocks this by default. To allow it, add to the root `package.json`:

```json
"pnpm": {
  "onlyBuiltDependencies": ["bcrypt"]
}
```

Then run `pnpm install` — it will run the native build automatically.

**Why:** pnpm's security model blocks native build scripts unless explicitly approved. The interactive `pnpm approve-builds` command does not work in non-TTY shell execution.

**How to apply:** Any time bcrypt is added as a dependency, patch root package.json before the next install.
