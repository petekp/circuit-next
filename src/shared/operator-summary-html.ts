// Operator summary HTML projection (Explore tournament path only, for now).
//
// Renders a richer operator-facing artifact than the JSON+markdown siblings.
// HTML is emitted only when the run produces a typed option grid the operator
// would benefit from comparing visually. All operator-controlled strings are
// HTML-escaped at render time.
import type {
  ExploreDecision,
  ExploreDecisionOption,
  ExploreDecisionOptions,
  ExploreTournamentReview,
} from '../flows/explore/reports.js';

export type ExploreTournamentHtmlInput = {
  readonly runId: string;
  readonly flowId: string;
  readonly decisionOptions: ExploreDecisionOptions;
  readonly tournamentReview: ExploreTournamentReview;
  readonly decision?: ExploreDecision;
};

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char);
}

function verdictBadgeText(verdict: ExploreTournamentReview['verdict']): string {
  if (verdict === 'recommend') return 'Recommended';
  if (verdict === 'no-clear-winner') return 'No clear winner';
  return 'Operator decision';
}

function confidenceText(confidence: ExploreTournamentReview['confidence']): string {
  return `${confidence} confidence`;
}

function renderOptionCard(
  option: ExploreDecisionOption,
  isRecommended: boolean,
  isSelected: boolean,
): string {
  const cardClasses = ['card'];
  if (isRecommended) cardClasses.push('recommended');
  if (isSelected) cardClasses.push('selected');
  const badgeMarkup = isSelected
    ? '<span class="rec-badge selected-badge">Selected</span>'
    : isRecommended
      ? '<span class="rec-badge">Recommended</span>'
      : '';

  const tradeoffsMarkup = option.tradeoffs
    .map((tradeoff) => `<li>${escapeHtml(tradeoff)}</li>`)
    .join('\n          ');

  const evidenceMarkup = option.evidence_refs
    .map((ref) => `<span class="chip">${escapeHtml(ref)}</span>`)
    .join('\n          ');

  return `    <article class="${cardClasses.join(' ')}">
      <div class="card-head">
        <div>
          <div class="card-id">${escapeHtml(option.id)}</div>
          <h2>${escapeHtml(option.label)}</h2>
        </div>
        ${badgeMarkup}
      </div>
      <p class="summary">${escapeHtml(option.summary)}</p>
      <div>
        <p class="section-label">Tradeoffs</p>
        <ul class="tradeoffs">
          ${tradeoffsMarkup}
        </ul>
      </div>
      <div>
        <p class="section-label">Evidence</p>
        <div class="evidence">
          ${evidenceMarkup}
        </div>
      </div>
      <div class="actions">
        <button class="copy primary" data-prompt="${escapeHtml(option.best_case_prompt)}">Copy as prompt</button>
      </div>
    </article>`;
}

function renderVerdictBanner(
  review: ExploreTournamentReview,
  decisionOptions: ExploreDecisionOptions,
  decision: ExploreDecision | undefined,
): string {
  const recommendedOption = decisionOptions.options.find(
    (option) => option.id === review.recommended_option_id,
  );
  const recommendedLabel = recommendedOption?.label ?? review.recommended_option_id;
  const decisionText = decision?.decision ?? review.comparison;
  return `  <div class="verdict">
    <span class="badge">${escapeHtml(verdictBadgeText(review.verdict))}</span>
    <span class="text"><strong>${escapeHtml(recommendedLabel)}</strong> &mdash; ${escapeHtml(decisionText)}</span>
    <span class="confidence">${escapeHtml(confidenceText(review.confidence))}</span>
  </div>`;
}

function renderTournamentDetails(
  review: ExploreTournamentReview,
  decision: ExploreDecision | undefined,
): string {
  const sections: string[] = [];
  sections.push(`<p><strong>Comparison.</strong> ${escapeHtml(review.comparison)}</p>`);
  if (review.objections.length > 0) {
    const items = review.objections.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    sections.push(`<p><strong>Objections.</strong></p><ul>${items}</ul>`);
  }
  if (review.missing_evidence.length > 0) {
    const items = review.missing_evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    sections.push(`<p><strong>Missing evidence.</strong></p><ul>${items}</ul>`);
  }
  if (review.tradeoff_question.length > 0) {
    sections.push(
      `<p><strong>Tradeoff question.</strong> ${escapeHtml(review.tradeoff_question)}</p>`,
    );
  }
  if (decision !== undefined) {
    sections.push(`<p><strong>Rationale.</strong> ${escapeHtml(decision.rationale)}</p>`);
    if (decision.residual_risks.length > 0) {
      const items = decision.residual_risks.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      sections.push(`<p><strong>Residual risks.</strong></p><ul>${items}</ul>`);
    }
    sections.push(`<p><strong>Next action.</strong> ${escapeHtml(decision.next_action)}</p>`);
  }
  return sections.join('\n      ');
}

