import { compileFlowDefinition } from '../flow-definition.js';
import { sweepFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(sweepFlowDefinition);

export { compiledFlowPackage as sweepCompiledFlowPackage };
