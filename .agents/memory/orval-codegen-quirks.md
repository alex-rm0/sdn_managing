---
name: Orval codegen quirks
description: Known issues when running Orval codegen with the Zod output plugin in this workspace
---

## Rule 1: Remove format: email from OpenAPI spec

Orval's Zod output generates `zod.email()` for fields with `format: email`, which does not exist in any version of Zod. The correct Zod API is `z.string().email()`, but Orval does not produce that.

**Why:** Orval maps OpenAPI `format: email` literally to `zod.email()` which is invalid.

**How to apply:** Strip `format: email` from all string fields in `openapi.yaml` before running codegen.

## Rule 2: Operations with both path params AND query params cause TS2308 collisions

When an operation has a path parameter (e.g. `{id}`) AND query parameters, Orval generates:
- A Zod schema named `GetXxxParams` in `api.ts` (for path params: `{id}`)
- A TypeScript interface named `GetXxxParams` in `types/getXxxParams.ts` (for query params)

Both are re-exported by `index.ts`, causing `TS2308: Module has already exported a member named 'GetXxxParams'`.

**Why:** Orval uses the same naming convention for both path-param Zod schemas and query-param TS types.

**How to apply:** For operations with path params, remove any query parameters from the OpenAPI spec (move them to a sibling pure-query endpoint if needed, or handle them inline in the route handler). Orval generates separate `GetXxxQueryParams` Zod schemas for query-only operations.

## Rule 3: Query-param-only operations don't generate Zod schemas named `XxxParams`

For operations with ONLY query params (no path params), Orval generates:
- A TS type `GetXxxParams` in `types/` (no Zod schema in api.ts)
- A Zod schema `GetXxxQueryParams` in `api.ts`

So in route files, always import `GetXxxQueryParams` (not `GetXxxParams`) for validating `req.query`.
