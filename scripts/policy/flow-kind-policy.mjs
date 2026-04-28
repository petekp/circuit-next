// Slice 43a — validateCompiledFlowKindPolicy helper extraction (HIGH 5
// retargeting per Slice 40, landed at P2.5 per plan §Slice 40
// Retargeting note).
//
// This module is the single source of truth for flow-kind canonical
// stage-set policy. Two surfaces consume it:
//   (1) scripts/audit.mjs Check 24 (checkSpineCoverage) — audit-level;
//       receives raw JSON from generated/flows/<kind>/circuit.json
//       and checks canonical-stage-set + omits invariants against this
//       module's FLOW_KIND_CANONICAL_SETS table.
//   (2) src/runtime/policy/flow-kind-policy.ts — runtime-level;
//       receives a CompiledFlow.safeParse'd object and runs the same check
//       post-schema-validation so the CLI fixture loader rejects
//       structurally-invalid or policy-invalid fixtures with a clear
//       diagnostic.
//
// The module is JS (.mjs) rather than TS because audit.mjs is pure
// Node ESM with no TS transpilation path; the TS layer at
// src/runtime/policy/ re-exports this module's constants and adds the
// Zod-driven safeParse wrapper.
//
// Why split the concerns: the audit-level check runs WITHOUT Zod (JS
// surface has no access to the schemas/ types); the runtime-level check
// runs WITH Zod so runtime errors carry Zod's structured issue detail.
// The canonical-stage-set table itself is identical in both surfaces —
// defining it once here prtrace_entrys drift.

/**
 * @typedef {Object} CompiledFlowKindPolicyEntry
 * @property {string[]} canonicals
 * @property {string[]} omits
 * @property {string[]} optional_canonicals
 *   Canonicals that may be either declared or omitted by per-mode variants.
 *   When declared, they must NOT appear in stage_path_policy.omits. When absent
 *   from declared stages, they MUST appear in stage_path_policy.omits.
 *   Empty array for flow ids whose every canonical is mandatory.
 * @property {string} title
 * @property {string} authority
 */

/** @type {Record<string, CompiledFlowKindPolicyEntry>} */
export const FLOW_KIND_CANONICAL_SETS = {
  explore: {
    canonicals: ['frame', 'analyze', 'act', 'review', 'close'],
    omits: ['plan', 'verify'],
    optional_canonicals: [],
    title: 'Frame → Analyze → Synthesize → Review → Close',
    authority: 'src/flows/explore/contract.md §Canonical stage set',
  },
  review: {
    canonicals: ['frame', 'analyze', 'close'],
    omits: ['plan', 'act', 'verify', 'review'],
    optional_canonicals: [],
    title: 'Intake → Independent Audit → Verdict',
    authority: 'specs/plans/p2-9-second-flow.md §3',
  },
  build: {
    canonicals: ['frame', 'plan', 'act', 'verify', 'review', 'close'],
    omits: ['analyze'],
    optional_canonicals: [],
    title: 'Frame → Plan → Act → Verify → Review → Close',
    authority: 'specs/plans/build-flow-parity.md §9 Work item 1',
  },
  fix: {
    canonicals: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
    omits: ['plan'],
    optional_canonicals: ['review'],
    title: 'Frame → Diagnose → Fix → Verify → Review → Close',
    authority: 'specs/adrs/ADR-0013-scalar-backed-flow-schematics.md §Decision',
  },
};

/**
 * CompiledFlow IDs explicitly exempt from kind-canonical enforcement.
 * runtime-proof is the Stage 1.5 Alpha Proof partial-stage path fixture
 * (stage_path_policy.omits intentionally covers 5 of 7 canonicals).
 * @type {Set<string>}
 */
export const EXEMPT_FLOW_IDS = new Set(['runtime-proof']);

function objectRecord(value) {
  return value !== null && typeof value === 'object'
    ? /** @type {Record<string, unknown>} */ (value)
    : undefined;
}

function stringStepIdsForCanonical(stages, canonical) {
  const ids = [];
  for (const stage of stages) {
    const p = objectRecord(stage);
    if (p === undefined || p.canonical !== canonical || !Array.isArray(p.steps)) continue;
    for (const id of p.steps) {
      if (typeof id === 'string') ids.push(id);
    }
  }
  return ids;
}

