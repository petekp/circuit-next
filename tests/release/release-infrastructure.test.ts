import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import {
  compareParity,
  releaseBlockers,
  validateProofCoverage,
  validatePublicClaims,
} from '../../src/release/checks.js';
import {
  CurrentCapabilitySnapshot,
  OriginalCapabilitySnapshot,
  ParityExceptionLedger,
  ProofScenarioIndex,
  PublicClaimLedger,
} from '../../src/release/schemas.js';

const root = resolve(__dirname, '..', '..');

function yamlFile(path: string): unknown {
  return YAML.parse(readFileSync(resolve(root, path), 'utf8'));
}

function jsonFile(path: string): unknown {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as unknown;
}

function exists(path: string): boolean {
  return existsSync(resolve(root, path));
}

describe('release truth infrastructure', () => {
  it('parses authored release ledgers', () => {
    expect(() =>
      OriginalCapabilitySnapshot.parse(yamlFile('docs/release/parity/original-circuit.yaml')),
    ).not.toThrow();
    expect(() =>
      ParityExceptionLedger.parse(yamlFile('docs/release/parity/exceptions.yaml')),
    ).not.toThrow();
    expect(() =>
      PublicClaimLedger.parse(yamlFile('docs/release/claims/public-claims.yaml')),
    ).not.toThrow();
    expect(() =>
      ProofScenarioIndex.parse(yamlFile('docs/release/proofs/index.yaml')),
    ).not.toThrow();
  });

  it('validates the generated current capability snapshot', () => {
    const snapshot = CurrentCapabilitySnapshot.parse(
      jsonFile('generated/release/current-capabilities.json'),
    );
    expect(snapshot.capabilities.length).toBeGreaterThan(30);
    expect(snapshot.flows.map((flow) => flow.id).sort()).toContain('build');
    expect(snapshot.connectors.map((connector) => connector.id).sort()).toContain('custom');
  });

  it('records canonical flow stages from circuit.json when mode files are present', () => {
    expect(exists('generated/flows/fix/lite.json')).toBe(true);
    const snapshot = CurrentCapabilitySnapshot.parse(
      jsonFile('generated/release/current-capabilities.json'),
    );
    const fix = snapshot.flows.find((flow) => flow.id === 'fix');
    const canonical = jsonFile('generated/flows/fix/circuit.json') as {
      readonly stages?: readonly { readonly canonical?: string; readonly id: string }[];
    };
    const expectedStages =
      canonical.stages?.map((stage) => stage.canonical ?? stage.id).filter(Boolean) ?? [];

    expect(fix?.stages).toEqual(expectedStages);
  });

  it('records implemented router intent hints on flow capability axes', () => {
    const snapshot = CurrentCapabilitySnapshot.parse(
      jsonFile('generated/release/current-capabilities.json'),
    );
    const capabilities = new Map(
      snapshot.capabilities.map((capability) => [capability.id, capability]),
    );

    expect(capabilities.get('flow:build')?.axes.intent_hints).toEqual(['develop:']);
    expect(capabilities.get('flow:fix')?.axes.intent_hints).toEqual(['fix:']);
    expect(capabilities.get('flow:migrate')?.axes.intent_hints).toEqual(['migrate:']);
    expect(capabilities.get('flow:sweep')?.axes.intent_hints).toEqual(['cleanup:', 'overnight:']);
    expect(capabilities.get('flow:explore')?.axes.intent_hints).toEqual(['decide:']);
    expect(capabilities.get('flow:explore')?.axes.stage_path).toContain('Plan or Decision');
    expect(capabilities.get('flow:explore')?.axes.outputs).toEqual(
      expect.arrayContaining([
        'explore.brief@v1',
        'explore.analysis@v1',
        'explore.decision-options@v1',
        'explore.tournament-aggregate@v1',
        'explore.tournament-proposal@v1',
        'explore.tournament-review@v1',
        'explore.decision@v1',
        'explore.result@v1',
      ]),
    );
  });

  it('route inventory exposes rich route gaps', () => {
    const snapshot = CurrentCapabilitySnapshot.parse(
      jsonFile('generated/release/current-capabilities.json'),
    );
    const unsupported = new Set(snapshot.flows.flatMap((flow) => flow.unsupported_route_outcomes));
    for (const route of ['retry', 'revise', 'stop', 'ask', 'handoff', 'escalate']) {
      expect(unsupported.has(route), route).toBe(true);
    }
    const richRoute = snapshot.capabilities.find(
      (capability) => capability.id === 'route-outcomes:rich',
    );
    expect(richRoute?.status).toBe('partial');
  });

  it('parity comparison passes only because gaps are tracked', () => {
    const original = OriginalCapabilitySnapshot.parse(
      yamlFile('docs/release/parity/original-circuit.yaml'),
    );
    const current = CurrentCapabilitySnapshot.parse(
      jsonFile('generated/release/current-capabilities.json'),
    );
    const exceptions = ParityExceptionLedger.parse(yamlFile('docs/release/parity/exceptions.yaml'));
    const result = compareParity({ original, current, exceptions });
    expect(result.issues).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('parity comparison rejects implemented names that lack behavioral axes', () => {
    const original = OriginalCapabilitySnapshot.parse({
      schema_version: 1,
      sources: [{ id: 'legacy', path: '/tmp/legacy.md', note: 'fixture' }],
      capabilities: [
        {
          id: 'flow:fixture',
          kind: 'flow',
          title: 'Fixture',
          summary: 'Fixture flow',
          axes: {
            modes: ['default'],
            stage_path: ['Frame', 'Close'],
            checkpoint: 'Pauses for risky decisions.',
          },
          source_refs: ['legacy'],
        },
      ],
    });
    const current = CurrentCapabilitySnapshot.parse({
      schema_version: 1,
      generated_by: 'test',
      flows: [],
      router_intents: [],
      commands: { root: [], codex_plugin: [], claude_plugin_skills: [] },
      connectors: [],
      hosts: [],
      capabilities: [
        {
          id: 'flow:fixture',
          kind: 'flow',
          title: 'Fixture',
          status: 'implemented',
          summary: 'Fixture flow exists',
          axes: {
            modes: ['default', 'lite'],
            stage_path: ['frame', 'close'],
          },
        },
      ],
    });
    const exceptions = ParityExceptionLedger.parse({ schema_version: 1, exceptions: [] });
    const result = compareParity({ original, current, exceptions });
    expect(result.issues).toContainEqual(
      expect.stringContaining('untracked behavioral parity gap: flow:fixture'),
    );
    expect(result.issues).toContainEqual(expect.stringContaining('modes extra lite'));
    expect(result.issues).toContainEqual(
      expect.stringContaining('checkpoint missing current value'),
    );
  });

  it('claim checks reject unsupported current claims', () => {
    const current = CurrentCapabilitySnapshot.parse(
      jsonFile('generated/release/current-capabilities.json'),
    );
    const proofs = ProofScenarioIndex.parse(yamlFile('docs/release/proofs/index.yaml'));
    const exceptions = ParityExceptionLedger.parse(yamlFile('docs/release/parity/exceptions.yaml'));
    const claims = PublicClaimLedger.parse({
      schema_version: 1,
      claims: [
        {
          id: 'CLAIM-BOGUS',
          claim: 'Bogus current claim',
          type: 'flow',
          status: 'verified_current',
          surfaces: ['README.md'],
          backing: { capability_ids: ['flow:not-real'] },
          user_risk: 'Would mislead users.',
        },
      ],
    });
    const result = validatePublicClaims({
      claims,
      current,
      proofs,
      exceptions,
      pathExists: exists,
    });
    expect(result.issues).toEqual([
      'claim CLAIM-BOGUS references unsupported capability: flow:not-real',
    ]);
  });

  it('claim checks reject partially backed current claims', () => {
    const current = CurrentCapabilitySnapshot.parse(
      jsonFile('generated/release/current-capabilities.json'),
    );
    const proofs = ProofScenarioIndex.parse(yamlFile('docs/release/proofs/index.yaml'));
    const exceptions = ParityExceptionLedger.parse(yamlFile('docs/release/parity/exceptions.yaml'));
    const claims = PublicClaimLedger.parse({
      schema_version: 1,
      claims: [
        {
          id: 'CLAIM-PARTIAL',
          claim: 'Build and a missing flow are both current',
          type: 'flow',
          status: 'verified_current',
          surfaces: ['README.md'],
          backing: { capability_ids: ['flow:build', 'flow:not-real'] },
          user_risk: 'Would certify a multi-part claim with partial evidence.',
        },
      ],
    });
    const result = validatePublicClaims({
      claims,
      current,
      proofs,
      exceptions,
      pathExists: exists,
    });

    expect(result.issues).toEqual([
      'claim CLAIM-PARTIAL references unsupported capability: flow:not-real',
    ]);
  });

  it('claim checks do not accept unchecked script names as backing', () => {
    const current = CurrentCapabilitySnapshot.parse(
      jsonFile('generated/release/current-capabilities.json'),
    );
    const proofs = ProofScenarioIndex.parse(yamlFile('docs/release/proofs/index.yaml'));
    const exceptions = ParityExceptionLedger.parse(yamlFile('docs/release/parity/exceptions.yaml'));
    const claims = PublicClaimLedger.parse({
      schema_version: 1,
      claims: [
        {
          id: 'CLAIM-BOGUS-SCRIPT',
          claim: 'Bogus script-backed claim',
          type: 'docs',
          status: 'verified_current',
          surfaces: ['README.md'],
          backing: { script_checks: ['definitely-not-a-real-check --check'] },
          user_risk: 'Would let prose bypass release truth checks.',
        },
      ],
    });
    const result = validatePublicClaims({
      claims,
      current,
      proofs,
      exceptions,
      pathExists: exists,
    });
    expect(result.issues).toEqual([
      'claim CLAIM-BOGUS-SCRIPT references unavailable script check: definitely-not-a-real-check --check',
    ]);
  });

  it('proof coverage is complete as a tracked blocker set', () => {
    const proofs = ProofScenarioIndex.parse(yamlFile('docs/release/proofs/index.yaml'));
    const exceptions = ParityExceptionLedger.parse(yamlFile('docs/release/parity/exceptions.yaml'));
    const result = validateProofCoverage({ proofs, exceptions, pathExists: exists });
    expect(result.issues).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('planned proof scenarios still block release readiness', () => {
    const proofs = ProofScenarioIndex.parse({
      schema_version: 1,
      scenarios: [
        {
          id: 'proof:planned',
          title: 'Planned Proof',
          category: 'doing-work',
          command: 'circuit planned',
          expected_outcome: 'complete',
          summary_contract: 'Shows the result.',
          redaction_policy: 'No private data.',
          required_files: [],
          status: 'planned',
          exception_ids: ['EX-PLANNED-PROOF'],
        },
      ],
    });
    const exceptions = ParityExceptionLedger.parse({
      schema_version: 1,
      exceptions: [
        {
          id: 'EX-PLANNED-PROOF',
          proof_id: 'proof:planned',
          status: 'approved_exception',
          readiness_ref: 'REL-011',
          rationale: 'Fixture exception',
        },
      ],
    });
    const claims = PublicClaimLedger.parse({ schema_version: 1, claims: [] });
    const coverage = validateProofCoverage({ proofs, exceptions, pathExists: exists });
    expect(coverage.issues).toEqual([
      'proof category has no scenario: deciding',
      'proof category has no scenario: maintenance',
      'proof category has no scenario: continuity',
      'proof category has no scenario: customization',
      'proof category has no scenario: first-run',
      'proof category has no scenario: failure',
      'proof category has no scenario: plan-execution',
    ]);
    expect(releaseBlockers({ exceptions, claims, proofs })).toContain(
      'proof:planned: proof scenario is not captured',
    );
  });
});
