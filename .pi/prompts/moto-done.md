---
description: Archive completed specs and plans to docs/done/
argument-hint: "<spec-id|plan-id|all>"
---

Load the `moto-gt-docs` skill.

Archive the completed artifacts specified by ${1}:
- Move implemented specs from `docs/spec/` to `docs/done/specs/`.
- Move done plans from `docs/plans/` to `docs/done/plans/`.
- Move accepted ADRs from `docs/adr/` to `docs/done/adrs/` if requested.

Update status to `archived` in the moved files. If `${1}` is `all`, archive every spec/plan/adr with status `implemented`/`done`/`accepted`.

Scope: $@