function isReviewResultReportWriter(step) {
  const s = objectRecord(step);
  if (s === undefined || s.kind !== 'compose') return false;
  const writes = objectRecord(s.writes);
  const report = objectRecord(writes?.report);
  return report?.schema === 'review.result@v1';
}

function isReviewerRelay(step) {
  const s = objectRecord(step);
  return s !== undefined && s.kind === 'relay' && s.role === 'reviewer';
}

/**
 * REVIEW-I1 structural ordering: the close-stage primary review.result
 * report writer must be preceded in steps[] by an analyze-stage relay
 * step with role=reviewer.
 *
 * @param {unknown} fixture
 * @returns {{ ok: true, detail: string } | { ok: false, detail: string }}
 */
export function checkReviewIdentitySeparationPolicy(fixture) {
  const f = objectRecord(fixture);
  if (f === undefined) {
    return { ok: false, detail: 'fixture is not an object' };
  }
  const stages = Array.isArray(f.stages) ? f.stages : [];
  const steps = Array.isArray(f.steps) ? f.steps : [];
  const analyzeStepIds = stringStepIdsForCanonical(stages, 'analyze');
  const closeStepIds = stringStepIdsForCanonical(stages, 'close');

  const stepsById = new Map();
  for (let index = 0; index < steps.length; index++) {
    const step = objectRecord(steps[index]);
    if (typeof step?.id === 'string') stepsById.set(step.id, { step, index });
  }

  const reviewerRelayIndices = analyzeStepIds
    .map((id) => stepsById.get(id))
    .filter((entry) => entry !== undefined && isReviewerRelay(entry.step))
    .map((entry) => entry.index);
  if (reviewerRelayIndices.length === 0) {
    return {
      ok: false,
      detail:
        'REVIEW-I1: analyze stage must contain a relay step with role=reviewer before the close report writer',
    };
  }

  const closeWriterIndices = closeStepIds
    .map((id) => stepsById.get(id))
    .filter((entry) => entry !== undefined && isReviewResultReportWriter(entry.step))
    .map((entry) => entry.index);
  if (closeWriterIndices.length === 0) {
    return {
      ok: false,
      detail:
        'REVIEW-I1: close stage must contain a compose step that writes the primary review.result report',
    };
  }

  const everyCloseWriterPreceded = closeWriterIndices.every((closeIndex) =>
    reviewerRelayIndices.some((reviewerIndex) => reviewerIndex < closeIndex),
  );
  if (!everyCloseWriterPreceded) {
    return {
      ok: false,
      detail:
        'REVIEW-I1: each close-stage review.result report writer must be preceded in steps[] by an analyze-stage reviewer relay',
    };
  }

  return {
    ok: true,
    detail:
      'REVIEW-I1: close review.result report writer is preceded by an analyze-stage reviewer relay',
  };
}

/**
 * Audit-level canonical-stage-set check. Input is a raw fixture object
 * (already JSON-parsed). Does NOT run CompiledFlow.safeParse — Zod lives on
 * the TS side; this function is deliberately Zod-free so it is callable
 * from audit.mjs. The runtime-level helper at
 * src/runtime/policy/flow-kind-policy.ts adds the safeParse wrapper.
 *
 * Returns a discriminated result:
 *   - { kind: 'green', detail } — fixture passes canonical-stage-set
 *     policy for its declared flow kind.
 *   - { kind: 'exempt', detail } — fixture's id is in
 *     EXEMPT_FLOW_IDS (information-only pass-through).
 *   - { kind: 'pass_through', detail } — fixture's id is not a known
 *     flow kind (unknown → pass-through, not red; future kinds
 *     author their own entry).
 *   - { kind: 'red', detail } — fixture violates canonical-stage-set
 *     policy for a known flow kind.
 *
 * @param {unknown} fixture
 * @returns {{ kind: 'green' | 'exempt' | 'pass_through' | 'red', detail: string }}
 */
