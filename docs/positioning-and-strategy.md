# Circuit — Positioning & Strategy

Working notes from a positioning workshop. Captures pitch development, code-grounded audit of marketing claims, strategic gaps & opportunities, and the major insight that emerged: Circuit's distinctive value lies in being the substrate for **structured project memory** for both humans and agents.

These are working notes, not polished marketing copy. Some claims are honest about today's shipping reality; others are flagged as forward-looking and require build-out before they can be used externally.

---

## 1. Audience

**Center of gravity:** people burnt out by keeping up with coding-agent best practices who want working with coding agents to be simpler.

- **Primary:** engineers building real things over time who have felt agent drift, hallucinated completion, and "speed over correctness" pain. They have urgency and budget.
- **Secondary:** product designers entering coding-agent flows. They feel the same pain but typically aren't the wedge market.
- **Out of scope:** the "winging it, waiting for models to improve" cohort. Real audience, but not Circuit's. Don't dilute messaging trying to win them.

## 2. The pitch

### Headline

> **Stop reinventing your flow. Ship the product.**

Tested for universality (earlier "Design the product" leaned designer-specific).

### Long pitch (post-audit version, recommended for marketing surfaces)

> Most people drive a coding agent with one long chat and hope. Circuit gives that work a shape — named ways to explore, build, fix, and sweep.
>
> Each flow encodes the moves experienced AI engineers actually reach for: investigate before you build, plan before you act, verify before you review. The implementer isn't the reviewer — Circuit runs them as separate workers, the way frontier labs do. Every step demands evidence the agent has to produce; it can't close out without showing its work. Patterns most people only land on after months of trial and error. You get them as defaults.
>
> Pick how it runs. Every flow has lite, standard, and deep modes — same shape, different depth. Hand it the wheel in autonomous mode, or stay in the loop with checkpoints at the moments that matter.
>
> Each step is a self-contained module — a unit of capability with one clear job. Modules upgrade independently, so as best practices change, your flows inherit the improvements. Customize which skills apply at a step, a flow, or across your whole setup.
>
> The field changes weekly. The shape of your work doesn't have to.

### Elevator (~30 words)

> Most people drive a coding agent with one long chat and hope. Circuit gives that work a shape — named flows that encode the moves experienced AI engineers actually reach for, with evidence required at every step. Stop reinventing your flow. Ship the product.

### Beats (in order)

1. **Felt problem** — one long chat and hope. Circuit gives the work a shape via named flows.
2. **Provenance** — flows encode patterns experienced AI engineers reach for. Concrete proof points: separate implementer/reviewer workers, evidence required at every step.
3. **Depth modes** — lite / standard / deep / autonomous. User agency over depth without redesigning anything.
4. **Modularity** — each step is a self-contained module; modules upgrade independently; skills customizable at any level.
5. **Closer** — *The field changes weekly. The shape of your work doesn't have to.*

### Discarded framings (and why)

- *"Design system for working with coding agents"* — design-system metaphor too GUI-coded for designers.
- *"Staged schematics"* — both terms felt too internal as lead language.
- *"We sweat the meta. You ship the product."* — strong tagline but currently overclaims; no active update channel ships yet.
- *"Borrowed taste"* — too designer-specific once audience recalibrated to fatigue persona broadly.

## 3. Code audit — where the messaging is supported, stretched, or unsupported

| Claim | Status | Evidence |
| --- | --- | --- |
| Named ways to explore, build, fix, sweep | **Supported** | `src/flows/` directories; signal-routed entry per flow |
| Flows encode patterns experienced AI engineers reach for | **Strongly supported** | Build's stages: Frame→Plan→Act→Verify→Review→Close; explicit `evidence_requirements`; separate implementer/reviewer roles |
| Each step is a modular unit of capability | **Supported** | `StepExecutionKind` enum: `compose | relay | verification | checkpoint | sub-run | fanout` |
| Modules upgrade independently; flows inherit improvements | **Partially supported** | Versioning bone structure exists (`schema_version`, per-flow `version`, `candidate/active/deprecated`), but no distribution / auto-update channel exists yet |
| Customize skills at step / flow / setup level | **Strongly supported** | `selection-resolver.ts` resolves across config layers; `SkillOverride` modes: `inherit | replace | append | remove` |
| Variable model and effort per step | **Architecturally supported; defaults missing** | `SelectionOverride` carries optional `model` (openai/anthropic/gemini/custom) and `effort` (none/minimal/low/medium/high/xhigh) across a six-layer chain (default → user-global → project → flow → stage → step → invocation). Shipping flow definitions don't currently include curated per-step selection blocks — capability is real, opinionated defaults aren't. |
| "Best practices change every week. Circuit keeps up so you don't have to." | **Not yet supported** | No update channel. Architecture supports it; shipping reality doesn't. **Soften or build the channel before using.** |

