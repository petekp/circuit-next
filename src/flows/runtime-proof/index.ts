import type { CompiledFlowPackage } from '../types.js';
import { runtimeProofComposeBuilder } from './writers/compose.js';

export const runtimeProofCompiledFlowPackage: CompiledFlowPackage = {
  id: 'runtime-proof',
  paths: {
    schematic: 'src/flows/runtime-proof/schematic.json',
  },
  relayReports: [],
  writers: {
    compose: [runtimeProofComposeBuilder],
    close: [],
    verification: [],
    checkpoint: [],
  },
};
