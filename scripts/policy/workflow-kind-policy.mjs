// Slice 43a — validateWorkflowKindPolicy helper extraction (HIGH 5
// retargeting per Slice 40, landed at P2.5 per plan §Slice 40
// Retargeting note).
//
// This module is the single source of truth for workflow-kind canonical
// phase-set policy. Two surfaces consume it:
//   (1) scripts/audit.mjs Check 24 (checkSpineCoverage) — audit-level;
//       receives raw JSON from .claude-plugin/skills/<kind>/circuit.json
//       and checks canonical-phase-set + omits invariants against this
//       module's WORKFLOW_KIND_CANONICAL_SETS table.
//   (2) src/runtime/policy/workflow-kind-policy.ts — runtime-level;
//       receives a Workflow.safeParse'd object and runs the same check
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
// The canonical-phase-set table itself is identical in both surfaces —
// defining it once here prevents drift.

/**
 * @typedef {Object} WorkflowKindPolicyEntry
 * @property {string[]} canonicals
 * @property {string[]} omits
 * @property {string} title
 * @property {string} authority
 */

/** @type {Record<string, WorkflowKindPolicyEntry>} */
export const WORKFLOW_KIND_CANONICAL_SETS = {
  explore: {
    canonicals: ['frame', 'analyze', 'act', 'review', 'close'],
    omits: ['plan', 'verify'],
    title: 'Frame → Analyze → Synthesize → Review → Close',
    authority: 'specs/contracts/explore.md §Canonical phase set',
  },
};

/**
 * Workflow IDs explicitly exempt from kind-canonical enforcement.
 * dogfood-run-0 is the Phase 1.5 Alpha Proof partial-spine fixture
 * (spine_policy.omits intentionally covers 5 of 7 canonicals).
 * @type {Set<string>}
 */
export const EXEMPT_WORKFLOW_IDS = new Set(['dogfood-run-0']);

/**
 * Audit-level canonical-phase-set check. Input is a raw fixture object
 * (already JSON-parsed). Does NOT run Workflow.safeParse — Zod lives on
 * the TS side; this function is deliberately Zod-free so it is callable
 * from audit.mjs. The runtime-level helper at
 * src/runtime/policy/workflow-kind-policy.ts adds the safeParse wrapper.
 *
 * Returns a discriminated result:
 *   - { kind: 'green', detail } — fixture passes canonical-phase-set
 *     policy for its declared workflow kind.
 *   - { kind: 'exempt', detail } — fixture's id is in
 *     EXEMPT_WORKFLOW_IDS (information-only pass-through).
 *   - { kind: 'pass_through', detail } — fixture's id is not a known
 *     workflow kind (unknown → pass-through, not red; future kinds
 *     author their own entry).
 *   - { kind: 'red', detail } — fixture violates canonical-phase-set
 *     policy for a known workflow kind.
 *
 * @param {unknown} fixture
 * @returns {{ kind: 'green' | 'exempt' | 'pass_through' | 'red', detail: string }}
 */
export function checkWorkflowKindCanonicalPolicy(fixture) {
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

  if (EXEMPT_WORKFLOW_IDS.has(id)) {
    return {
      kind: 'exempt',
      detail: `${id}: exempt from kind-canonical enforcement (partial-spine, recorded)`,
    };
  }

  const expected = WORKFLOW_KIND_CANONICAL_SETS[id];
  if (expected === undefined) {
    return {
      kind: 'pass_through',
      detail: `${id}: no canonical-set entry (unknown workflow kind; pass-through)`,
    };
  }

  // Extract declared canonical set from phases (ignoring undefined canonicals).
  const declared = new Set();
  const phases = Array.isArray(f.phases) ? f.phases : [];
  for (const phase of phases) {
    if (phase !== null && typeof phase === 'object' && typeof phase.canonical === 'string') {
      declared.add(phase.canonical);
    }
  }
  const expectedSet = new Set(expected.canonicals);

  const missing = [...expectedSet].filter((c) => !declared.has(c));
  const extra = [...declared].filter((c) => !expectedSet.has(c));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`missing canonical(s): ${missing.join(', ')}`);
    if (extra.length > 0) parts.push(`unexpected canonical(s): ${extra.join(', ')}`);
    return {
      kind: 'red',
      detail: `${id}: canonical phase-set mismatch — ${parts.join('; ')} (authority: ${expected.authority})`,
    };
  }

  // Validate spine_policy shape + omits list.
  const sp = f.spine_policy;
  if (sp === null || typeof sp !== 'object') {
    return {
      kind: 'red',
      detail: `${id}: spine_policy missing or not an object`,
    };
  }
  const spObj = /** @type {Record<string, unknown>} */ (sp);
  if (spObj.mode !== 'partial') {
    return {
      kind: 'red',
      detail: `${id}: spine_policy.mode must be 'partial' for kind-canonical enforcement; got '${String(spObj.mode)}'`,
    };
  }
  const omits = Array.isArray(spObj.omits) ? spObj.omits.filter((s) => typeof s === 'string') : [];
  const expectedOmits = new Set(expected.omits);
  const missingOmits = [...expectedOmits].filter((o) => !omits.includes(o));
  const extraOmits = omits.filter((o) => !expectedOmits.has(o));
  if (missingOmits.length > 0 || extraOmits.length > 0) {
    const parts = [];
    if (missingOmits.length > 0) parts.push(`missing omit(s): ${missingOmits.join(', ')}`);
    if (extraOmits.length > 0) parts.push(`unexpected omit(s): ${extraOmits.join(', ')}`);
    return {
      kind: 'red',
      detail: `${id}: spine_policy.omits mismatch — ${parts.join('; ')} (authority: ${expected.authority})`,
    };
  }

  return {
    kind: 'green',
    detail: `${id}: canonical set {${expected.canonicals.join(', ')}} + omits {${expected.omits.join(', ')}} enforced (authority: ${expected.authority})`,
  };
}
