import { z } from 'zod';
import { PhaseId, SkillId, StepId } from './ids.js';
import { Rigor } from './rigor.js';

// SEL-I4 — provider-scoped model. The four-provider enum is closed; `model`
// is an open string because adapter-specific code owns provider/model
// handling. New model releases do not force a schema change here.
export const ProviderScopedModel = z
  .object({
    provider: z.enum(['openai', 'anthropic', 'gemini', 'custom']),
    model: z.string().min(1),
  })
  .strict();
export type ProviderScopedModel = z.infer<typeof ProviderScopedModel>;

// SEL-I4 — Effort tier. OpenAI's 6-tier vocabulary, chosen for cross-
// provider portability (see specs/evidence.md hard invariant 8).
export const Effort = z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
export type Effort = z.infer<typeof Effort>;

// Invocation_options must be JSON-safe. A
// z.record(z.unknown()) boundary admits functions, Dates, symbols, and
// `undefined` — none of which can be authored in YAML/TOML/JSON or survive
// event-log serialization. `JsonValue` is the recursive predicate; the
// refinement rejects anything else. The extra `Number.isFinite` check
// rejects NaN/Infinity, which JSON.stringify silently turns into null.
type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
const JsonPrimitive = z.union([
  z.null(),
  z.boolean(),
  z.number().refine((n) => Number.isFinite(n), {
    message: 'invocation_options: non-finite numbers (NaN/Infinity) are not JSON-safe',
  }),
  z.string(),
]);
const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitive, z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)]),
);
const JsonObject = z.record(z.string(), JsonValueSchema);
export type JsonObject = z.infer<typeof JsonObject>;

// Skill arrays enforce uniqueness. Set-algebra
// composition (union, difference) at the resolver layer expects the inputs
// to be sets; accepting duplicates at parse time let a typo in an author's
// YAML silently produce `['tdd', 'tdd']` and masked the intent. Canonical
// *order* of the composed resolver output is a Phase 2 property.
const UniqueSkillArray = z.array(SkillId).refine(
  (arr) => new Set(arr).size === arr.length,
  (arr) => ({
    message: `skills array contains duplicates: ${[...new Set(arr.filter((s, i) => arr.indexOf(s) !== i))].join(', ')}`,
  }),
);

// SEL-I3 — typed skill operations, no empty-array ambiguity. `inherit` is
// a pure sentinel; the other three carry an explicit `skills: SkillId[]`.
// Empty arrays under non-`inherit` modes are legal and mean what they say:
// replace:[] clears the set; append:[] and remove:[] are no-ops.
export const SkillOverride = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('inherit') }).strict(),
  z.object({ mode: z.literal('replace'), skills: UniqueSkillArray }).strict(),
  z.object({ mode: z.literal('append'), skills: UniqueSkillArray }).strict(),
  z.object({ mode: z.literal('remove'), skills: UniqueSkillArray }).strict(),
]);
export type SkillOverride = z.infer<typeof SkillOverride>;

// SEL-I2 — every field optional; `.strict()` rejects surplus keys (typos
// that would otherwise silently leave the effective selection at the prior
// layer's default). `invocation_options` is JSON-safe; its
// merge semantics (right-biased by precedence) are a Phase 2 property.
export const SelectionOverride = z
  .object({
    model: ProviderScopedModel.optional(),
    effort: Effort.optional(),
    skills: SkillOverride.default({ mode: 'inherit' }),
    rigor: Rigor.optional(),
    invocation_options: JsonObject.default({}),
  })
  .strict();
export type SelectionOverride = z.infer<typeof SelectionOverride>;

// SEL-I5 — resolved is the effective record at dispatch time.
// `invocation_options` is included because it IS effective-state
// data — adapters consume it, and omitting it from the resolved surface
// makes `DispatchStartedEvent.resolved_selection` insufficient for audit or
// replay. The resolver flattens `applied[].override.invocation_options` via
// right-biased merge by precedence. What ResolvedSelection still does NOT
// carry is `SkillOverride` — the resolver flattens the override chain into
// a final unique `SkillId[]`.
export const ResolvedSelection = z
  .object({
    model: ProviderScopedModel.optional(),
    effort: Effort.optional(),
    skills: UniqueSkillArray,
    rigor: Rigor.optional(),
    invocation_options: JsonObject.default({}),
  })
  .strict();
export type ResolvedSelection = z.infer<typeof ResolvedSelection>;

export const SelectionSource = z.enum([
  'default',
  'user-global',
  'project',
  'workflow',
  'phase',
  'step',
  'invocation',
]);
export type SelectionSource = z.infer<typeof SelectionSource>;

// SEL-I1 — precedence is declared, closed, and compile-time pinned to the
// `SelectionSource` enum. The `as const satisfies readonly SelectionSource[]`
// makes drift between the enum and the precedence list a `tsc --strict`
// error — if a source is added to the enum without being added here (or
// vice versa), the build fails before the runtime ever sees it.
export const SELECTION_PRECEDENCE = [
  'default',
  'user-global',
  'project',
  'workflow',
  'phase',
  'step',
  'invocation',
] as const satisfies readonly SelectionSource[];

// Compile-time bidirectional equality: `SelectionSource` and the
// tuple-derived element type must be the same string-literal set. If one
// drifts, `_SelectionSourcePrecedenceParity` collapses to `never` and the
// build fails. This is the static form of SEL-I1; the runtime
// `selection.prop.precedence_const_parity` property is Phase 2
// defense-in-depth.
type _IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _PrecedenceSource = (typeof SELECTION_PRECEDENCE)[number];
type _SelectionSourcePrecedenceParity = _IsExact<SelectionSource, _PrecedenceSource> extends true
  ? true
  : never;