export function checkCompiledFlowKindCanonicalPolicy(fixture) {
  if (fixture === null || typeof fixture !== 'object') {
    return {
      kind: 'red',
      detail: 'fixture is not an object',
    };
  }
  const f = /** @type {Record<string, unknown>} */ (fixture);
  const id = f.id;
  if (typeof id !== 'string') {
    return {
      kind: 'red',
      detail: 'fixture missing top-level `id` string field',
    };
  }

  if (EXEMPT_FLOW_IDS.has(id)) {
    return {
      kind: 'exempt',
      detail: `${id}: exempt from kind-canonical enforcement (partial-stage path, recorded)`,
    };
  }

  const expected = FLOW_KIND_CANONICAL_SETS[id];
  if (expected === undefined) {
    return {
      kind: 'pass_through',
      detail: `${id}: no canonical-set entry (unknown flow kind; pass-through)`,
    };
  }

  // Extract declared canonical set from stages (ignoring undefined canonicals).
  const declared = new Set();
  const stages = Array.isArray(f.stages) ? f.stages : [];
  for (const stage of stages) {
    if (stage !== null && typeof stage === 'object' && typeof stage.canonical === 'string') {
      declared.add(stage.canonical);
    }
  }
  const optionalCanonicals = new Set(expected.optional_canonicals);
  const requiredCanonicals = new Set(expected.canonicals.filter((c) => !optionalCanonicals.has(c)));
  const acceptedDeclared = new Set([...requiredCanonicals, ...optionalCanonicals]);

  const missing = [...requiredCanonicals].filter((c) => !declared.has(c));
  const extra = [...declared].filter((c) => !acceptedDeclared.has(c));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`missing canonical(s): ${missing.join(', ')}`);
    if (extra.length > 0) parts.push(`unexpected canonical(s): ${extra.join(', ')}`);
    return {
      kind: 'red',
      detail: `${id}: canonical stage-set mismatch — ${parts.join('; ')} (authority: ${expected.authority})`,
    };
  }

  // Validate stage_path_policy shape + omits list.
  const sp = f.stage_path_policy;
  if (sp === null || typeof sp !== 'object') {
    return {
      kind: 'red',
      detail: `${id}: stage_path_policy missing or not an object`,
    };
  }
  const spObj = /** @type {Record<string, unknown>} */ (sp);
  if (spObj.mode !== 'partial') {
    return {
      kind: 'red',
      detail: `${id}: stage_path_policy.mode must be 'partial' for kind-canonical enforcement; got '${String(spObj.mode)}'`,
    };
  }
  const omits = Array.isArray(spObj.omits) ? spObj.omits.filter((s) => typeof s === 'string') : [];
  // Required omits always belong in the omit list. Optional canonicals that the
  // variant chose NOT to declare also belong in the omit list (stage-I4 forces
  // every canonical to be either declared or omitted; the policy mirrors that).
  const optionalOmitted = [...optionalCanonicals].filter((c) => !declared.has(c));
  const expectedOmits = new Set([...expected.omits, ...optionalOmitted]);
  const missingOmits = [...expectedOmits].filter((o) => !omits.includes(o));
  const extraOmits = omits.filter((o) => !expectedOmits.has(o));
  if (missingOmits.length > 0 || extraOmits.length > 0) {
    const parts = [];
    if (missingOmits.length > 0) parts.push(`missing omit(s): ${missingOmits.join(', ')}`);
    if (extraOmits.length > 0) parts.push(`unexpected omit(s): ${extraOmits.join(', ')}`);
    return {
      kind: 'red',
      detail: `${id}: stage_path_policy.omits mismatch — ${parts.join('; ')} (authority: ${expected.authority})`,
    };
  }

  if (id === 'review') {
    const identitySeparation = checkReviewIdentitySeparationPolicy(f);
    if (!identitySeparation.ok) {
      return {
        kind: 'red',
        detail: `${id}: ${identitySeparation.detail} (authority: ${expected.authority})`,
      };
    }
  }

  return {
    kind: 'green',
    detail: `${id}: canonical set {${expected.canonicals.join(', ')}} + omits {${expected.omits.join(', ')}} enforced (authority: ${expected.authority})`,
  };
}
