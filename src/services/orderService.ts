import { splitOrder } from '../domain/orderSplitter';
import { SplitOrderInput, SplitOrderResult } from '../domain/types';
import { config } from '../config';
import { NotFoundError } from '../utils/AppError';
import { OrderQueryFilter, OrderRepository, orderRepository } from '../repositories/orderRepository';

/**
 * Orchestrates the pure domain logic (splitOrder) with persistence
 * (OrderRepository) and application configuration. Controllers depend on
 * this service, never on the repository or domain layer directly.
 */
export class OrderService {
  constructor(private readonly repository: OrderRepository = orderRepository) {}

  createSplitOrder(input: SplitOrderInput): SplitOrderResult {
    const result = splitOrder(input, {
      quantityDecimalPlaces: config.shareQuantityDecimalPlaces,
      defaultStockPrice: config.defaultStockPrice,
      portfolioWeightTolerance: config.portfolioWeightTolerance,
    });

    return this.repository.save(result);
  }

  getOrderById(orderId: string): SplitOrderResult {
    const order = this.repository.findById(orderId);
    if (!order) {
      throw new NotFoundError(`No order found with id "${orderId}".`);
    }
    return order;
  }

  listOrders(filter: OrderQueryFilter): { items: SplitOrderResult[]; total: number } {
    return this.repository.findAll(filter);
  }
}

export const orderService = new OrderService();
