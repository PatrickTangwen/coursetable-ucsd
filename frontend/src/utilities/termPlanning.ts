import type { SupportedTerm } from '../queries/api';
import type { Season } from '../queries/graphql-types';

export function supportedTermCodes(terms: SupportedTerm[]): Season[] {
  const seen = new Set<string>();
  const codes: Season[] = [];
  for (const term of terms) {
    if (seen.has(term.term)) continue;
    seen.add(term.term);
    codes.push(term.term as Season);
  }
  return codes;
}

export function isPlannableTerm(
  term: SupportedTerm | undefined,
  now = new Date(),
): boolean {
  if (!term) return true;
  if (term.frozen) return false;
  if (!term.date_range) return true;

  const end = new Date(`${term.date_range.end}T23:59:59.999Z`);
  return end >= now;
}
