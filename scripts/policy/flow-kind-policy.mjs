// Single source of truth for flow-kind canonical stage-set policy.
//
// Consumed by src/runtime/policy/flow-kind-policy.ts, which wraps these
// checks with Zod-driven CompiledFlow.safeParse so the CLI fixture
// loader can reject structurally- or policy-invalid fixtures with one
// call.
//
// Why this is .mjs (not .ts): historically a JS-only audit script also
// consumed the canonical-set table, so the table was defined here. The
// audit script is gone, but keeping the table in one place prevents
// drift if a second consumer reappears.

/**
 * @typedef {Object} CompiledFlowKindPolicyEntry
 * @property {string[]} canonicals
 * @property {string[]} omits
 * @property {string[]} optional_canonicals
 *   Canonicals that may be either declared or omitted by per-mode variants.
 *   When declared, they must NOT appear in stage_path_policy.omits. When absent
 *   from declared stages, they MUST appear in stage_path_policy.omits.
 *   Empty array for flow ids whose every canonical is mandatory.
 * @property {{ canonicals: string[], omits: string[], title: string }[]} variants
 *   Complete alternate canonical policies for per-mode fixtures whose graph is
 *   intentionally not the default graph.
 * @property {string} title
 * @property {string} authority
 */

/** @type {Record<string, CompiledFlowKindPolicyEntry>} */
export const FLOW_KIND_CANONICAL_SETS = {
  explore: {
    canonicals: ['frame', 'analyze', 'plan', 'close'],
    omits: ['act', 'verify', 'review'],
    optional_canonicals: [],
    variants: [],
    title: 'Frame → Analyze → Plan or Decision → Close',
    authority: 'src/flows/explore/contract.md §Canonical stage set',
  },
  review: {
    canonicals: ['frame', 'analyze', 'close'],
    omits: ['plan', 'act', 'verify', 'review'],
    optional_canonicals: [],
    variants: [],
    title: 'Intake → Independent Audit → Verdict',
    authority: 'specs/plans/p2-9-second-flow.md §3',
  },
  build: {
    canonicals: ['frame', 'plan', 'act', 'verify', 'review', 'close'],
    omits: ['analyze'],
    optional_canonicals: [],
    variants: [],
    title: 'Frame → Plan → Act → Verify → Review → Close',
    authority: 'specs/plans/build-flow-parity.md §9 Work item 1',
  },
  fix: {
    canonicals: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
    omits: ['plan'],
    optional_canonicals: ['review'],
    variants: [],
    title: 'Frame → Diagnose → Fix → Verify → Review → Close',
    authority: 'specs/adrs/ADR-0013-scalar-backed-flow-schematics.md §Decision',
  },
};

