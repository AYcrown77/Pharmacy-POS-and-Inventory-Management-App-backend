import { PAYMENT_METHODS, PaymentMethod } from "../../schemas/sales/saleSchema.js";
import { PaymentTender } from "../../types/sales/sale.js";

export type AmountsByMethod = Record<PaymentMethod, number>;

/** How one sale's payment divides up once every tender has been counted. */
export interface Settlement {
    /** Handed over, by method. */
    tendered: AmountsByMethod;
    /** Of that, what paid for this sale's goods, by method. */
    applied: AmountsByMethod;
    /** Everything handed over, across all methods. */
    received: number;
    /** A shortfall put on the customer's account. */
    debtCharged: number;
    /** A surplus that cleared some of what they already owed. */
    debtRepaid: number;
    /** Given back from the cash. Null when no cash changed hands. */
    changeGiven: number | null;
}

export interface SettlementRefusal {
    code: "INSUFFICIENT_PAYMENT" | "NON_CASH_OVERPAYMENT";
    message: string;
}

/**
 * The order tenders are counted against the total.
 *
 * Card and transfer first, cash last — so anything paid over the total is
 * left sitting in the cash, the only place change can physically come from.
 * Someone paying ₦5,000 on the card and ₦3,000 in notes for a ₦7,000 sale
 * gets ₦1,000 of those notes back, not a refund to their card.
 */
const APPLY_ORDER: readonly PaymentMethod[] = ["CARD", "TRANSFER", "CASH"];

const noAmounts = (): AmountsByMethod => ({ CASH: 0, CARD: 0, TRANSFER: 0 });

/**
 * Settles a sale's payment.
 *
 *   short — the customer took goods without paying in full. The shortfall
 *           becomes debt, which is only possible on a named account: a
 *           walk-in who cannot pay is refused, because there would be nobody
 *           to bill.
 *   over  — the surplus first clears what they already owe, and only what is
 *           left after that is handed back as change. Giving change to someone
 *           who owes money, then chasing them for it, is how a balance quietly
 *           grows.
 *
 * Change comes only out of cash. A card or transfer for more than is due is
 * refused unless the difference goes against an existing debt — there is no
 * way to hand back the excess of a card payment across the counter.
 *
 * Pure, so the rules can be read and checked without a database.
 */
export const settlePayment = ({
    total,
    tenders,
    customerBalance,
}: {
    total: number;
    tenders: PaymentTender[];
    /** The account's current balance, or null for a walk-in. */
    customerBalance: number | null;
}): Settlement | SettlementRefusal => {
    const tendered = noAmounts();
    for (const tender of tenders) {
        if (!(PAYMENT_METHODS as readonly string[]).includes(tender.method)) continue;
        tendered[tender.method] += Math.max(Math.floor(Number(tender.amount) || 0), 0);
    }

    const applied = noAmounts();
    let remaining = total;
    for (const method of APPLY_ORDER) {
        const part = Math.min(tendered[method], remaining);
        applied[method] = part;
        remaining -= part;
    }

    const received = tendered.CASH + tendered.CARD + tendered.TRANSFER;
    const cashHandled = tendered.CASH > 0;

    if (remaining > 0) {
        if (customerBalance === null) {
            return {
                code: "INSUFFICIENT_PAYMENT",
                message: "The amount received is less than the total due.",
            };
        }

        return {
            tendered,
            applied,
            received,
            debtCharged: remaining,
            debtRepaid: 0,
            changeGiven: cashHandled ? 0 : null,
        };
    }

    const surplus = received - total;
    // Only an existing debt absorbs the surplus, and only as far as it goes —
    // change is never turned into credit the customer did not ask for.
    const debtRepaid = customerBalance === null ? 0 : Math.min(surplus, Math.max(customerBalance, 0));
    const leftOver = surplus - debtRepaid;
    const cashOver = tendered.CASH - applied.CASH;

    if (leftOver > cashOver) {
        return {
            code: "NON_CASH_OVERPAYMENT",
            message:
                "Card and transfer payments cannot be more than what is due. Only cash can be given back as change.",
        };
    }

    return {
        tendered,
        applied,
        received,
        debtCharged: 0,
        debtRepaid,
        changeGiven: cashHandled ? leftOver : null,
    };
};

export const isSettlementRefusal = (
    result: Settlement | SettlementRefusal
): result is SettlementRefusal => "code" in result;
