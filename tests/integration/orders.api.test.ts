import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('POST /api/v1/orders/split', () => {
  it('returns 201 with the correct breakdown for the canonical 60/40 example', async () => {
    const res = await request(app)
      .post('/api/v1/orders/split')
      .send({
        side: 'BUY',
        amount: 100,
        portfolio: [
          { symbol: 'AAPL', weight: 60 },
          { symbol: 'TSLA', weight: 40 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.orderId).toEqual(expect.any(String));
    expect(res.body.executionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.allocations).toHaveLength(2);
    expect(res.body.allocations[0]).toMatchObject({ symbol: 'AAPL', targetAmount: 60 });
    expect(res.body.allocations[1]).toMatchObject({ symbol: 'TSLA', targetAmount: 40 });
    expect(res.headers['x-response-time-ms']).toBeDefined();
  });

  it('returns 400 with a descriptive error when weights do not sum to 100%', async () => {
    const res = await request(app)
      .post('/api/v1/orders/split')
      .send({
        side: 'BUY',
        amount: 100,
        portfolio: [{ symbol: 'AAPL', weight: 50 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when the request body fails schema validation (missing side)', async () => {
    const res = await request(app)
      .post('/api/v1/orders/split')
      .send({ amount: 100, portfolio: [{ symbol: 'AAPL', weight: 100 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for a negative amount', async () => {
    const res = await request(app)
      .post('/api/v1/orders/split')
      .send({ side: 'BUY', amount: -10, portfolio: [{ symbol: 'AAPL', weight: 100 }] });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/orders and /api/v1/orders/:orderId', () => {
  it('lists a previously created order and can fetch it by id', async () => {
    const created = await request(app)
      .post('/api/v1/orders/split')
      .send({
        side: 'SELL',
        amount: 200,
        portfolio: [{ symbol: 'MSFT', weight: 100 }],
      });

    expect(created.status).toBe(201);
    const orderId = created.body.orderId as string;

    const list = await request(app).get('/api/v1/orders').query({ symbol: 'MSFT' });
    expect(list.status).toBe(200);
    expect(list.body.items.some((o: { orderId: string }) => o.orderId === orderId)).toBe(true);

    const single = await request(app).get(`/api/v1/orders/${orderId}`);
    expect(single.status).toBe(200);
    expect(single.body.orderId).toBe(orderId);
  });

  it('returns 404 for an unknown order id', async () => {
    const res = await request(app).get('/api/v1/orders/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed order id', async () => {
    const res = await request(app).get('/api/v1/orders/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

describe('GET /health and /docs.json', () => {
  it('reports healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('serves an OpenAPI document', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/orders/split']).toBeDefined();
  });
});