## 4. Underused features that should be in the messaging

These are real, demonstrable, and pointed at the fatigue audience's actual pain:

- **Depth modes per flow** — every flow has `lite / standard / deep / autonomous` entry modes (verified in every schematic). *"Pick how thorough you want to be — the flow scales with you."*
- **Evidence requirements as anti-fakery** — every step has `evidence_requirements` the agent must produce; it literally can't close the step otherwise. *"The agent can't fake completion."* This directly addresses the audience's #1 complaint.
- **Checkpoints with safe defaults** — schematics carry `safe_default_choice` and `safe_autonomous_choice`; human-in-the-loop is first-class. *"Pause for you when it matters; run autonomously when you let it."*
- **Multi-agent review by default** — Build runs implementer and reviewer as separate workers (`role: "implementer"` vs `role: "reviewer"`). Frontier-lab pattern most users don't manually wire up.
- **Variable model and effort per step** — `SelectionOverride` supports model (openai/anthropic/gemini/custom) and effort (none/minimal/low/medium/high/xhigh) at six layers of granularity, including per-step. Enables frontier-lab pipeline patterns: cheap/fast model for Frame, high-effort reasoning model for Plan, *different* model for Review (real cognitive diversity, not two instances of the same model). *"Different models for different jobs, on by default — you don't have to pick."* **Caveat:** capability is shipping; curated per-step defaults in flow schematics aren't yet — build item before this graduates from architectural to demonstrable.
- **Structured report and evidence trail** — see Section 7. Currently treated as plumbing; should be a co-equal lead beat.

## 5. Strategic position

### Why Circuit has a window

- **Structural quality is orthogonal to model capability.** Smarter compilers didn't subsume linters, type systems, or test frameworks — they coexist. External invariants (evidence requirements, multi-agent review, forced verification) get *more* useful with capability, not less, because the model can actually meet them rather than hallucinating around them.
- **The substrate just stabilized.** Claude Code as a plugin host, SKILL.md as vocabulary, MCP as standard, sub-agents as a pattern — all landed inside the last ~12 months. The abstraction layer above these building blocks is wide open for ~6–12 months before either Anthropic ships something native or someone else fills it.
- **"No one else is doing this" reads as timing, not lack of demand.**

### Real gaps

1. **No discovery surface yet.** Where does a user encounter Circuit? Plugin marketplace? GitHub? Twitter? Pick the wedge.
2. **First-run experience is the first-mile risk.** A structured-flow product lives or dies in the first 5 minutes. Day-1 cost is the most expensive bug.
3. **The keep-up-for-you channel doesn't exist.** Architecture supports it; the actual update mechanism doesn't. Build the channel before scaling the marketing claim.
4. **No demonstrated proof.** The strongest claim — *"the agent can't fake completion"* — is unproven externally. A 30-second clip showing it would be worth more than the entire pitch document.
5. **Naming gap.** Plugin? CLI? Service? Pick the noun. Affects every messaging decision.

### Real opportunities

1. **Lead with reliability over fatigue.** *"Coding agents lie about being done. Circuit makes them prove it."* Sharper for engineers (the actual wedge) than the fatigue framing.
2. **Frontier patterns as product.** Multi-agent review, separate implementer/reviewer, evidence-required steps — well-documented in agent research, operationally hard to set up. *"Frontier-lab patterns, on by default."*
3. **The report and evidence trail as feature, not plumbing.** See Section 7 — this is the biggest under-sold differentiator.
4. **Plugin, not competitor.** Frame Circuit as making Claude Code better, not replacing it. Lower threat surface to Anthropic; ride their distribution.

### Risks to track

