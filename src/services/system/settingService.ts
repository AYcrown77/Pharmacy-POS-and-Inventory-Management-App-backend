import Setting from "../../schemas/system/settingSchema.js";
import Terminal from "../../schemas/system/terminalSchema.js";
import { recordAudit } from "./auditService.js";
import { messageHandler } from "../../utils/index.js";
import { INTERNAL_SERVER_ERROR, SUCCESS } from "../../constants/statusCode.js";
import { SettingsInput, UserResponse } from "../../types/users/user.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

/**
 * Pharmacy settings are a single row.
 *
 * There is one pharmacy, and the receipt has to be able to read its details
 * without choosing between rows — so the record is a singleton at id 1, created
 * on first read rather than requiring a migration step to exist.
 */
const DEFAULTS = {
    id: 1,
    name: "Mustan Healthcare Pharmacy",
    address: "Kaduna, Nigeria",
    phone: "+234 000 000 0000",
    receiptFooter: "Your Health, Our Priority",
    showLogoOnReceipt: true,
    currency: "NGN",
    lowStockAlertsEnabled: true,
    expiryAlertDays: 90,
};

const loadSettings = async () => {
    const [settings] = await Setting.findOrCreate({ where: { id: 1 }, defaults: DEFAULTS });
    return settings;
};

export const getSettingsService = async (callback: (data: UserResponse) => void) => {
    try {
        const settings = await loadSettings();

        return callback(messageHandler("Settings retrieved", true, SUCCESS, settings));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading settings.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const updateSettingsService = async (
    input: SettingsInput,
    actor: AuthenticatedUser,
    callback: (data: UserResponse) => void
) => {
    try {
        const settings = await loadSettings();

        const before = {
            name: settings.name,
            address: settings.address,
            phone: settings.phone,
            receiptFooter: settings.receiptFooter,
            expiryAlertDays: settings.expiryAlertDays,
        };

        await settings.update({
            name: input.name.trim(),
            address: input.address.trim(),
            phone: input.phone.trim(),
            receiptFooter: input.receiptFooter.trim(),
            showLogoOnReceipt: input.showLogoOnReceipt,
            // The currency is fixed at naira for this deployment; accepting a
            // different one here would silently reprice the whole catalogue.
            currency: "NGN",
            lowStockAlertsEnabled: input.lowStockAlertsEnabled,
            expiryAlertDays: input.expiryAlertDays,
        });

        await recordAudit({
            userId: actor.id,
            userName: actor.name,
            action: "SETTINGS_UPDATED",
            entityType: "SETTINGS",
            entityId: "1",
            oldValue: before,
            newValue: {
                name: settings.name,
                address: settings.address,
                phone: settings.phone,
                receiptFooter: settings.receiptFooter,
                expiryAlertDays: settings.expiryAlertDays,
            },
        });

        return callback(messageHandler("Settings updated", true, SUCCESS, settings));
    } catch (error) {
        return callback(
            messageHandler("An error occured while saving settings.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const listTerminalsService = async (callback: (data: UserResponse) => void) => {
    try {
        const terminals = await Terminal.findAll({ order: [["id", "ASC"]] });

        return callback(messageHandler("Terminals retrieved", true, SUCCESS, terminals));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading terminals.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
