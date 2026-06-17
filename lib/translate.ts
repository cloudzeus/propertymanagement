import { env } from "./env";

interface TranslationResult {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * Translate Greek text to English using Deepseek API
 */
export async function translateGreekToEnglish(
  greekText: string
): Promise<TranslationResult> {
  if (!env.DEEPSEEK_API_KEY) {
    return {
      success: false,
      error: "Deepseek API key not configured",
    };
  }

  // Return original if already short English
  if (greekText.length < 3) {
    return {
      success: true,
      text: greekText,
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
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator. Translate the following Greek text to English. Return ONLY the translated text, nothing else.",
          },
          {
            role: "user",
            content: greekText,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Deepseek translation error:", error);
      return {
        success: false,
        error: `Translation API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as any;
    const translatedText = data.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      return {
        success: false,
        error: "Empty translation response",
      };
    }

    return {
      success: true,
      text: translatedText,
    };
  } catch (error) {
    console.error("Translation request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Batch translate multiple texts
 */
export async function batchTranslate(
  greekTexts: string[]
): Promise<TranslationResult[]> {
  return Promise.all(greekTexts.map((text) => translateGreekToEnglish(text)));
}

/**
 * Cache for translations to avoid repeated API calls
 */
const translationCache = new Map<string, string>();

/**
 * Translate with caching
 */
export async function translateWithCache(
  greekText: string
): Promise<TranslationResult> {
  // Check cache first
  if (translationCache.has(greekText)) {
    return {
      success: true,
      text: translationCache.get(greekText),
    };
  }

  // Translate using API
  const result = await translateGreekToEnglish(greekText);

  // Cache successful translations
  if (result.success && result.text) {
    translationCache.set(greekText, result.text);
  }

  return result;
}

/**
 * Clear translation cache
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}

/**
 * Get cache statistics
 */
export function getTranslationCacheStats() {
  return {
    size: translationCache.size,
    entries: Array.from(translationCache.entries()),
  };
}
