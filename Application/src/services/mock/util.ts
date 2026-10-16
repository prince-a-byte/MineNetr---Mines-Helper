/** Small delay so mock async behavior resembles real network timing. */
export const latency = (ms = 220) => new Promise((r) => setTimeout(r, ms));

export function paginate<T>(all: T[], page = 1, pageSize = 8): { items: T[]; total: number; hasMore: boolean } {
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length, hasMore: start + pageSize < all.length };
}
