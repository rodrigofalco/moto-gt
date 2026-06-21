---
name: moto-gt-docs
description: MotoGT documentation workflow — specs, plans, ADRs, and archiving. Use when asked to plan a feature, write a spec, record a decision, or archive completed work.
---

# MotoGT Documentation Workflow

## Directory layout

```
docs/
├── spec/                 # Feature specifications
├── plans/                # Implementation plans
├── adr/                  # Architecture Decision Records
├── done/
│   ├── specs/            # Completed/implemented specs
│   ├── plans/            # Completed plans
│   └── adrs/             # Accepted ADRs
└── README.md             # Workflow overview
```

## When to use each artifact

| Artifact | Use for | Template |
|----------|---------|----------|
| Spec | What to build and why | `docs/spec/TEMPLATE.md` |
| Plan | How to implement a spec | `docs/plans/TEMPLATE.md` |
| ADR | Significant architectural or design decision | `docs/adr/TEMPLATE.md` |

## Existing docs

- `docs/superpowers/` — historical archive from earlier phases. Read-only.
- `docs/plans/motogt-visual-fixes.md` — current active implementation plan.

## Naming conventions

- Specs: `docs/spec/spec-NNNN-short-name.md`
- Plans: `docs/plans/plan-NNNN-short-name.md`
- ADRs: `docs/adr/adr-NNNN-short-name.md`

Use sequential 4-digit numbers. Find the next number by listing existing files.

## Workflow

1. **Discover** — check `docs/spec/`, `docs/plans/`, and `docs/adr/` for related work.
2. **Spec** — if no spec exists, create one from the template.
3. **Decide** — if architectural trade-offs arise, write or update an ADR.
4. **Plan** — create a plan referencing the spec and any ADRs.
5. **Implement** — execute the plan (often delegated to `kimi-coder`).
6. **Archive** — when a spec/plan is fully implemented, move it to `docs/done/specs/` or `docs/done/plans/` and update its status to `archived`.

## Status values

- Spec: `draft`, `review`, `approved`, `implemented`, `archived`
- Plan: `draft`, `in-progress`, `done`, `cancelled`
- ADR: `proposed`, `accepted`, `deprecated`, `superseded`

## Cross-references

Always link related artifacts:

```markdown
- Spec: `docs/spec/spec-0001-race-result.md`
- Plan: `docs/plans/plan-0001-race-result.md`
- ADR: `docs/adr/adr-0001-no-physics-engine.md`
```

## Tool usage

- Use `read` to load templates and existing docs.
- Use `write` to create new spec/plan/ADR files.
- Use `edit` to update status and cross-references.
- Use `bash` with `mv` to archive completed files.
