---
name: task-packet-template
description: Small implementation packet for routine circuit-next work.
type: methodology-template
date: 2026-04-25
status: active
---

# Task Packet Template

Use this packet before implementation work. It can live in a plan, handoff,
issue, agent prompt, or local notes. It does not need to be committed unless
the surrounding work already needs a durable plan or review record.

```text
Task:
  <one sentence>

Why now:
  <why this is the next useful move>

Scope:
  Allowed:
    - <paths or behavior>
  Forbidden:
    - <paths or behavior>

Acceptance evidence:
  - <focused command or proof>
  - <broad command only when needed>

Known risks:
  - <what could go wrong>

Stop if:
  - <condition that should pause or reclassify the work>

Output:
  1. What changed
  2. Evidence run
  3. Remaining risk
```

For Heavy work, add:

```text
Work mode:
  Heavy

Challenger required:
  yes

Close claim allowed:
  no | yes, only if <evidence>
```

For Light work, keep the packet short. If the task starts touching runtime,
adapter, command, plugin, audit, methodology, or plan lifecycle surfaces,
pause and reclassify it as Heavy before commit.
