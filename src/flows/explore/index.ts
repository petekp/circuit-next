import { compileFlowDefinition } from '../flow-definition.js';
import { exploreFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(exploreFlowDefinition);

export { compiledFlowPackage as exploreCompiledFlowPackage };
