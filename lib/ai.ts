import { env } from "./env";
import { logAPIUsage } from "./api-costs";

/**
 * AI Service Utilities
 * Supports Deepseek and Gemini APIs
 */

interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
}

// Deepseek API Integration
async function deepseekRequest(
  prompt: string,
  model: string = "deepseek-chat"
): Promise<AIResponse> {
  if (!env.DEEPSEEK_API_KEY) {
    return {
      success: false,
      error: "Deepseek API key not configured",
    };
  }

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Deepseek error:", error);
      await logAPIUsage({
        apiName: 'deepseek',
        endpoint: '/chat/completions',
        model,
        status: 'FAILED',
        errorMessage: `HTTP ${response.status}`,
      });
      return {
        success: false,
        error: `Deepseek API error: ${response.status}`,
      };
    }

    const data = await response.json() as any;

    // Log API usage with token counts
    const tokensUsed = data.usage?.total_tokens || 0;
    await logAPIUsage({
      apiName: 'deepseek',
      endpoint: '/chat/completions',
      model,
      tokensUsed,
      status: 'SUCCESS',
    });

    return {
      success: true,
      content: data.choices?.[0]?.message?.content,
    };
  } catch (error) {
    console.error("Deepseek request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Gemini API Integration
async function geminiRequest(
  prompt: string,
  model: string = "gemini-pro"
): Promise<AIResponse> {
  if (!env.GEMINI_API_KEY) {
    return {
      success: false,
      error: "Gemini API key not configured",
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Gemini error:", error);
      await logAPIUsage({
        apiName: 'gemini',
        endpoint: '/generateContent',
        model,
        status: 'FAILED',
        errorMessage: `HTTP ${response.status}`,
      });
      return {
        success: false,
        error: `Gemini API error: ${response.status}`,
      };
    }

    const data = await response.json() as any;

    // Log API usage (Gemini includes usage data in response)
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
    await logAPIUsage({
      apiName: 'gemini',
      endpoint: '/generateContent',
      model,
      tokensUsed,
      status: 'SUCCESS',
    });

    return {
      success: true,
      content: data.candidates?.[0]?.content?.parts?.[0]?.text,
    };
  } catch (error) {
    console.error("Gemini request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Use Deepseek for property management insights
 */
export async function analyzePropertyWithDeepseek(
  propertyData: string
): Promise<AIResponse> {
  const prompt = `Ως ειδικός διαχειριστής κτηρίων, ανάλυσε τα ακόλουθα δεδομένα κτηρίου και παράσχε συμβουλές:\n\n${propertyData}`;
  return deepseekRequest(prompt);
}

/**
 * Use Gemini for maintenance recommendations
 */
export async function getMaintenanceRecommendations(
  maintenanceHistory: string
): Promise<AIResponse> {
  const prompt = `Based on the following maintenance history, provide proactive maintenance recommendations:\n\n${maintenanceHistory}`;
  return geminiRequest(prompt);
}

/**
 * Generate summary from text using preferred AI
 */
export async function generateSummary(
  text: string,
  useDeepseek: boolean = true
): Promise<AIResponse> {
  const prompt = `Summarize the following text in bullet points:\n\n${text}`;
  return useDeepseek ? deepseekRequest(prompt) : geminiRequest(prompt);
}

/**
 * Classify maintenance request urgency
 */
export async function classifyUrgency(
  description: string
): Promise<AIResponse & { urgency?: string }> {
  const prompt = `Classify the urgency of this maintenance request as LOW, NORMAL, HIGH, or URGENT and explain why:\n\n${description}`;
  const result = await deepseekRequest(prompt);

  if (result.success && result.content) {
    const urgency = result.content
      .split("\n")[0]
      .match(/(LOW|NORMAL|HIGH|URGENT)/)?.[0];
    return {
      ...result,
      urgency,
    };
  }

  return result as AIResponse & { urgency?: string };
}

export { deepseekRequest, geminiRequest };
