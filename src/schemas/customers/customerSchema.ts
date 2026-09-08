import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";

// This is the attributes for the Customer model
export interface CustomerAttributes {
    id: string;
    name: string;
    phone: string | null;
    note: string | null;
    balance: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Customer model
export interface CustomerCreationAttributes
    extends Optional<
        CustomerAttributes,
        "id" | "phone" | "note" | "balance" | "isActive" | "createdAt" | "updatedAt"
    > {}

// This is the model for the Customer model
export class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> implements CustomerAttributes {
    declare id: string;
    declare name: string;
    declare phone: string | null;
    declare note: string | null;
    declare balance: number;
    declare isActive: boolean;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the Customer model
export const CustomerSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    phone: {
        // How a pharmacy actually finds a regular — by the number they gave.
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    note: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    balance: {
        // Kobo owed to the pharmacy. Positive means the customer owes; it can
        // legitimately go negative when someone pays ahead, which is credit
        // rather than debt, so this is not constrained to zero and above.
        //
        // A running total AND a ledger: the balance is what the till needs in
        // one read, and the ledger is what lets anyone explain it. They are
        // written together inside one transaction, so they cannot disagree.
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
Customer.init(CustomerSchema, {
    sequelize,
    modelName: "Customer",
    tableName: "customers",
    indexes: [{ fields: ["name"] }, { fields: ["phone"] }],
});

export { Customer as default };
