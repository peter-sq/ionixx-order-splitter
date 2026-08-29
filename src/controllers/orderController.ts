import { NextFunction, Request, Response } from 'express';
import { orderService } from '../services/orderService';
import { ListOrdersQuery, SplitOrderRequestBody } from '../schemas/orderSchemas';

export function createSplitOrder(req: Request, res: Response, next: NextFunction): void {
  try {
    const body = req.body as SplitOrderRequestBody;
    const result = orderService.createSplitOrder(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export function listOrders(req: Request, res: Response, next: NextFunction): void {
  try {
    const query = req.query as unknown as ListOrdersQuery;
    const { items, total } = orderService.listOrders(query);
    res.status(200).json({
      items,
      total,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  } catch (err) {
    next(err);
  }
}

export function getOrderById(req: Request, res: Response, next: NextFunction): void {
  try {
    const { orderId } = req.params as { orderId: string };
    const order = orderService.getOrderById(orderId);
    res.status(200).json(order);
  } catch (err) {
    next(err);
  }
}
