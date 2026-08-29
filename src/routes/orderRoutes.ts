import { Router } from 'express';
import { createSplitOrder, getOrderById, listOrders } from '../controllers/orderController';
import { validate } from '../middlewares/validate';
import {
  listOrdersQuerySchema,
  orderIdParamSchema,
  splitOrderRequestSchema,
} from '../schemas/orderSchemas';

export const orderRouter = Router();

/**
 * @openapi
 * /orders/split:
 *   post:
 *     tags: [Orders]
 *     summary: Split an order amount across a model portfolio
 *     description: >
 *       Accepts a total order amount and a model portfolio (a list of stocks with
 *       percentage weights, and optional partner-supplied market prices), and returns
 *       the dollar amount and share quantity to buy/sell for each stock, along with the
 *       next valid trading-day execution date. The order is persisted in memory and can
 *       be retrieved afterwards via GET /orders or GET /orders/{orderId}.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SplitOrderRequest'
 *           examples:
 *             buyExample:
 *               summary: Buy $100 split 60/40 across AAPL/TSLA
 *               value:
 *                 side: BUY
 *                 amount: 100
 *                 portfolio:
 *                   - symbol: AAPL
 *                     weight: 60
 *                   - symbol: TSLA
 *                     weight: 40
 *             withMarketPriceExample:
 *               summary: Partner-supplied market price overrides the fixed default
 *               value:
 *                 side: BUY
 *                 amount: 1000
 *                 portfolio:
 *                   - symbol: AAPL
 *                     weight: 60
 *                     price: 150.25
 *                   - symbol: TSLA
 *                     weight: 40
 *     responses:
 *       201:
 *         description: Order successfully split.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SplitOrderResult'
 *       400:
 *         description: Validation error (bad amount, malformed portfolio, weights not summing to 100%, etc).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
orderRouter.post('/orders/split', validate(splitOrderRequestSchema, 'body'), createSplitOrder);

/**
 * @openapi
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: List historic orders
 *     description: Returns previously created split orders, most recent first, with optional filtering.
 *     parameters:
 *       - in: query
 *         name: symbol
 *         schema: { type: string }
 *         description: Filter to orders that included this stock symbol.
 *       - in: query
 *         name: side
 *         schema: { type: string, enum: [BUY, SELL] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: >
 *           Inclusive lower bound on executionDate (YYYY-MM-DD) - the date the order will
 *           TRADE, not the date it was placed (requestedAt). Since markets are closed on
 *           weekends, an order placed on a Saturday/Sunday has an executionDate on the
 *           following Monday, so filtering by today's date will not match a weekend order.
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: >
 *           Inclusive upper bound on executionDate (YYYY-MM-DD). See the `from` parameter
 *           description for the executionDate vs. requestedAt distinction.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       200:
 *         description: Paginated list of historic orders.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderListResponse'
 *       400:
 *         description: Invalid query parameters.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
orderRouter.get('/orders', validate(listOrdersQuerySchema, 'query'), listOrders);

/**
 * @openapi
 * /orders/{orderId}:
 *   get:
 *     tags: [Orders]
 *     summary: Get a single historic order by id
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The requested order.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SplitOrderResult'
 *       404:
 *         description: No order exists with the given id.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
orderRouter.get('/orders/:orderId', validate(orderIdParamSchema, 'params'), getOrderById);
