// Explore workflow dispatch shape hints.

import type { SchemaShapeHint } from '../../runtime/shape-hints/types.js';

export const exploreSynthesisShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'explore.synthesis@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<one-of-accepted-verdicts>", "subject": "<subject investigated>", "recommendation": "<primary conclusion or recommendation>", "success_condition_alignment": "<how the recommendation satisfies the brief success condition>", "supporting_aspects": [{ "aspect": "<analysis aspect name>", "contribution": "<how this aspect supports the recommendation>" }] }',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full artifact body against explore.synthesis@v1 before writing artifacts/synthesis.json.',
  ].join(' '),
};

export const exploreReviewVerdictShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'explore.review-verdict@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<one-of-accepted-verdicts>", "overall_assessment": "<review summary>", "objections": ["<blocking or follow-up objection>"], "missed_angles": ["<important angle not covered>"] }',
    'Use empty arrays when there are no objections or missed angles. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full artifact body against explore.review-verdict@v1 before writing artifacts/review-verdict.json.',
  ].join(' '),
};
