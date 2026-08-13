export const PAGE_SIZE = 10;

export function getPaginatedJobs<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    currentPage: safePage,
    totalPages,
    items: items.slice(startIndex, endIndex),
  };
}
