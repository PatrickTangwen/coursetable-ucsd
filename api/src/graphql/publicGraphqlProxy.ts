import express, { type RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

import { validatePublicGraphqlRequest } from './publicGraphqlPolicy.js';

export function createPublicGraphqlProxy(target: string): RequestHandler[] {
  return [
    express.json({ limit: '64kb' }),
    (req, res, next) => {
      try {
        validatePublicGraphqlRequest(req.body);
      } catch {
        res
          .status(400)
          .json({ errors: [{ message: 'public query rejected' }] });
        return;
      }
      req.headers['x-hasura-role'] = 'anonymous';
      delete req.headers['x-hasura-admin-secret'];
      next();
    },
    createProxyMiddleware({
      target,
      pathRewrite: { '^/ferry/': '/' },
      xfwd: true,
      on: { proxyReq: fixRequestBody },
    }),
  ];
}
