import { compileFlowDefinition } from '../flow-definition.js';
import { migrateFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(migrateFlowDefinition);

export { compiledFlowPackage as migrateCompiledFlowPackage };
