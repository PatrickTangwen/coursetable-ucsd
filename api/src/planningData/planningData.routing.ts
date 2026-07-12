export type PlanningOperation =
  | { name: 'list-searches' }
  | { name: 'create-search' }
  | { name: 'delete-search' }
  | { name: 'list-worksheets' }
  | { name: 'get-worksheet'; id: string }
  | { name: 'save-anonymous-worksheet' }
  | { name: 'ensure-main-worksheet' }
  | { name: 'create-blank-worksheet' }
  | { name: 'rename-worksheet'; id: string }
  | { name: 'delete-worksheet'; id: string }
  | { name: 'update-worksheet-sections'; id: string };

interface PlanningDataRouteDefinition {
  method: 'GET' | 'POST';
  operation: (parameters: { [name: string]: string }) => PlanningOperation;
  pattern: string;
}

const fixed = (operation: PlanningOperation) => () => operation;
const identified =
  (name: PlanningOperation['name']) =>
  (parameters: { [name: string]: string }) =>
    ({
      name,
      id: parameters.id!,
    }) as PlanningOperation;

export const planningDataRouteDefinitions: readonly PlanningDataRouteDefinition[] =
  [
    {
      method: 'GET',
      pattern: '/api/savedSearches',
      operation: fixed({ name: 'list-searches' }),
    },
    {
      method: 'POST',
      pattern: '/api/savedSearches/create',
      operation: fixed({ name: 'create-search' }),
    },
    {
      method: 'POST',
      pattern: '/api/savedSearches/delete',
      operation: fixed({ name: 'delete-search' }),
    },
    {
      method: 'GET',
      pattern: '/api/savedWorksheets',
      operation: fixed({ name: 'list-worksheets' }),
    },
    {
      method: 'POST',
      pattern: '/api/savedWorksheets/from-anonymous',
      operation: fixed({ name: 'save-anonymous-worksheet' }),
    },
    {
      method: 'POST',
      pattern: '/api/savedWorksheets/ensure-main',
      operation: fixed({ name: 'ensure-main-worksheet' }),
    },
    {
      method: 'POST',
      pattern: '/api/savedWorksheets/create-blank',
      operation: fixed({ name: 'create-blank-worksheet' }),
    },
    {
      method: 'GET',
      pattern: '/api/savedWorksheets/:id',
      operation: identified('get-worksheet'),
    },
    {
      method: 'POST',
      pattern: '/api/savedWorksheets/:id/rename',
      operation: identified('rename-worksheet'),
    },
    {
      method: 'POST',
      pattern: '/api/savedWorksheets/:id/delete',
      operation: identified('delete-worksheet'),
    },
    {
      method: 'POST',
      pattern: '/api/savedWorksheets/:id/sections',
      operation: identified('update-worksheet-sections'),
    },
  ];

export function matchPlanningOperation(method: string, pathname: string) {
  for (const route of planningDataRouteDefinitions) {
    if (route.method !== method) continue;
    const parameters = matchPath(route.pattern, pathname);
    if (parameters) return route.operation(parameters);
  }
  return null;
}

function matchPath(pattern: string, pathname: string) {
  const expected = pattern.split('/');
  const actual = pathname.split('/');
  if (expected.length !== actual.length) return null;
  const parameters: { [name: string]: string } = {};
  for (let index = 0; index < expected.length; index += 1) {
    const expectedPart = expected[index]!;
    const actualPart = actual[index]!;
    if (expectedPart.startsWith(':')) {
      if (!actualPart) return null;
      parameters[expectedPart.slice(1)] = actualPart;
    } else if (expectedPart !== actualPart) {
      return null;
    }
  }
  return parameters;
}
