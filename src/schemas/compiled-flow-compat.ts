function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeCompiledFlowCompatibility(raw: unknown): unknown {
  if (!isObject(raw) || !Array.isArray(raw.steps)) return raw;

  let changed = false;
  const steps = raw.steps.map((step) => {
    if (!isObject(step)) return step;
    if (step.kind !== 'checkpoint') return step;
    if (!isObject(step.policy)) return step;
    if (!Object.hasOwn(step.policy, 'build_brief')) return step;
    if (Object.hasOwn(step.policy, 'report_template')) return step;
    if (!isObject(step.writes)) return step;
    if (!isObject(step.writes.report)) return step;
    if (step.writes.report.schema !== 'build.brief@v1') return step;

    const { build_brief: buildBrief, ...policyWithoutBuildBrief } = step.policy;
    const policy: Record<string, unknown> = {
      ...policyWithoutBuildBrief,
      report_template: buildBrief,
    };
    changed = true;
    return { ...step, policy };
  });

  if (!changed) return raw;
  return { ...raw, steps };
}
