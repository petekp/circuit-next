import { readFileSync, writeFileSync } from 'node:fs';

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function safeSegment(value, fallback = 'run') {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

export function isoForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function safeJsonOrString(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
