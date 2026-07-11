import express from 'express';

import { createPublicGraphqlProxy } from './publicGraphqlProxy.js';

const port = Number(process.env.COURSE_DATA_PUBLIC_GRAPHQL_PORT ?? 18_090);
const target =
  process.env.COURSE_DATA_HASURA_ENDPOINT ?? 'http://localhost:18089';
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
  throw new Error('COURSE_DATA_PUBLIC_GRAPHQL_PORT must be a valid port');

const app = express();
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.use('/', ...createPublicGraphqlProxy(target));
app.listen(port, '127.0.0.1');
