import { describe, expect, it } from 'vitest';

import {
  discoverConfigLayers as runtimeDiscoverConfigLayers,
  projectConfigPath as runtimeProjectConfigPath,
  userGlobalConfigPath as runtimeUserGlobalConfigPath,
} from '../../src/runtime/config-loader.js';
import {
  readManifestSnapshot as runtimeReadManifestSnapshot,
  verifyManifestSnapshotBytes as runtimeVerifyManifestSnapshotBytes,
  writeManifestSnapshot as runtimeWriteManifestSnapshot,
} from '../../src/runtime/manifest-snapshot-writer.js';
import { writeOperatorSummary as runtimeWriteOperatorSummary } from '../../src/runtime/operator-summary-writer.js';
import {
  EXEMPT_FLOW_IDS as RUNTIME_EXEMPT_FLOW_IDS,
  FLOW_KIND_CANONICAL_SETS as RUNTIME_FLOW_KIND_CANONICAL_SETS,
  validateCompiledFlowKindPolicy as runtimeValidateCompiledFlowKindPolicy,
} from '../../src/runtime/policy/flow-kind-policy.js';
import {
  NO_VERDICT_SENTINEL as RUNTIME_NO_VERDICT_SENTINEL,
  composeRelayPrompt as runtimeComposeRelayPrompt,
  evaluateRelayCheck as runtimeEvaluateRelayCheck,
} from '../../src/runtime/relay-support.js';
import { resolveRunRelative as runtimeResolveRunRelative } from '../../src/runtime/run-relative-path.js';
import { resolveSelectionForRelay as runtimeResolveSelectionForRelay } from '../../src/runtime/selection-resolver.js';
import {
  WRITE_CAPABLE_WORKER_DISCLOSURE as RUNTIME_WRITE_CAPABLE_WORKER_DISCLOSURE,
  compiledFlowMayInvokeWriteCapableWorker as runtimeCompiledFlowMayInvokeWriteCapableWorker,
  flowMayInvokeWriteCapableWorker as runtimeFlowMayInvokeWriteCapableWorker,
} from '../../src/runtime/write-capable-worker-disclosure.js';
import {
  discoverConfigLayers,
  projectConfigPath,
  userGlobalConfigPath,
} from '../../src/shared/config-loader.js';
import {
  EXEMPT_FLOW_IDS,
  FLOW_KIND_CANONICAL_SETS,
  validateCompiledFlowKindPolicy,
} from '../../src/shared/flow-kind-policy.js';
import {
  readManifestSnapshot,
  verifyManifestSnapshotBytes,
  writeManifestSnapshot,
} from '../../src/shared/manifest-snapshot.js';
import { writeOperatorSummary } from '../../src/shared/operator-summary-writer.js';
import {
  NO_VERDICT_SENTINEL,
  composeRelayPrompt,
  evaluateRelayCheck,
} from '../../src/shared/relay-support.js';
import { resolveRunRelative } from '../../src/shared/run-relative-path.js';
import { resolveSelectionForRelay } from '../../src/shared/selection-resolver.js';
import {
  WRITE_CAPABLE_WORKER_DISCLOSURE,
  compiledFlowMayInvokeWriteCapableWorker,
  flowMayInvokeWriteCapableWorker,
} from '../../src/shared/write-capable-worker-disclosure.js';

describe('shared helper compatibility wrappers', () => {
  it('keeps config-loader old path pointed at shared ownership', () => {
    expect(runtimeDiscoverConfigLayers).toBe(discoverConfigLayers);
    expect(runtimeProjectConfigPath).toBe(projectConfigPath);
    expect(runtimeUserGlobalConfigPath).toBe(userGlobalConfigPath);
  });

  it('keeps manifest snapshot old path pointed at shared ownership', () => {
    expect(runtimeReadManifestSnapshot).toBe(readManifestSnapshot);
    expect(runtimeVerifyManifestSnapshotBytes).toBe(verifyManifestSnapshotBytes);
    expect(runtimeWriteManifestSnapshot).toBe(writeManifestSnapshot);
  });

  it('keeps operator summary old path pointed at shared ownership', () => {
    expect(runtimeWriteOperatorSummary).toBe(writeOperatorSummary);
  });

  it('keeps flow-kind policy old path pointed at shared ownership', () => {
    expect(RUNTIME_EXEMPT_FLOW_IDS).toBe(EXEMPT_FLOW_IDS);
    expect(RUNTIME_FLOW_KIND_CANONICAL_SETS).toBe(FLOW_KIND_CANONICAL_SETS);
    expect(runtimeValidateCompiledFlowKindPolicy).toBe(validateCompiledFlowKindPolicy);
  });

  it('keeps relay-support old path pointed at shared ownership', () => {
    expect(RUNTIME_NO_VERDICT_SENTINEL).toBe(NO_VERDICT_SENTINEL);
    expect(runtimeComposeRelayPrompt).toBe(composeRelayPrompt);
    expect(runtimeEvaluateRelayCheck).toBe(evaluateRelayCheck);
  });

  it('keeps run-relative path old path pointed at shared ownership', () => {
    expect(runtimeResolveRunRelative).toBe(resolveRunRelative);
  });

  it('keeps selection resolver old path pointed at shared ownership', () => {
    expect(runtimeResolveSelectionForRelay).toBe(resolveSelectionForRelay);
  });

  it('keeps write-capable disclosure old path pointed at shared ownership', () => {
    expect(RUNTIME_WRITE_CAPABLE_WORKER_DISCLOSURE).toBe(WRITE_CAPABLE_WORKER_DISCLOSURE);
    expect(runtimeCompiledFlowMayInvokeWriteCapableWorker).toBe(
      compiledFlowMayInvokeWriteCapableWorker,
    );
    expect(runtimeFlowMayInvokeWriteCapableWorker).toBe(flowMayInvokeWriteCapableWorker);
  });
});
