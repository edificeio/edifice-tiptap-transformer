import express, { Express, Request, Response } from 'express';
import {
  healthCheck,
  transformController,
} from './controllers/transformation-controller.js';
import { initMetrics } from './controllers/metrics-controller.js';
import { initLogger, logger } from './logger.js';

export function buildApp(): Express {
  const app: Express = express();
  const serviceVersion = 1;

  initMetrics(app);
  initLogger(app);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expressOptions: any = {};
  if (process.env.MAX_BODY_SIZE) {
    expressOptions['limit'] = process.env.MAX_BODY_SIZE;
  }

  app.use(express.json(expressOptions));
  app.use(
    (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      err: any,
      req: Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      next: express.NextFunction,
    ) => {
      if (err.status === 413 || err.type === 'entity.too.large') {
        req.log.warn('payload.too.large');
        res.status(413).send('payload.too.large');
      } else {
        req.log.error({ err }, 'unhandled.error');
        res.status(500).json({ error: 'internal.server.error' });
      }
    },
  );

  app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!');
  });

  app.post('/transform', (req: Request, res: Response) => {
    transformController(req, res, serviceVersion);
  });
  app.get('/healthcheck', (req: Request, res: Response) => {
    healthCheck(res);
  });

  return app;
}

export default function createServer() {
  logger.info('Launching instance of the transformer');

  const port = process.env.PORT || 3000;
  const app = buildApp();

  app.listen(port, () => {
    logger.info({ port }, 'Example app listening');
  });
}