export const _compileTimeSelectionSourceParity: _SelectionSourcePrecedenceParity = true;

// Precedence-index lookup used by SEL-I6.
const PRECEDENCE_INDEX: Record<SelectionSource, number> = Object.fromEntries(
  SELECTION_PRECEDENCE.map((s, i) => [s, i]),
) as Record<SelectionSource, number>;

// Applied[] entries are a discriminated union on `source`. The `phase` and
// `step` variants carry a required disambiguator (`phase_id`, `step_id`).
// The five singleton-identified variants (default, user-global, project,
// workflow, invocation) do not, because a Run has at most one contribution
// from each.
//
// The disambiguators ensure provenance is independently auditable: reading
// an `applied` entry with `source: 'phase'` now names the exact phase. Two
// `phase` entries are permitted when a step legally belongs to multiple
// phases (the `every_step_has_a_phase` property is deferred to Phase 2 at
// phase.md, so overlapping phases is permitted at v0.1 and the trace must
// be able to represent them).
const AppliedEntry = z.discriminatedUnion('source', [
  z.object({ source: z.literal('default'), override: SelectionOverride }).strict(),
  z.object({ source: z.literal('user-global'), override: SelectionOverride }).strict(),
  z.object({ source: z.literal('project'), override: SelectionOverride }).strict(),
  z.object({ source: z.literal('workflow'), override: SelectionOverride }).strict(),
  z
    .object({
      source: z.literal('phase'),
      phase_id: PhaseId,
      override: SelectionOverride,
    })
    .strict(),
  z.object({ source: z.literal('step'), step_id: StepId, override: SelectionOverride }).strict(),
  z.object({ source: z.literal('invocation'), override: SelectionOverride }).strict(),
]);
export type AppliedEntry = z.infer<typeof AppliedEntry>;

// Ghost provenance rejection. An override is
// "empty" iff every field is at its schema default: no model, no effort,
// no rigor, skills in `inherit` mode, invocation_options empty. Applied
// entries whose override is empty fabricate provenance for a non-
// contributing layer and are rejected. This is the v0.1 schema-level
// complement to the reducer-level binding check (Phase 2
// property `selection.prop.resolved_matches_applied_composition`).
function overrideContributes(o: SelectionOverride): boolean {
  if (o.model !== undefined) return true;
  if (o.effort !== undefined) return true;
  if (o.rigor !== undefined) return true;
  if (o.skills.mode !== 'inherit') return true;
  if (Object.keys(o.invocation_options).length > 0) return true;
  return false;
}

const SelectionResolutionBody = z
  .object({
    resolved: ResolvedSelection,
    applied: z.array(AppliedEntry),
  })
  .strict();

const issueAt = (ctx: z.RefinementCtx, path: (string | number)[], message: string) => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
};

// SEL-I6 + SEL-I7 + ghost-provenance enforcement on the applied chain. Walk
// once:
//   - SEL-I6: each source must have a precedence index > the previous for
//     category changes. Equal index is tolerated when disambiguator
//     distinguishes the entries (two phase entries are legal).
//   - SEL-I7: no identity (source + disambiguator) appears twice. For
//     singleton sources (default, user-global, project, workflow,
//     invocation), identity is the source alone. For plural sources
//     (phase, step), identity is `{source, phase_id}` / `{source,
//     step_id}`.
//   - Ghost-provenance: every entry's override must contribute — no entry
//     that re-asserts the prior chain's resolved value.
function identityKey(entry: AppliedEntry): string {
  switch (entry.source) {
    case 'phase':
      return `phase:${entry.phase_id as unknown as string}`;
    case 'step':
      return `step:${entry.step_id as unknown as string}`;
    default:
      return entry.source;
  }
}

export const SelectionResolution = SelectionResolutionBody.superRefine((res, ctx) => {
  const seen = new Set<string>();
  let lastIndex = -1;
  for (let i = 0; i < res.applied.length; i++) {
    const entry = res.applied[i];
    if (entry === undefined) continue;
    const key = identityKey(entry);
    if (seen.has(key)) {
      issueAt(
        ctx,
        ['applied', i, 'source'],
        `duplicate applied identity '${key}' at index ${i}; each identity may contribute at most once (phase/step are disambiguated by their id)`,
      );
      continue;
    }
    seen.add(key);
    const idx = PRECEDENCE_INDEX[entry.source];
    if (idx < lastIndex) {
      issueAt(
        ctx,
        ['applied', i, 'source'],
        `applied entry '${entry.source}' at index ${i} is out of precedence order; entries must appear in SELECTION_PRECEDENCE order (default < user-global < project < workflow < phase < step < invocation). Two entries with equal precedence (two phases, two steps) are legal and must appear contiguously; a later category cannot precede an earlier one.`,
      );
    } else {
      lastIndex = idx;
    }
    if (!overrideContributes(entry.override)) {
      issueAt(
        ctx,
        ['applied', i, 'override'],
        `applied entry at index ${i} has an empty override (no model, effort, rigor, skills operation, or invocation_options); a layer that contributes nothing must NOT appear in the applied chain (ghost provenance)`,
      );
    }
  }
});
export type SelectionResolution = z.infer<typeof SelectionResolution>;
