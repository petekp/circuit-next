import { defineFlowData } from '../flow-definition.js';
import { buildFlowData } from './data.js';

export const buildFlowDefinition = defineFlowData(buildFlowData);
