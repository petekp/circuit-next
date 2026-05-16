import { compileFlowDefinition } from '../flow-definition.js';
import { runtimeProofFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(runtimeProofFlowDefinition);

export { compiledFlowPackage as runtimeProofCompiledFlowPackage };
