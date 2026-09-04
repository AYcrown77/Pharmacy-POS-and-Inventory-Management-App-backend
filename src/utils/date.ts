/**
 * Calendar-date arithmetic, mirroring the frontend's `lib/date.ts`.
 *
 * An expiry is a calendar day, not an instant. Converting `2026-12-01` through
 * a `Date` and back in a machine set to the wrong timezone can shift it by one,
 * which would mark a batch expired a day early or let it be sold a day late —
 * so these values stay strings and the arithmetic is done in whole days.
 */

export type DateOnly = string;

const MS_PER_DAY = 86_400_000;

/**
 * Today as `YYYY-MM-DD` in the pharmacy's own calendar.
 *
 * Pinned to Africa/Lagos rather than the server's locale: the reports and the
 * expiry bands have to agree with the day the staff are actually working,
 * whatever the mini-PC's clock settings happen to be.
 */
export const PHARMACY_TIMEZONE = "Africa/Lagos";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PHARMACY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

// en-CA formats as YYYY-MM-DD, which is exactly the shape we store.
export const toDateOnly = (date: Date): DateOnly => dayFormatter.format(date);

export const today = (): DateOnly => toDateOnly(new Date());

/**
 * Epoch milliseconds for the UTC midnight of a calendar day. Only ever
 * compared against other values from this same function, so the choice of UTC
 * is an implementation detail that cancels out.
 */
const dateOnlyToEpoch = (value: DateOnly): number => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
};

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export const daysBetween = (from: DateOnly, to: DateOnly): number =>
    Math.round((dateOnlyToEpoch(to) - dateOnlyToEpoch(from)) / MS_PER_DAY);

/** Whole days from today until `date`. Negative once it has passed. */
export const daysUntil = (date: DateOnly): number => daysBetween(today(), date);

/** Shift a calendar day by a number of days. */
export const addDays = (date: DateOnly, days: number): DateOnly => {
    const shifted = new Date(dateOnlyToEpoch(date) + days * MS_PER_DAY);
    const year = shifted.getUTCFullYear();
    const month = `${shifted.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${shifted.getUTCDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const isValidDateOnly = (value: unknown): value is DateOnly => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
        parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    );
};

/**
 * The half-open instant range covering a span of calendar days in the
 * pharmacy's timezone, for filtering timestamp columns.
 *
 * `to` is exclusive — the start of the day after — so a sale rung up at
 * 23:59:59 on the last day of a report still falls inside it.
 */
export const dateOnlyRangeToInstants = (from: DateOnly, to: DateOnly) => {
    // Africa/Lagos is UTC+1 year round; it observes no daylight saving.
    const offset = "+01:00";
    return {
        start: new Date(`${from}T00:00:00${offset}`),
        end: new Date(`${addDays(to, 1)}T00:00:00${offset}`),
    };
};
