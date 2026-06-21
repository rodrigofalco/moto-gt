# MotoGT Documentation

This directory holds specs, plans, ADRs, and completed artifacts.

## Structure

```
docs/
├── adr/                  # Architecture Decision Records
├── spec/                 # Feature specifications
├── plans/                # Implementation plans
├── done/
│   ├── specs/            # Approved/implemented specs
│   ├── plans/            # Completed implementation plans
│   └── adrs/             # Accepted ADRs (optional archive)
└── OVERNIGHT-LOG.md      # Running dev log
```

## Workflow

1. **Spec** — capture what to build in `docs/spec/` using `TEMPLATE.md`.
2. **ADR** — record architectural decisions in `docs/adr/` as they are made.
3. **Plan** — create an implementation plan in `docs/plans/` that references the spec.
4. **Implement** — code the plan, run tests, update status to `done`.
5. **Archive** — move completed specs/plans to `docs/done/specs/` and `docs/done/plans/`.

Use the TEMPLATE files in each directory as starting points.

## Legacy docs

`docs/superpowers/` contains historical specs and plans from earlier project phases. Treat it as read-only archive. New work should go into `docs/spec/`, `docs/plans/`, and `docs/adr/`.

## Existing active plan

- `docs/plans/motogt-visual-fixes.md` — current implementation plan for visual polish and feature wiring.
