import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
import Sale, { PAYMENT_METHODS, PaymentMethod } from "./saleSchema.js";

// This is the attributes for the SalePayment model
export interface SalePaymentAttributes {
    id: string;
    saleId: string;
    method: PaymentMethod;
    amountTendered: number;
    amountApplied: number;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the SalePayment model
export interface SalePaymentCreationAttributes
    extends Optional<SalePaymentAttributes, "id" | "createdAt" | "updatedAt"> {}

/**
 * One way a sale was paid.
 *
 * A customer who pays part in cash and part on the card terminal leaves two of
 * these. They are rows rather than columns on the sale because the day-end
 * question — how much came in by each method — has to add up correctly
 * whatever mix any one customer happened to use.
 */
export class SalePayment
    extends Model<SalePaymentAttributes, SalePaymentCreationAttributes>
    implements SalePaymentAttributes
{
    declare id: string;
    declare saleId: string;
    declare method: PaymentMethod;
    declare amountTendered: number;
    declare amountApplied: number;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the SalePayment model
export const SalePaymentSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    saleId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "sales", key: "id" },
    },
    method: {
        type: DataTypes.ENUM(...PAYMENT_METHODS),
        allowNull: false,
    },
    amountTendered: {
        // What the customer handed over by this method, before any change.
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    amountApplied: {
        // The part of it that paid for this sale's goods. Whatever is left of
        // the tender either cleared old debt or went back as change — neither
        // of which is a sale — so reports add up this column, not the one
        // above.
        type: DataTypes.BIGINT,
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
SalePayment.init(SalePaymentSchema, {
    sequelize,
    modelName: "SalePayment",
    tableName: "sale_payments",
    indexes: [{ fields: ["saleId"] }, { fields: ["method"] }],
});

SalePayment.belongsTo(Sale, { foreignKey: "saleId", as: "sale" });
Sale.hasMany(SalePayment, { foreignKey: "saleId", as: "payments" });

export { SalePayment as default };