/**
 * CompiledFlow IDs exempt from kind-canonical enforcement. `runtime-proof`
 * is the partial-stage-path fixture used by the runtime test harness;
 * its `stage_path_policy.omits` intentionally covers 5 of 7 canonicals.
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

function declaredCanonicalsFor(fixture) {
  const declared = new Set();
  const stages = Array.isArray(fixture.stages) ? fixture.stages : [];
  for (const stage of stages) {
    if (stage !== null && typeof stage === 'object' && typeof stage.canonical === 'string') {
      declared.add(stage.canonical);
    }
  }
  return declared;
}

function checkCanonicalStagePolicyVariant(id, fixture, variant, optionalCanonicals, authority) {
  const declared = declaredCanonicalsFor(fixture);
  const optional = new Set(optionalCanonicals);
  const required = new Set(variant.canonicals.filter((c) => !optional.has(c)));
  const acceptedDeclared = new Set([...required, ...optional]);
  const missing = [...required].filter((c) => !declared.has(c));
  const extra = [...declared].filter((c) => !acceptedDeclared.has(c));
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`missing canonical(s): ${missing.join(', ')}`);
    if (extra.length > 0) parts.push(`unexpected canonical(s): ${extra.join(', ')}`);
    return {
      ok: false,
      detail: `${id}: canonical stage-set mismatch — ${parts.join('; ')} (authority: ${authority})`,
    };
  }

  const sp = fixture.stage_path_policy;
  if (sp === null || typeof sp !== 'object') {
    return {
      ok: false,
      detail: `${id}: stage_path_policy missing or not an object`,
    };
  }
  const spObj = /** @type {Record<string, unknown>} */ (sp);
  if (spObj.mode !== 'partial') {
    return {
      ok: false,
      detail: `${id}: stage_path_policy.mode must be 'partial' for kind-canonical enforcement; got '${String(spObj.mode)}'`,
    };
  }
  const omits = Array.isArray(spObj.omits) ? spObj.omits.filter((s) => typeof s === 'string') : [];
  const optionalOmitted = [...optional].filter((c) => !declared.has(c));
  const expectedOmits = new Set([...variant.omits, ...optionalOmitted]);
  const missingOmits = [...expectedOmits].filter((o) => !omits.includes(o));
  const extraOmits = omits.filter((o) => !expectedOmits.has(o));
  if (missingOmits.length > 0 || extraOmits.length > 0) {
    const parts = [];
    if (missingOmits.length > 0) parts.push(`missing omit(s): ${missingOmits.join(', ')}`);
    if (extraOmits.length > 0) parts.push(`unexpected omit(s): ${extraOmits.join(', ')}`);
    return {
      ok: false,
      detail: `${id}: stage_path_policy.omits mismatch — ${parts.join('; ')} (authority: ${authority})`,
    };
  }

  return {
    ok: true,
    detail: `${id}: canonical set {${variant.canonicals.join(', ')}} + omits {${variant.omits.join(', ')}} enforced (authority: ${authority})`,
  };
}

/**
 * Structural ordering check for review flows: the close-stage `review.result`
 * report writer must be preceded in steps[] by an analyze-stage relay step
 * with role=reviewer. Enforces reviewer/result separation: the writer
 * cannot run without a prior reviewer relay producing the verdict.
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
        'analyze stage must contain a relay step with role=reviewer before the close report writer',
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
        'close stage must contain a compose step that writes the primary review.result report',
    };
  }

  const everyCloseWriterPreceded = closeWriterIndices.every((closeIndex) =>
    reviewerRelayIndices.some((reviewerIndex) => reviewerIndex < closeIndex),
  );
  if (!everyCloseWriterPreceded) {
    return {
      ok: false,
      detail:
        'each close-stage review.result report writer must be preceded in steps[] by an analyze-stage reviewer relay',
    };
  }

  return {
    ok: true,
    detail: 'close review.result report writer is preceded by an analyze-stage reviewer relay',
  };
}

/**
 * Canonical-stage-set check. Input is a raw fixture object (already
 * JSON-parsed). Does not run CompiledFlow.safeParse — that wrapper lives
 * in src/runtime/policy/flow-kind-policy.ts so this stays Zod-free and
 * callable from non-TS contexts.
 *
 * Returns a discriminated result:
 *   - 'green' — fixture passes canonical-stage-set policy.
 *   - 'exempt' — fixture id is in EXEMPT_FLOW_IDS.
 *   - 'pass_through' — fixture id has no canonical-set entry (unknown
 *     flow kinds pass through rather than fail; new kinds author their
 *     own entry).
 *   - 'red' — fixture violates canonical-stage-set policy for a known kind.
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

  const variants = [
    { canonicals: expected.canonicals, omits: expected.omits, title: expected.title },
    ...(expected.variants ?? []),
  ];
  const checkedVariants = variants.map((variant) =>
    checkCanonicalStagePolicyVariant(
      id,
      f,
      variant,
      expected.optional_canonicals,
      expected.authority,
    ),
  );
  const acceptedVariant = checkedVariants.find((variant) => variant.ok);
  if (acceptedVariant === undefined) {
    return {
      kind: 'red',
      detail: checkedVariants.map((variant) => variant.detail).join(' OR '),
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
    detail: acceptedVariant.detail,
  };
}
