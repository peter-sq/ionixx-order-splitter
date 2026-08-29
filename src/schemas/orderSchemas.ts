import { z } from 'zod';

export const modelPortfolioItemSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'symbol must not be empty')
    .max(10, 'symbol must be at most 10 characters'),
  weight: z
    .number()
    .gt(0, 'weight must be greater than 0')
    .lte(100, 'weight must be less than or equal to 100'),
  price: z.number().positive('price must be a positive number').optional(),
});

export const splitOrderRequestSchema = z.object({
  side: z.enum(['BUY', 'SELL']),
  amount: z.number().positive('amount must be a positive number'),
  portfolio: z
    .array(modelPortfolioItemSchema)
    .min(1, 'portfolio must contain at least one stock'),
});

export type SplitOrderRequestBody = z.infer<typeof splitOrderRequestSchema>;

export const listOrdersQuerySchema = z.object({
  symbol: z.string().trim().min(1).max(10).optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const orderIdParamSchema = z.object({
  orderId: z.string().uuid('orderId must be a valid UUID'),
});
