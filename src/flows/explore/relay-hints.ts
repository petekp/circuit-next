// Explore flow relay shape hints.

import type { SchemaShapeHint } from '../../runtime/registries/shape-hints/types.js';

export const exploreComposeShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'explore.compose@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<one-of-accepted-verdicts>", "subject": "<subject investigated>", "recommendation": "<primary conclusion or recommendation>", "success_condition_alignment": "<how the recommendation satisfies the brief success condition>", "supporting_aspects": [{ "aspect": "<analysis aspect name>", "contribution": "<how this aspect supports the recommendation>", "evidence_refs": ["<report path or file:line reference that supports this contribution>"] }] }',
    'Ground claims in the provided reports or files you inspect. If the evidence is thin, say so in the recommendation instead of inventing certainty. When asked to score or grade, include the rubric in the recommendation and cite the evidence refs behind the score.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against explore.compose@v1 before writing reports/compose.json.',
  ].join(' '),
};

export const exploreReviewVerdictShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'explore.review-verdict@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<one-of-accepted-verdicts>", "overall_assessment": "<review summary>", "objections": ["<blocking or follow-up objection>"], "missed_angles": ["<important angle not covered>"] }',
    'Use empty arrays when there are no objections or missed angles. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against explore.review-verdict@v1 before writing reports/review-verdict.json.',
  ].join(' '),
};
