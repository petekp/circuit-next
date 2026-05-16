// Shared helpers for close-with-evidence builders.
//
// `reportPathForSchemaInRuntimeFlow` mirrors the runtime package index lookup
// so close builders can populate `evidence_links` paths without
// depending on the runner's private API surface. The lookup resolves
// the unique flow step that writes a given schema and returns its
// path — it's intentionally strict (exactly one writer required) so
// schematic shape errors surface here instead of producing ambiguous
// pointers in the result report.

export {
  flowHasReportSchemaInRuntimeFlow,
  reportPathForSchemaInRuntimeFlow,
} from '../runtime-index.js';
