const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100; // Cap at 100 to prevent memory exhaustion

export interface PaginationParams {
  take: number;
  skip: number;
}

/**
 * Parses `?take=&skip=` query params with sane defaults and a hard upper
 * bound, so a client can't request an unbounded `take` and force a huge
 * query. Invalid/missing values fall back to defaults rather than erroring
 * — pagination params are a convenience, not something worth a 400 over.
 */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const rawTake = Number(query.take);
  const rawSkip = Number(query.skip);

  const take =
    Number.isFinite(rawTake) && rawTake > 0 ? Math.min(Math.floor(rawTake), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  const skip = Number.isFinite(rawSkip) && rawSkip >= 0 ? Math.floor(rawSkip) : 0;

  return { take, skip };
}
