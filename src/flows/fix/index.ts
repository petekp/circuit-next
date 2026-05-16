import { compileFlowDefinition } from '../flow-definition.js';
import { fixFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(fixFlowDefinition);

export { compiledFlowPackage as fixCompiledFlowPackage };
