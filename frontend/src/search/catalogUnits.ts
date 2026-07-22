import type { Option } from './searchTypes';

const unitNumberPattern = /\d+(?:\.\d+)?/gu;
const unitScalarPattern = /^\d+(?:\.\d+)?$/u;

/** Numeric choices represented by a UCSD units expression. */
export function catalogUnitValues(units: string | null): number[] {
  if (!units) return [];
  const normalized = units.replace(/[‐‑‒–—―]/gu, '-').replace(/\bto\b/giu, '-');

  const values = [...normalized.matchAll(unitNumberPattern)].map(([value]) =>
    Number(value),
  );
  const segments = normalized
    .split(/\bor\b/iu)
    .flatMap((segment) => segment.split(','))
    .map((segment) => segment.trim());
  for (const segment of segments) {
    const rangeParts = segment.split('-').map((part) => part.trim());
    if (
      rangeParts.length !== 2 ||
      !rangeParts.every((part) => unitScalarPattern.test(part))
    )
      continue;
    const [start, end] = rangeParts.map(Number);
    if (start === undefined || end === undefined) continue;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    const direction = start <= end ? 1 : -1;
    for (let value = start; value !== end + direction; value += direction)
      values.push(value);
  }

  return uniqueSortedNumbers(values);
}

export function formatCatalogUnitLabel(value: number): string {
  return `${value} ${value === 1 ? 'unit' : 'units'}`;
}

export function toggleCatalogUnitSelection(
  selected: Option<number>[],
  available: Option<number>[],
  value: number,
): Option<number>[] {
  if (selected.some((selectedOption) => selectedOption.value === value))
    return selected.filter((selectedOption) => selectedOption.value !== value);
  const option = available.find((candidate) => candidate.value === value);
  return option ? [...selected, option] : selected;
}

function uniqueSortedNumbers(values: number[]): number[] {
  return [...new Set(values)].toSorted((a, b) => a - b);
}
