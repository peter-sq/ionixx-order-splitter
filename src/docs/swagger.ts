import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config';

const definition: swaggerJsdoc.OAS3Definition = {
  openapi: '3.0.3',
  info: {
    title: 'Ionixx Order Splitter API',
    version: '1.0.0',
    description:
      'Proof-of-concept API that splits a model-portfolio order across its constituent ' +
      'stocks, computing the dollar amount and share quantity for each, resolving the ' +
      'next valid trading-day execution date, and exposing historic orders. ' +
      'Data is held in memory only and does not survive an application restart.',
  },
  servers: [{ url: `http://localhost:${config.port}/api/v1`, description: 'Local server' }],
  tags: [{ name: 'Orders', description: 'Order splitting and order history' }],
  components: {
    schemas: {
      ModelPortfolioItem: {
        type: 'object',
        required: ['symbol', 'weight'],
        properties: {
          symbol: { type: 'string', example: 'AAPL', maxLength: 10 },
          weight: {
            type: 'number',
            format: 'float',
            example: 60,
            description: 'Percentage weight of this stock in the model portfolio (0, 100].',
          },
          price: {
            type: 'number',
            format: 'float',
            example: 150.25,
            description:
              'Optional partner-supplied market price. Overrides the platform default price when present.',
          },
        },
      },
      SplitOrderRequest: {
        type: 'object',
        required: ['side', 'amount', 'portfolio'],
        properties: {
          side: { type: 'string', enum: ['BUY', 'SELL'], example: 'BUY' },
          amount: { type: 'number', format: 'float', example: 100 },
          portfolio: {
            type: 'array',
            items: { $ref: '#/components/schemas/ModelPortfolioItem' },
            minItems: 1,
          },
        },
      },
      OrderAllocation: {
        type: 'object',
        properties: {
          symbol: { type: 'string', example: 'AAPL' },
          weight: { type: 'number', example: 60 },
          priceUsed: { type: 'number', example: 150.25 },
          priceSource: { type: 'string', enum: ['REQUEST', 'DEFAULT'], example: 'REQUEST' },
          targetAmount: { type: 'number', example: 60 },
          quantity: { type: 'number', example: 0.399 },
          actualAmount: { type: 'number', example: 59.95 },
        },
      },
      SplitOrderResult: {
        type: 'object',
        properties: {
          orderId: { type: 'string', format: 'uuid' },
          side: { type: 'string', enum: ['BUY', 'SELL'] },
          totalAmount: { type: 'number', example: 100 },
          requestedAt: { type: 'string', format: 'date-time' },
          executionDate: {
            type: 'string',
            format: 'date',
            description: 'Next valid trading day (Mon-Fri) on which the order will execute.',
          },
          quantityDecimalPlaces: { type: 'integer', example: 3 },
          allocations: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderAllocation' },
          },
          residualCash: {
            type: 'number',
            example: 0.05,
            description: 'Cash left unallocated due to share-quantity rounding.',
          },
        },
      },
      OrderListResponse: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/SplitOrderResult' } },
          total: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          offset: { type: 'integer', example: 0 },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Request validation failed.' },
              details: { type: 'object', nullable: true },
            },
          },
        },
      },
    },
  },
};

export const swaggerSpec = swaggerJsdoc({
  definition,
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
});
