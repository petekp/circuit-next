import type { CompiledFlowPackage } from '../types.js';
import { RuntimeProofCompose } from './reports.js';
import { runtimeProofComposeBuilder } from './writers/compose.js';

export const runtimeProofCompiledFlowPackage: CompiledFlowPackage = {
  id: 'runtime-proof',
  visibility: 'internal',
  paths: {
    schematic: 'src/flows/runtime-proof/schematic.json',
  },
  relayReports: [],
  reportSchemas: [{ schemaName: 'runtime-proof.compose@v1', schema: RuntimeProofCompose }],
  writers: {
    compose: [runtimeProofComposeBuilder],
    close: [],
    verification: [],
    checkpoint: [],
  },
};
