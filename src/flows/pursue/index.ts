import { compileFlowDefinition } from '../flow-definition.js';
import { pursueFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(pursueFlowDefinition);

export { compiledFlowPackage as pursueCompiledFlowPackage };
