// Compatibility shim for older internal imports. New connector code should
// import JSON extraction from `src/shared/json-extraction.ts`; connector-shared
// runtime behavior lives in `src/connectors/subprocess.ts`.
export { extractJsonObject } from './json-extraction.js';
