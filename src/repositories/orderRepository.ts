import { OrderSide, SplitOrderResult } from '../domain/types';

export interface OrderQueryFilter {
  symbol?: string;
  side?: OrderSide;
  from?: string; // ISO date, inclusive, filters on executionDate
  to?: string; // ISO date, inclusive, filters on executionDate
  limit?: number;
  offset?: number;
}

export interface OrderRepository {
  save(order: SplitOrderResult): SplitOrderResult;
  findById(orderId: string): SplitOrderResult | undefined;
  findAll(filter?: OrderQueryFilter): { items: SplitOrderResult[]; total: number };
}

/**
 * Simple in-memory implementation; orders do not survive a process
 * restart by design, so no database is used here. Kept behind the
 * OrderRepository interface so swapping in a real persistence layer
 * later is a one-file change (see ANSWERS.md).
 */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly ordersById = new Map<string, SplitOrderResult>();
  // Insertion order preserved separately so "most recent first" listing is
  // O(1) to derive without re-sorting on every read.
  private readonly insertionOrder: string[] = [];

  save(order: SplitOrderResult): SplitOrderResult {
    this.ordersById.set(order.orderId, order);
    this.insertionOrder.unshift(order.orderId);
    return order;
  }

  findById(orderId: string): SplitOrderResult | undefined {
    return this.ordersById.get(orderId);
  }

  findAll(filter: OrderQueryFilter = {}): { items: SplitOrderResult[]; total: number } {
    const { symbol, side, from, to, limit = 20, offset = 0 } = filter;

    let items = this.insertionOrder.map((id) => this.ordersById.get(id) as SplitOrderResult);

    if (side) {
      items = items.filter((order) => order.side === side);
    }
    if (symbol) {
      const target = symbol.trim().toUpperCase();
      items = items.filter((order) => order.allocations.some((a) => a.symbol === target));
    }
    if (from) {
      items = items.filter((order) => order.executionDate >= from);
    }
    if (to) {
      items = items.filter((order) => order.executionDate <= to);
    }

    const total = items.length;
    const page = items.slice(offset, offset + limit);
    return { items: page, total };
  }
}

// Singleton instance: a real DB-backed implementation would instead be
// constructed once at composition-root time and injected via DI, but for
// this in-memory POC a module-level singleton keeps things simple.
export const orderRepository: OrderRepository = new InMemoryOrderRepository();
