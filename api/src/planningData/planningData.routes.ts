import type express from 'express';
import asyncHandler from 'express-async-handler';

import {
  createPlanningDataResponse,
  type PlanningDataHttpOptions,
} from './planningData.response.js';
import { planningDataRouteDefinitions } from './planningData.routing.js';
import type { AppSession } from '../auth/appSession.js';

type ExpressPlanningDataOptions = Pick<
  PlanningDataHttpOptions,
  'savedSearches' | 'savedWorksheets'
> & {
  now?: () => number;
  session: AppSession;
};

export function registerPlanningDataRoutes(
  app: express.IRouter,
  options: ExpressPlanningDataOptions,
) {
  const handler = createExpressPlanningDataHandler(options);
  for (const route of planningDataRouteDefinitions) {
    if (route.method === 'GET') app.get(route.pattern, handler);
    else app.post(route.pattern, handler);
  }
}

function createExpressPlanningDataHandler({
  now,
  savedSearches,
  savedWorksheets,
  session,
}: ExpressPlanningDataOptions) {
  return asyncHandler(async (req, res) => {
    const response = await createPlanningDataResponse(
      {
        body: req.body,
        context: req,
        method: req.method,
        pathname: req.path,
        query: req.query,
      },
      {
        now,
        savedSearches,
        savedWorksheets,
        session: {
          getUser: (context) => Promise.resolve(session.getUser(context)),
        },
      },
    );
    if (!response) {
      res.sendStatus(404);
      return;
    }
    for (const [name, value] of response.headers) res.setHeader(name, value);
    res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
  });
}
