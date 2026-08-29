import { Router } from 'express';
import { orderRouter } from './orderRoutes';

export const apiRouter = Router();

apiRouter.use(orderRouter);
