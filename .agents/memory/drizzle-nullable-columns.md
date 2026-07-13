---
name: Drizzle nullable numeric columns
description: Correct Drizzle ORM column type for nullable integer columns
---

## Rule

Use `integer("col_name")` for nullable integer columns. Never use `serial("col_name")` for a column that should be nullable.

**Why:** `serial()` in Drizzle maps to PostgreSQL `SERIAL` which is `NOT NULL` + a sequence. Attempting to insert `null` causes a DB constraint error. `integer()` without `.notNull()` is nullable.

**How to apply:** Review all Drizzle schema columns that may hold null values; ensure they use `integer()`, `numeric()`, `text()`, etc. — not `serial()`.
