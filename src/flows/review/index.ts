import { compileFlowDefinition } from '../flow-definition.js';
import { reviewFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(reviewFlowDefinition);

export { compiledFlowPackage as reviewCompiledFlowPackage };
