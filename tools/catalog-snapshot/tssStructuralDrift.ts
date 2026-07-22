import { z } from 'zod';

export const TSS_STRUCTURAL_DRIFT_SCHEMA_VERSION =
  'tss-structural-drift-v1' as const;

export type TssStructuralDriftExpectation =
  | z.ZodParsedType
  | 'known_fields_only'
  | 'approved_enum_member'
  | 'approved_literal'
  | 'valid_contract_shape'
  | 'exact_approved_request'
  | 'approved_paging_request'
  | 'approved_tss_origin'
  | 'approved_schedule_grammar'
  | 'source_term'
  | 'application/json'
  | 'json_object'
  | 'known_module_reference'
  | 'requested_subject'
  | 'subject_course_abbreviation'
  | 'consistent_package_fields';

export type TssStructuralDriftIssue = {
  kind: 'endpoint' | 'path' | 'type' | 'enum';
  path: (string | number)[];
  expected: TssStructuralDriftExpectation;
  observed?: string[];
};

export type TssStructuralDriftReport = {
  schema_version: typeof TSS_STRUCTURAL_DRIFT_SCHEMA_VERSION;
  contract: 'tss-odata-capture-v1';
  issues: TssStructuralDriftIssue[];
};

function issueFromZod(
  issue: z.ZodIssue,
  pathPrefix: (string | number)[],
): TssStructuralDriftIssue {
  const path = [...pathPrefix, ...issue.path];
  if (issue.code === z.ZodIssueCode.unrecognized_keys) {
    return {
      kind: 'path',
      path,
      expected: 'known_fields_only',
      observed: [...issue.keys].sort(),
    };
  }
  if (issue.code === z.ZodIssueCode.invalid_enum_value) {
    return {
      kind: 'enum',
      path,
      expected: 'approved_enum_member',
    };
  }
  if (issue.code === z.ZodIssueCode.invalid_literal) {
    return {
      kind: 'enum',
      path,
      expected: 'approved_literal',
    };
  }
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return {
      kind: 'type',
      path,
      expected: issue.expected,
    };
  }
  return {
    kind: 'type',
    path,
    expected: 'valid_contract_shape',
  };
}

export class TssStructuralDriftError extends Error {
  readonly report: TssStructuralDriftReport;

  constructor(issues: TssStructuralDriftIssue[]) {
    super(
      'TSS response structure does not match the approved capture contract',
    );
    this.name = 'TssStructuralDriftError';
    this.report = {
      schema_version: TSS_STRUCTURAL_DRIFT_SCHEMA_VERSION,
      contract: 'tss-odata-capture-v1',
      issues,
    };
  }

  toJSON() {
    return this.report;
  }
}

export function parseTssStructuralContract<T>(
  schema: z.ZodType<T>,
  value: unknown,
  pathPrefix: (string | number)[] = [],
): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new TssStructuralDriftError(
    parsed.error.issues.map((issue) => issueFromZod(issue, pathPrefix)),
  );
}
