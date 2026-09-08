import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
import Customer from "./customerSchema.js";

/**
 * Why a customer's balance moved.
 *
 * CHARGE   — goods taken without paying in full; the shortfall becomes debt.
 * REPAYMENT— money handed over against what is owed.
 * REVERSAL — a returned sale giving back debt that was charged for it.
 * ADJUSTMENT — an administrator correcting the balance by hand.
 */
export const LEDGER_ENTRY_TYPES = ["CHARGE", "REPAYMENT", "REVERSAL", "ADJUSTMENT"] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

// This is the attributes for the CustomerLedgerEntry model
export interface CustomerLedgerEntryAttributes {
    id: string;
    customerId: string;
    entryType: LedgerEntryType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    saleId: string | null;
    receiptNumber: string | null;
    reason: string | null;
    userId: string;
    userName: string;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the CustomerLedgerEntry model
export interface CustomerLedgerEntryCreationAttributes
    extends Optional<
        CustomerLedgerEntryAttributes,
        "id" | "saleId" | "receiptNumber" | "reason" | "createdAt" | "updatedAt"
    > {}

// This is the model for the CustomerLedgerEntry model
export class CustomerLedgerEntry
    extends Model<CustomerLedgerEntryAttributes, CustomerLedgerEntryCreationAttributes>
    implements CustomerLedgerEntryAttributes
{
    declare id: string;
    declare customerId: string;
    declare entryType: LedgerEntryType;
    declare amount: number;
    declare balanceBefore: number;
    declare balanceAfter: number;
    declare saleId: string | null;
    declare receiptNumber: string | null;
    declare reason: string | null;
    declare userId: string;
    declare userName: string;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the CustomerLedgerEntry model
export const CustomerLedgerEntrySchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "customers", key: "id" },
    },
    entryType: {
        type: DataTypes.ENUM(...LEDGER_ENTRY_TYPES),
        allowNull: false,
    },
    amount: {
        // Signed, in kobo: positive increases what is owed, negative reduces
        // it. One signed column rather than debit/credit pairs, so the running
        // balance is a plain sum and cannot be assembled the wrong way round.
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    balanceBefore: {
        // The balance either side of this entry, recorded at the time. It
        // makes a disputed balance explainable years later without replaying
        // every entry, and makes a gap in the chain immediately visible.
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    balanceAfter: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    saleId: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
    },
    receiptNumber: {
        // Denormalised so a statement reads without joining to sales.
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    userName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
} as const;

// Initialize and export the Sequelize model instance
CustomerLedgerEntry.init(CustomerLedgerEntrySchema, {
    sequelize,
    modelName: "CustomerLedgerEntry",
    tableName: "customer_ledger_entries",
    indexes: [{ fields: ["customerId", "createdAt"] }, { fields: ["saleId"] }],
});

CustomerLedgerEntry.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Customer.hasMany(CustomerLedgerEntry, { foreignKey: "customerId", as: "ledger" });

// There is deliberately no update or delete path for a ledger entry anywhere
// in the codebase. A balance that was wrong is corrected with an ADJUSTMENT
// entry, which leaves both the error and the correction on the record.

export { CustomerLedgerEntry as default };
