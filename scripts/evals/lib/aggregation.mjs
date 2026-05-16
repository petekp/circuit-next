export function rate(numerator, denominator) {
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function mean(values) {
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}
