---
description: Parallel code review by kimi-coder and local-coder
argument-hint: "[scope or files]"
---

Use the `subagent` tool with `agentScope: "both"` and `confirmProjectAgents: false` in parallel mode.

Run two reviews concurrently:
1. `kimi-coder` reviews ${1:-the recent changes} for correctness, bugs, TypeScript strictness, and MotoGT conventions.
2. `local-coder` reviews ${1:-the recent changes} for the same, focusing on edge cases and test coverage.

After both return, synthesize their findings into a prioritized list of issues and fixes.