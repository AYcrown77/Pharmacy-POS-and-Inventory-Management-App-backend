/**
 * Paging helpers shared by every list endpoint.
 *
 * The frontend's `Paginated<T>` is a fixed shape — data, page, pageSize,
 * total, totalPages — and every table in the app reads it. Building it in one
 * place keeps the twenty-odd list endpoints from each inventing their own.
 */

export interface Paginated<T> {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

export interface PageQuery {
    page?: unknown;
    pageSize?: unknown;
}

/**
 * Turns untrusted query strings into a safe limit and offset.
 *
 * Everything arrives as a string over HTTP, and a bad one must not become
 * `LIMIT NaN`. The cap exists so a request for a million rows cannot pull the
 * whole sales history into memory on a mini-PC.
 */
export const resolvePaging = (query: PageQuery) => {
    const parsedPage = Number(query.page);
    const parsedSize = Number(query.pageSize);

    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
    const pageSize =
        Number.isFinite(parsedSize) && parsedSize > 0
            ? Math.min(Math.floor(parsedSize), MAX_PAGE_SIZE)
            : DEFAULT_PAGE_SIZE;

    return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
};

export const buildPaginated = <T>(rows: T[], total: number, page: number, pageSize: number): Paginated<T> => ({
    data: rows,
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
});

/**
 * Restricts sorting to columns we have actually allowed.
 *
 * A sort field goes straight into ORDER BY, so it can never be whatever the
 * client sent.
 */
export const resolveSort = <T extends string>(
    requested: unknown,
    allowed: readonly T[],
    fallback: T,
    direction: unknown
): [T, "ASC" | "DESC"] => {
    const field = allowed.includes(requested as T) ? (requested as T) : fallback;
    const dir = String(direction).toLowerCase() === "desc" ? "DESC" : "ASC";
    return [field, dir];
};
