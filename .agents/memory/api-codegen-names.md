---
name: API codegen name collisions
description: Orval can assign one export name to both a path validator and a query-parameter type.
---

When an endpoint has both path and query parameters, generated path validators and query-parameter types can have identical names. Keep the server validator's public name and explicitly alias the query type in the non-generated export barrel.

**Why:** Adding an optional stale-seat check to cancellation exposed a duplicate export that broke library typechecking, despite both generated outputs being individually valid.

**How to apply:** After changes to parameter kinds, run codegen and library typechecking. Resolve ambiguous exports outside generated files so regeneration preserves the fix and existing server imports remain valid.
