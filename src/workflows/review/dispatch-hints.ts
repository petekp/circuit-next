// Standalone review workflow dispatch shape hint.
//
// The audit step does not register a typed artifact under
// writes.artifact (only request_path / receipt_path / result_path), so
// this hint cannot key off step.writes.artifact.schema. It matches by
// the structural shape of the dispatch step instead: reviewer role
// plus the NO_ISSUES_FOUND/ISSUES_FOUND gate verdicts that mirror the
// review.dispatch-result body shape.

import type { StructuralShapeHint } from '../../runtime/shape-hints/types.js';

export const reviewDispatchShapeHint: StructuralShapeHint = {
  kind: 'structural',
  id: 'review.dispatch-result@structural',
  match(step) {
    return (
      step.role === 'reviewer' &&
      step.gate.pass.includes('NO_ISSUES_FOUND') &&
      step.gate.pass.includes('ISSUES_FOUND')
    );
  },
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<one-of-accepted-verdicts>", "findings": [{ "severity": "<critical|high|low>", "id": "<stable finding id>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    'Use an empty findings array when there are no issues: { "verdict": "NO_ISSUES_FOUND", "findings": [] }.',
    'Use an empty file_refs array when a finding has no file-specific reference.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and the close step validates findings before writing artifacts/review-result.json.',
  ].join(' '),
};