- **Anthropic absorbing the abstraction.** Real risk over 12–18 months. Mitigation: stay opinionated where a platform won't, and be a plugin not a competitor.
- **Complexity tax.** If using Circuit is more work than not, the audience rejects it. Pitch promises simplicity; first run must deliver simplicity.
- **Purist rejection.** Some engineers see opinionated flows as constraints, not guardrails. Not the audience. Don't dilute trying to win them.
- **Cold-start problem.** The compounding-memory value (Section 7) doesn't exist on day 1. Pitch needs to acknowledge that flow value is immediate, memory value compounds.

## 6. Validating proof demo — the comparison demo

Highest-leverage near-term work. *"Same task, two runs (with and without Circuit). Look at what gets produced."*

### What makes it work

- Lead with **evidence produced**, not outcome quality. *"Even when both runs work, only one produces something you can trust."* Less rigging-smell than "Circuit makes it succeed."
- Multiple runs per condition (≥3) to show distribution, not anecdote.
- Commit prompt + state publicly so anyone can rerun.
- Capture the killer moment if you can engineer it: agent says *done* → Circuit's verification demands evidence → agent runs verification → it fails → the agent realizes its own claim was wrong. *Circuit forces the agent to be honest with itself.*

### Three comparisons worth running

1. **Bug fix.** Plant a known bug. Tell: does the without-Circuit run produce a regression test, or just edit and declare done? *Probably the strongest single demo.*
2. **Feature with non-obvious edge case.** Tell: does the without-Circuit run skip planning and pay for it later?
3. **Multi-file refactor.** Tell: does the without-Circuit run leave the codebase in a worse state than it started?

### Format

Annotated blog post first (1–2 days, transcripts + screenshots + honest commentary). Video/GIF second, derived from the strongest moment in the post. Don't start with polished video.

## 7. The big positioning insight: structured project memory

The strongest standalone differentiator. Probably worth elevating to co-equal status with flow shape in the marketing pitch.

### The problem with MEMORY.md (the de facto industry pattern)

- **Lossy compression.** Reasoning gets flattened into summaries; alternatives considered drop out.
- **No provenance.** No timestamp, no link to the work that produced the decision, no evidence trail.
- **Self-overwriting.** Agents rewrite the file the same way they wrote it; detail decays each iteration.
- **Not queryable.** Single prose document; no schema; no axis for "all plans where verification failed."
- **No multi-axis recall.** Forces the agent to keyword-scan everything for relevance.

### Why structured reports are categorically different for agents

This is also where the *"smarter models will subsume this"* counter-argument is weakest — bigger models exploit structured memory **harder**, not less:

- They can **combine reports across runs** (multiple briefs + plans + verifications → coherent project narrative).
- They can **reason about provenance** (decision was made at time X, in context Y, after considering Z).
- They can **retrieve by schema** (`verification.failed = true`) instead of scanning.
- They can **detect contradiction** between past plans and current briefs.

### Working framings

> *Git tracks what changed in your code. Circuit tracks why your codebase is the way it is.*

> *MEMORY.md is the Google Doc strategy. Circuit is the database.*

### What's real today vs. what needs to be built

| Capability | Status |
| --- | --- |
| Per-run reports (brief, plan, verification, review, result) written to `reports/` | **Real** |
| Schema-versioned, machine-readable JSON | **Real** |
| Within-run continuity (pause/resume single run) | **Real** (`runtime/checkpoint.ts`, `schemas/continuity.ts`) |
| Cross-run query / recall surface | **Gap** — reports pile up but no `circuit history` / `circuit recall` to ask questions across them |
| Agent-side consumption (load relevant past reports at session start) | **Gap** — bridge from architecture-supports-it to capability-actually-shipping |

Closing those last two gaps is small relative to the leverage they unlock. Likely 1–2 weeks of focused work.

### The pitch this enables

The marketing now has two distinct payoffs operating on different time horizons:

1. **Day-one value (flow shape).** *Stop reinventing your flow. Ship the product.* Hooks the user.
2. **Compounding value (project memory).** *Your project gets smarter every time you use it, instead of forgetting.* Justifies long-term commitment.

### Strategic implications

