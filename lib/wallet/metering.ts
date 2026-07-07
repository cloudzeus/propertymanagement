import { db } from "@/lib/db";
import { getConfig } from "@/lib/api-costs";
import { computeRealCost, computeCharges } from "./pricing";
import { applyLedgerEntry } from "./ledger";
import { resolveCustomerId } from "./resolve-customer";

/** Single-tenant company wallet key. */
export const COMPANY_WALLET_ID = "SYSTEM";

export interface MeteredUsageInput {
  apiName: string;
  model?: string;
  endpoint?: string;
  tokensUsed?: number;
  minutes?: number;
  bytesProcessed?: number;
  requestCount?: number;
  customerId?: string;
  buildingId?: string;
  userId?: string;
  assemblyId?: string;
}

export interface MeteredUsageResult {
  blocked: boolean;
  reason?: "customer_insufficient" | "company_insufficient" | "no_customer" | "unknown_api" | "no_charge";
  billedCostEur: number;
  customerChargeEur: number;
  logId?: string;
}

async function balanceOf(ownerType: "COMPANY" | "CUSTOMER", ownerId: string): Promise<number> {
  const w = await db.wallet.findUnique({ where: { ownerType_ownerId: { ownerType, ownerId } } });
  return w ? Number(w.balanceEur) : 0;
}

/**
 * Meter one consumption event. Call the PROVIDER FIRST for success, then call this with real units;
 * or call in "preflight" style before the provider by passing estimated units and checking `blocked`.
 */
export async function recordMeteredUsage(input: MeteredUsageInput): Promise<MeteredUsageResult> {
  const config = await getConfig(input.apiName);
  if (!config) return { blocked: true, reason: "unknown_api", billedCostEur: 0, customerChargeEur: 0 };

  const customerId = await resolveCustomerId({ customerId: input.customerId, buildingId: input.buildingId });
  if (!customerId) return { blocked: true, reason: "no_customer", billedCostEur: 0, customerChargeEur: 0 };

  const plan = await db.customerMeteredPlan.findUnique({ where: { customerId } });
  const markup2 = plan?.active ? plan.adminMarkupPercent : 0;

  const realCost = computeRealCost(
    { costModel: config.costModel, basePrice: config.basePrice, freeQuota: config.freeQuota },
    { tokensUsed: input.tokensUsed, minutes: input.minutes, bytesProcessed: input.bytesProcessed, requestCount: input.requestCount },
  );
  const { billedCostEur, customerChargeEur } = computeCharges(realCost, config.markupPercent, markup2);

  if (billedCostEur <= 0 && customerChargeEur <= 0) {
    return { blocked: false, reason: "no_charge", billedCostEur: 0, customerChargeEur: 0 };
  }

  // Pre-flight balance checks.
  const [companyBal, customerBal] = await Promise.all([
    balanceOf("COMPANY", COMPANY_WALLET_ID),
    balanceOf("CUSTOMER", customerId),
  ]);
  if (customerBal < customerChargeEur) {
    return { blocked: true, reason: "customer_insufficient", billedCostEur, customerChargeEur };
  }
  if (companyBal < billedCostEur) {
    return { blocked: true, reason: "company_insufficient", billedCostEur, customerChargeEur };
  }

  // Atomic dual-debit + usage log.
  const result = await db.$transaction(async (tx) => {
    const companyTxn = await applyLedgerEntry(tx as any, {
      ownerType: "COMPANY", ownerId: COMPANY_WALLET_ID, type: "DEBIT",
      amountEur: -billedCostEur, description: `${config.displayName ?? input.apiName} usage`,
      refType: "api_usage", refId: input.apiName,
    });
    const customerTxn = await applyLedgerEntry(tx as any, {
      ownerType: "CUSTOMER", ownerId: customerId, type: "DEBIT",
      amountEur: -customerChargeEur, description: `${config.displayName ?? input.apiName} usage`,
      refType: "api_usage", refId: input.apiName,
    });
    const log = await tx.aPIUsageLog.create({
      data: {
        apiName: input.apiName,
        endpoint: input.endpoint,
        model: input.model,
        requestCount: input.requestCount ?? 1,
        tokensUsed: input.tokensUsed,
        bytesProcessed: input.bytesProcessed,
        costPerUnit: config.basePrice,
        totalCost: Number(realCost.toFixed(6)),
        billedCostEur: Number(billedCostEur.toFixed(6)),
        customerChargeEur: Number(customerChargeEur.toFixed(6)),
        walletTxnCompanyId: companyTxn.txnId,
        walletTxnCustomerId: customerTxn.txnId,
        customerId,
        buildingId: input.buildingId,
        userId: input.userId,
        assemblyId: input.assemblyId,
        status: "SUCCESS",
      },
    });
    return { logId: log.id };
  });

  return { blocked: false, billedCostEur, customerChargeEur, logId: result.logId };
}
