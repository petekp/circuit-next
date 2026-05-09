// Shared HTML component primitives.
//
// Cross-flow building blocks for operator-summary HTML. Components consume
// the escape/truncate helpers from page.ts and reference the semantic intent
// tokens (--intent-positive / --intent-info / --intent-attention /
// --intent-negative) declared there.

import { MAX_BULLET_LEN, escapeHtml, truncate } from './page.js';

export type Intent = 'info' | 'positive' | 'attention' | 'negative' | 'neutral';

function intentClass(intent: Intent): string {
  return intent === 'neutral' || intent === 'info' ? '' : `intent-${intent}`;
}

export type IntentBadgeInput = {
  readonly text: string;
  readonly intent: Intent;
};

export function intentBadge(input: IntentBadgeInput): string {
  const classes = ['intent-badge'];
  const className = intentClass(input.intent);
  if (className.length > 0) classes.push(className);
  return `<span class="${classes.join(' ')}">${escapeHtml(input.text)}</span>`;
}

export function chip(text: string): string {
  return `<span class="chip">${escapeHtml(truncate(text, MAX_BULLET_LEN))}</span>`;
}

export type CardInput = {
  readonly intent?: Intent;
  readonly eyebrow?: string;
  readonly title: string;
  readonly badge?: IntentBadgeInput;
  readonly bodyHtml: string;
};

export function card(input: CardInput): string {
  const intent = input.intent ?? 'neutral';
  const classes = ['card'];
  const intentClassName = intentClass(intent);
  if (intentClassName.length > 0) classes.push(intentClassName);
  const eyebrowMarkup =
    input.eyebrow === undefined ? '' : `<div class="card-id">${escapeHtml(input.eyebrow)}</div>`;
  const badgeMarkup = input.badge === undefined ? '' : intentBadge(input.badge);
  return `    <article class="${classes.join(' ')}">
      <div class="card-head">
        <div>
          ${eyebrowMarkup}
          <h2>${escapeHtml(input.title)}</h2>
        </div>
        ${badgeMarkup}
      </div>
${input.bodyHtml}
    </article>`;
}

export type VerdictBannerInput = {
  readonly intent: Intent;
  readonly badgeText: string;
  // mainHtml is pre-rendered HTML so projectors can place <strong> emphasis
  // without escapeHtml stripping the markup. Callers are responsible for
  // running operator-controlled substrings through escapeHtml() first.
  readonly mainHtml: string;
  readonly aside?: string;
};

export function verdictBanner(input: VerdictBannerInput): string {
  const classes = ['verdict'];
  const intentClassName = intentClass(input.intent);
  if (intentClassName.length > 0) classes.push(intentClassName);
  const aside =
    input.aside === undefined ? '' : `<span class="confidence">${escapeHtml(input.aside)}</span>`;
  return `  <div class="${classes.join(' ')}">
    <span class="badge">${escapeHtml(input.badgeText)}</span>
    <span class="text">${input.mainHtml}</span>
    ${aside}
  </div>`;
}
