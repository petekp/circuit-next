import { compileFlowDefinition } from '../flow-definition.js';
import { buildFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(buildFlowDefinition);

export { compiledFlowPackage as buildCompiledFlowPackage };