- **Moat shifts from flow schematics (replicable) to accumulated project history (real switching cost).** Once a user has a year of Circuit reports and evidence, leaving means losing institutional memory, not just retraining muscle memory.
- **Audience expands** from fatigue persona to *anyone running long-lived projects with coding agents* — including teams, agencies, enterprises.
- **Competitive surface upgrades** from "category of one" to a visible category (vs. MEMORY.md / CLAUDE.md / Cursor-rules ecosystem). Being in a visible category beats being a category of one.
- **Circuit becomes the substrate for "agent observability."** Whether you build that layer or someone else does, owning the underlying data is leverage.

## 8. Capabilities brainstorm — sober tiers

What new capabilities are unlocked by queryable reports? Compared honestly against git history (the obvious existing tool).

### Strong (genuinely new value)

1. **Failed-attempt memory.** Agents repeat failed approaches because they can't see the past failures. Git doesn't preserve abandoned attempts; MEMORY.md compresses them out. Circuit captures every run including `@stop` and `revise` outcomes. *Uniquely Circuit territory.*
2. **Intent recovery for agents.** *"Why does the auth module retry 3 times?"* — agent retrieves the actual recorded brief instead of reverse-engineering from code. Database lookup, not reasoning under uncertainty.
3. **Trust calibration analytics.** *"How often does my agent's claimed completion actually pass verification on first try?"* Cannot be computed without structured runs. No git or MEMORY.md equivalent.
4. **Pre-task context loading for agents.** Before a new task, agent loads relevant past reports from related code. Invisible UX, compounding payoff. The longer you use Circuit on a codebase, the better future runs are.

### Marginal (real but redundant with existing tools)

5. **Click-to-provenance for humans.** Better than git, but disciplined PR culture covers most of it. Don't lead with this — but the *agent-facing version* (above) is much stronger.
6. **Decision DAG visualization.** Cool demo; niche utility.
7. **Onboarding narrative.** Generated walkthrough of "how this codebase came to be." Most teams answer this with docs or by reading code.
8. **Decision-level debugging for humans.** `git bisect` + reading PRs covers a lot. Sharper for *agent debuggers* than for humans.

### Speculative

9. **Cross-project pattern recognition.** Limited audience; speculative.
10. **Decision-diff for code review.** Powerful in theory; requires deep report corpus to be useful.

### How Circuit compares to git, honestly

- **Git: code state over time.** Authoritative for *what* changed.
- **Circuit: decision state over time.** Authoritative for *why*.

Two different layers, complementary. Don't claim Circuit replaces git. The strongest comparison framing is the **MEMORY.md** one, not the git one — that's where Circuit's distinctiveness is sharpest.

### The sober conclusion

The thing that's genuinely new isn't any one UX innovation. It's the **data layer** — structured, schema-versioned records of agent decisions across a codebase's lifetime. The interesting downstream capabilities (failed-attempt memory, intent recovery, trust analytics, pre-task context) are real and hard to replicate without it. Some of the demo-friendly ideas (click-to-provenance, DAG visualization) are real but marginal vs. existing tools.

> *Circuit is the substrate for agent-native project memory. Most of what you build on top of it is plumbing, not innovation. The innovation is producing the substrate consistently in the first place.*

That's defensible.

## 9. Open decisions

1. **Is project memory a co-equal lead beat, or the second beat under flow shape?**
   Working answer: flow leads (immediate hook), memory is the strong second beat. But the *Twitter-ready* one-liner is the memory framing — that's what travels.
2. **Build the cross-run recall surface (`circuit history`) before or after the comparison demo?**
   Working answer: build it first. Strengthens the demo (next session benefiting from previous reports) and makes memory positioning demonstrable.
3. **Decide on the keep-up channel.** Build it (and ship the moat) or stop promising it (and rephrase to architecture-supports-it).
4. **Pick the wedge audience for first launch.** Working answer: engineers, not designers — they have urgency and budget. Designers are second wave.
5. **Pick the noun.** Plugin, CLI, framework, service? Affects every downstream messaging choice.

## 10. Recommended near-term sequence

In order:

1. **Build the proof demo** (comparison demo: bug-fix run with vs. without Circuit, annotated blog post format).
2. **Spec and ship `circuit history` / cross-run recall** to make project-memory positioning demonstrable.
3. **Polish the first-run experience** until it's friction-free for new users.
4. **Build (or sunset) the keep-up channel.**
5. **Then invest in marketing.** Marketing without proof, polish, and target is what makes formative products feel like vapor.
