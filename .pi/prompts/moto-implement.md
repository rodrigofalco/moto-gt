---
description: Plan with GLM 5.2, then implement with kimi-coder
argument-hint: "<task>"
---

Use the `subagent` tool with `agentScope: "both"` and `confirmProjectAgents: false` in chain mode.

Chain:
1. `glm-planner` plans the implementation for: $@
2. `kimi-coder` implements the plan. Pass the planner's output via `{previous}`.