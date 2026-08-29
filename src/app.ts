import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { apiRouter } from './routes';
import { swaggerSpec } from './docs/swagger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestTimer, responseTimeHeader } from './middlewares/requestTimer';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(responseTimeHeader);
  app.use(requestTimer);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
