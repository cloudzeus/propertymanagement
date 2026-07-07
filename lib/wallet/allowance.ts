import { db } from "@/lib/db";
import { creditWallet, getWalletBalance } from "./ledger";

/**
 * Credit each active customer plan's monthly allowance.
 * Non-rollover (simple) customers: the wallet is ZEROED (unused balance discarded) and then
 * re-granted the monthly allowance, so it always starts the month at exactly the allowance.
 * Rollover customers: the allowance is added on top of the remaining balance.
 */
export async function runMonthlyAllowance(): Promise<{ processed: number }> {
  const plans = await db.customerMeteredPlan.findMany({ where: { active: true } });
  let processed = 0;
  for (const plan of plans) {
    const allowance = Number(plan.monthlyAllowanceEur);
    if (allowance <= 0) continue;
    if (plan.rollover) {
      await creditWallet({
        ownerType: "CUSTOMER", ownerId: plan.customerId, type: "ALLOWANCE",
        amountEur: allowance, description: "Monthly allowance (rollover)",
        refType: "package",
      });
    } else {
      // Zero out whatever is left (unused units expire), then grant the fresh allowance.
      const current = await getWalletBalance("CUSTOMER", plan.customerId);
      if (current !== 0) {
        await creditWallet({
          ownerType: "CUSTOMER", ownerId: plan.customerId, type: "RESET",
          amountEur: -current, description: "Monthly reset (unused units expired)",
          refType: "package",
        });
      }
      await creditWallet({
        ownerType: "CUSTOMER", ownerId: plan.customerId, type: "ALLOWANCE",
        amountEur: allowance, description: "Monthly allowance",
        refType: "package",
      });
    }
    processed++;
  }
  return { processed };
}