function styles(): string {
  return `:root{--bg:#fafaf9;--surface:#fff;--surface-2:#f5f5f4;--border:#e7e5e4;--border-strong:#d6d3d1;--text:#1c1917;--text-2:#57534e;--text-3:#a8a29e;--accent:#0f172a;--good:#166534;--warn:#9a3412;--recommended:#1e40af;--recommended-soft:#eff6ff;--selected:#166534;--selected-soft:#f0fdf4}@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--surface:#1c1917;--surface-2:#292524;--border:#292524;--border-strong:#44403c;--text:#fafaf9;--text-2:#a8a29e;--text-3:#78716c;--accent:#fafaf9;--good:#4ade80;--warn:#fb923c;--recommended:#93c5fd;--recommended-soft:#172554;--selected:#4ade80;--selected-soft:#052e16}}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}.wrap{max-width:1200px;margin:0 auto;padding:48px 32px 96px}header.top{margin-bottom:24px}.meta{font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}h1{font:600 28px/1.25 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;margin:0 0 8px;letter-spacing:-.01em}.subtitle{color:var(--text-2);font-size:16px;margin:0}.verdict{margin:24px 0 32px;padding:16px 20px;background:var(--recommended-soft);border:1px solid var(--recommended);border-radius:8px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.verdict .badge{font:600 11px/1 -apple-system,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--recommended);padding:4px 8px;border:1px solid var(--recommended);border-radius:4px}.verdict .text{color:var(--text);font-size:14px;flex:1;min-width:200px}.verdict .text strong{font-weight:600}.verdict .confidence{font-size:12px;color:var(--text-2);text-transform:lowercase}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:16px;position:relative}.card.recommended{border-color:var(--recommended);box-shadow:0 0 0 3px var(--recommended-soft)}.card.selected{border-color:var(--selected);box-shadow:0 0 0 3px var(--selected-soft)}.card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.card-id{font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace;color:var(--text-3);letter-spacing:.05em}.card h2{font:600 17px/1.3 -apple-system,system-ui,sans-serif;margin:4px 0 0;letter-spacing:-.005em}.rec-badge{font:600 10px/1 -apple-system,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--recommended);background:var(--recommended-soft);padding:4px 8px;border-radius:4px;white-space:nowrap}.rec-badge.selected-badge{color:var(--selected);background:var(--selected-soft)}.summary{color:var(--text-2);font-size:14px;margin:0}.section-label{font:600 10px/1 -apple-system,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin:0 0 8px}ul.tradeoffs{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}ul.tradeoffs li{font-size:13px;color:var(--text);padding-left:18px;position:relative;line-height:1.5}ul.tradeoffs li::before{content:"\\2022";position:absolute;left:6px;color:var(--text-3);font-weight:700}.evidence{display:flex;flex-wrap:wrap;gap:6px}.chip{font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace;padding:4px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text-2)}.actions{display:flex;gap:8px;margin-top:auto;padding-top:8px}button.copy{font:500 13px/1 -apple-system,system-ui,sans-serif;padding:8px 12px;border:1px solid var(--border-strong);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer}button.copy:hover{background:var(--surface-2)}button.copy.primary{background:var(--accent);color:var(--bg);border-color:var(--accent)}button.copy.primary:hover{opacity:.9}details{margin-top:32px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px}details summary{cursor:pointer;font:500 13px/1.4 -apple-system,system-ui,sans-serif;color:var(--text-2);user-select:none}details[open] summary{margin-bottom:12px}details .body{font-size:13px;color:var(--text-2)}details ul{margin:6px 0;padding-left:20px}details li{margin-bottom:4px}footer{margin-top:48px;padding-top:24px;border-top:1px solid var(--border);color:var(--text-3);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}footer code{font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace}`;
}

function clipboardScript(): string {
  return `document.querySelectorAll('button.copy').forEach(btn=>{btn.addEventListener('click',async()=>{const p=btn.dataset.prompt;if(!p)return;try{await navigator.clipboard.writeText(p);const o=btn.textContent;btn.textContent='Copied';setTimeout(()=>{btn.textContent=o;},1200);}catch(e){btn.textContent='Copy failed';}});});`;
}

export function renderExploreTournamentHTML(input: ExploreTournamentHtmlInput): string {
  const { decisionOptions, tournamentReview, decision } = input;
  const recommendedId = tournamentReview.recommended_option_id;
  const selectedId = decision?.selected_option_id;

  const subtitle = `${decisionOptions.options.length} options surfaced. Tournament review: ${tournamentReview.verdict.replace(/-/g, ' ')} (${tournamentReview.confidence} confidence).`;

  const cards = decisionOptions.options
    .map((option) =>
      renderOptionCard(option, option.id === recommendedId, option.id === selectedId),
    )
    .join('\n\n');

  const verdictBanner = renderVerdictBanner(tournamentReview, decisionOptions, decision);
  const detailsBody = renderTournamentDetails(tournamentReview, decision);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(decisionOptions.decision_question)} &middot; Circuit Explore</title>
<style>${styles()}</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="meta">Explore &middot; ${escapeHtml(input.flowId)} &middot; ${escapeHtml(input.runId)}</div>
    <h1>${escapeHtml(decisionOptions.decision_question)}</h1>
    <p class="subtitle">${escapeHtml(subtitle)}</p>
  </header>

${verdictBanner}

  <div class="grid">
${cards}
  </div>

  <details>
    <summary>Tournament reasoning &middot; why this recommendation?</summary>
    <div class="body">
      ${detailsBody}
    </div>
  </details>

  <footer>
    <span>circuit &middot; explore &middot; ${escapeHtml(input.runId)}</span>
    <span><code>${escapeHtml(decisionOptions.recommendation_basis)}</code></span>
  </footer>
</div>
<script>${clipboardScript()}</script>
</body>
</html>
`;
}
