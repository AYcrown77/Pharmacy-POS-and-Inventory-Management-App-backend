import sequelize from "../../database/db.js";
import { messageHandler } from "../../utils/index.js";
import { SUCCESS, SERVICE_UNAVAILABLE } from "../../constants/statusCode.js";
import { BaseResponse } from "../../types/users/auth.js";

/**
 * Reachability of the pharmacy server.
 *
 * The terminals poll this to drive the "Server Connected" indicator, so it
 * checks the database too: an API that answers while the database is down is
 * not a working pharmacy, and the cashier needs to know before starting a sale.
 */
export const healthService = async (callback: (data: BaseResponse) => void) => {
  try {
    await sequelize.authenticate();

    return callback(
      messageHandler("Service healthy", true, SUCCESS, {
        status: "ok",
        serverTime: new Date().toISOString(),
      })
    );
  } catch (error) {
    return callback(
      messageHandler("Database unavailable", false, SERVICE_UNAVAILABLE, {
        status: "unavailable",
        serverTime: new Date().toISOString(),
      })
    );
  }
};
