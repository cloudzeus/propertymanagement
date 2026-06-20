import { db } from "./db";

/**
 * API Cost Configuration
 * Prices in EUR
 */
export const DEFAULT_API_COSTS = {
  mailgun: {
    displayName: "Mailgun",
    costModel: "per_email",
    basePrice: 0.0005, // €0.0005 per email (free tier: 5000/month)
    freeQuota: 5000,
    quotaResetDay: 1,
    documentationUrl: "https://www.mailgun.com/pricing/",
  },
  bunnycdn: {
    displayName: "BunnyCDN",
    costModel: "per_gb",
    basePrice: 0.01, // €0.01 per GB (first 10GB free)
    freeQuota: 10,
    quotaResetDay: 1,
    documentationUrl: "https://bunny.net/pricing/",
  },
  deepseek: {
    displayName: "Deepseek",
    costModel: "per_token",
    basePrice: 0.0002, // €0.0002 per 1K tokens (approximate)
    freeQuota: 0,
    quotaResetDay: 1,
    documentationUrl: "https://deepseek.com/pricing/",
  },
  gemini: {
    displayName: "Gemini",
    costModel: "per_token",
    basePrice: 0.00025, // €0.00025 per 1K tokens (approximate)
    freeQuota: 0,
    quotaResetDay: 1,
    documentationUrl: "https://ai.google.dev/pricing/",
  },
  daily: {
    displayName: "Daily",
    costModel: "per_minute",
    basePrice: 0.004, // EUR per participant-minute
    freeQuota: 0,
    quotaResetDay: 1,
    documentationUrl: "https://www.daily.co/pricing/",
  },
  deepgram: {
    displayName: "Deepgram",
    costModel: "per_minute",
    basePrice: 0.0043, // EUR per audio-minute
    freeQuota: 0,
    quotaResetDay: 1,
    documentationUrl: "https://deepgram.com/pricing/",
  },
} as const;

interface LogAPIUsageParams {
  apiName: string;
  endpoint?: string;
  model?: string;
  requestCount?: number;
  tokensUsed?: number;
  bytesProcessed?: number;
  companyId?: string;
  userId?: string;
  buildingId?: string;
  customerId?: string;
  assemblyId?: string;
  status?: "SUCCESS" | "FAILED" | "RETRY";
  errorMessage?: string;
}

/**
 * Log API usage and calculate cost
 */
export async function logAPIUsage(params: LogAPIUsageParams) {
  try {
    const config = DEFAULT_API_COSTS[params.apiName as keyof typeof DEFAULT_API_COSTS];
    if (!config) {
      console.warn(`Unknown API: ${params.apiName}`);
      return null;
    }

    let totalCost = 0;

    // Calculate cost based on cost model
    switch (config.costModel) {
      case "per_email":
        totalCost = (params.requestCount || 1) * config.basePrice;
        break;
      case "per_gb":
        const gb = (params.bytesProcessed || 0) / (1024 * 1024 * 1024);
        totalCost = Math.max(0, gb - (config.freeQuota || 0)) * config.basePrice;
        break;
      case "per_token":
        const tokens = params.tokensUsed || 0;
        totalCost = (tokens / 1000) * config.basePrice; // basePrice is per 1K tokens
        break;
      case "per_minute":
        totalCost = (params.requestCount || 0) * config.basePrice; // requestCount carries minutes
        break;
      default:
        totalCost = (params.requestCount || 1) * config.basePrice;
    }

    // Log to database
    const log = await db.aPIUsageLog.create({
      data: {
        apiName: params.apiName,
        endpoint: params.endpoint,
        model: params.model,
        requestCount: params.requestCount || 1,
        tokensUsed: params.tokensUsed,
        bytesProcessed: params.bytesProcessed,
        costPerUnit: config.basePrice,
        totalCost: parseFloat(totalCost.toFixed(6)), // Round to 6 decimal places
        companyId: params.companyId,
        userId: params.userId,
        buildingId: params.buildingId,
        customerId: params.customerId,
        assemblyId: params.assemblyId,
        status: params.status || "SUCCESS",
        errorMessage: params.errorMessage,
      },
    });

    return log;
  } catch (error) {
    console.error("Error logging API usage:", error);
    return null;
  }
}

/**
 * Get monthly cost summary
 */
export async function getMonthlyCosts(
  year: number,
  month: number,
  companyId?: string
) {
  try {
    const summary = await db.monthlyCostSummary.findMany({
      where: {
        year,
        month,
        ...(companyId && { companyId }),
      },
      orderBy: { totalCost: "desc" },
    });

    const totalCost = summary.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      year,
      month,
      summary,
      totalCost: parseFloat(totalCost.toFixed(2)),
    };
  } catch (error) {
    console.error("Error getting monthly costs:", error);
    return null;
  }
}

/**
 * Get API-specific costs
 */
export async function getAPISpecificCosts(apiName: string, days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await db.aPIUsageLog.findMany({
      where: {
        apiName,
        createdAt: { gte: startDate },
        status: "SUCCESS",
      },
      orderBy: { createdAt: "desc" },
    });

    const totalRequests = logs.reduce((sum, log) => sum + log.requestCount, 0);
    const totalTokens = logs.reduce((sum, log) => sum + (log.tokensUsed || 0), 0);
    const totalBytes = logs.reduce((sum, log) => sum + (log.bytesProcessed || 0), 0);
    const totalCost = logs.reduce((sum, log) => sum + log.totalCost, 0);

    return {
      apiName,
      period: `Last ${days} days`,
      totalRequests,
      totalTokens,
      totalBytes,
      totalGB: (totalBytes / (1024 * 1024 * 1024)).toFixed(2),
      totalCost: parseFloat(totalCost.toFixed(2)),
      logs,
    };
  } catch (error) {
    console.error("Error getting API costs:", error);
    return null;
  }
}

/**
 * Get all API costs summary
 */
export async function getAllAPICosts(days: number = 30) {
  try {
    const apis = Object.keys(DEFAULT_API_COSTS);
    const costs = await Promise.all(
      apis.map((api) => getAPISpecificCosts(api, days))
    );

    const totalCost = costs.reduce((sum, c) => sum + (c?.totalCost || 0), 0);

    return {
      period: `Last ${days} days`,
      totalCost: parseFloat(totalCost.toFixed(2)),
      breakdown: costs,
    };
  } catch (error) {
    console.error("Error getting all API costs:", error);
    return null;
  }
}

/**
 * Initialize API cost configurations
 */
export async function initializeAPICostConfigs() {
  try {
    for (const [apiName, config] of Object.entries(DEFAULT_API_COSTS)) {
      await db.aPICostConfig.upsert({
        where: { apiName },
        update: {
          basePrice: config.basePrice,
          freeQuota: config.freeQuota,
        },
        create: {
          apiName,
          displayName: config.displayName,
          costModel: config.costModel,
          basePrice: config.basePrice,
          freeQuota: config.freeQuota,
          quotaResetDay: config.quotaResetDay,
          documentationUrl: config.documentationUrl,
        },
      });
    }

    return true;
  } catch (error) {
    console.error("Error initializing API cost configs:", error);
    return false;
  }
}
