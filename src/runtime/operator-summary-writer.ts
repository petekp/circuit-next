export {
  type CheckpointWaitingOperatorSummaryResult,
  type OperatorSummaryRunResult,
  type OperatorSummaryWriteResult,
  writeOperatorSummary,
} from '../shared/operator-summary-writer.js';

// Runtime compatibility surface. Operator summary writing is shared CLI output
// infrastructure, so the implementation now lives in
// `src/shared/operator-summary-writer.ts`; retained runtime callers can keep
// importing the old path while ownership narrows out of `src/runtime/`.
