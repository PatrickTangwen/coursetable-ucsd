import {
  Kind,
  parse,
  type FieldNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
  type ValueNode,
} from 'graphql';

const termScopedRoots = new Set([
  'supportedTerms',
  'courses',
  'sections',
  'meetings',
  'sectionInstructors',
  'gradeArchiveRecords',
  'snapshotAvailability',
  'courseDataImportRuns',
  'importManifestCells',
]);
const publicListRoots = new Set([...termScopedRoots, 'instructors']);
const relationshipLists = new Set([
  'courses',
  'sections',
  'meetings',
  'instructorLinks',
  'gradeArchiveRecords',
  'importRuns',
  'importManifestCells',
]);
const maximumRootLimit = 100;
const maximumRelationshipLimit = 20;
const maximumSelectionDepth = 6;
const maximumSelectedFields = 80;
const maximumRelationshipLists = 12;

type QueryBudget = {
  selectedFields: number;
  relationshipLists: number;
  activeFragments: Set<string>;
};

function argument(field: FieldNode, name: string) {
  return field.arguments?.find((item) => item.name.value === name)?.value;
}

function value(
  valueNode: ValueNode,
  variables: { [name: string]: unknown },
): unknown {
  if (valueNode.kind === Kind.VARIABLE) return variables[valueNode.name.value];
  if (valueNode.kind === Kind.INT) return Number(valueNode.value);
  if (valueNode.kind === Kind.STRING) return valueNode.value;
  if (valueNode.kind === Kind.OBJECT) {
    return Object.fromEntries(
      valueNode.fields.map((field) => [
        field.name.value,
        value(field.value, variables),
      ]),
    );
  }
  if (valueNode.kind === Kind.LIST)
    return valueNode.values.map((item) => value(item, variables));
  if (valueNode.kind === Kind.BOOLEAN) return valueNode.value;
  if (valueNode.kind === Kind.NULL) return null;
  return undefined;
}

function boundedLimit(
  field: FieldNode,
  variables: { [name: string]: unknown },
  maximum: number,
) {
  const limitNode = argument(field, 'limit');
  const limit = limitNode && value(limitNode, variables);
  return (
    typeof limit === 'number' &&
    Number.isSafeInteger(limit) &&
    limit > 0 &&
    limit <= maximum
  );
}

function hasTermScope(
  field: FieldNode,
  variables: { [name: string]: unknown },
) {
  const whereNode = argument(field, 'where');
  const where = whereNode && value(whereNode, variables);
  if (!where || typeof where !== 'object') return false;
  const { termCode } = where as { termCode?: unknown };
  if (!termCode || typeof termCode !== 'object') return false;
  const equality = (termCode as { _eq?: unknown })._eq;
  return typeof equality === 'string' && equality.length > 0;
}

function validateSelection(
  selectionSet: SelectionSetNode,
  variables: { [name: string]: unknown },
  fragments: Map<string, FragmentDefinitionNode>,
  depth: number,
  budget: QueryBudget,
) {
  if (depth > maximumSelectionDepth)
    throw new Error('public GraphQL selection is too deep');
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = fragments.get(selection.name.value);
      if (!fragment) throw new Error('public GraphQL fragment is missing');
      if (budget.activeFragments.has(selection.name.value))
        throw new Error('public GraphQL fragment cycle is not allowed');
      budget.activeFragments.add(selection.name.value);
      validateSelection(
        fragment.selectionSet,
        variables,
        fragments,
        depth,
        budget,
      );
      budget.activeFragments.delete(selection.name.value);
      continue;
    }
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      validateSelection(
        selection.selectionSet,
        variables,
        fragments,
        depth,
        budget,
      );
      continue;
    }
    budget.selectedFields += 1;
    if (budget.selectedFields > maximumSelectedFields)
      throw new Error('public GraphQL field budget exceeded');
    if (
      depth > 1 &&
      relationshipLists.has(selection.name.value) &&
      selection.selectionSet
    ) {
      budget.relationshipLists += 1;
      if (budget.relationshipLists > maximumRelationshipLists)
        throw new Error('public GraphQL relationship budget exceeded');
      if (!boundedLimit(selection, variables, maximumRelationshipLimit))
        throw new Error('public relationship list requires a bounded limit');
    }
    if (selection.selectionSet) {
      validateSelection(
        selection.selectionSet,
        variables,
        fragments,
        depth + 1,
        budget,
      );
    }
  }
}

export function validatePublicGraphqlRequest(body: unknown) {
  if (!body || typeof body !== 'object')
    throw new Error('public GraphQL body is invalid');
  const { query } = body as { query?: unknown };
  const variablesValue = (body as { variables?: unknown }).variables;
  if (typeof query !== 'string')
    throw new Error('public GraphQL query is required');
  const variables =
    variablesValue && typeof variablesValue === 'object'
      ? (variablesValue as { [name: string]: unknown })
      : {};
  const document = parse(query);
  const fragments = new Map(
    document.definitions
      .filter(
        (definition): definition is FragmentDefinitionNode =>
          definition.kind === Kind.FRAGMENT_DEFINITION,
      )
      .map((fragment) => [fragment.name.value, fragment]),
  );
  const operations = document.definitions.filter(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION,
  );
  if (operations.length !== 1 || operations[0]?.operation !== 'query')
    throw new Error('public GraphQL accepts one query operation');
  const rootFields = operations[0].selectionSet.selections.filter(
    (selection): selection is FieldNode => selection.kind === Kind.FIELD,
  );
  if (rootFields.length !== 1)
    throw new Error('public GraphQL accepts one root field');
  const [root] = rootFields;
  if (!root) throw new Error('public GraphQL root field is required');
  if (!root.name.value.startsWith('__')) {
    if (!publicListRoots.has(root.name.value))
      throw new Error('public GraphQL root is not approved');
    if (!boundedLimit(root, variables, maximumRootLimit))
      throw new Error('public list query requires a bounded limit');
    if (termScopedRoots.has(root.name.value) && !hasTermScope(root, variables))
      throw new Error('public list query requires Supported Term scope');
  }
  validateSelection(operations[0].selectionSet, variables, fragments, 1, {
    selectedFields: 0,
    relationshipLists: 0,
    activeFragments: new Set(),
  });
}
