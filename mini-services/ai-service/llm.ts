/**
 * Shared LLM client for the ai-service.
 *
 * Provider fallback order (per user decision): OpenRouter first; if that
 * errors or times out, retry the SAME request against NVIDIA (NIM,
 * OpenAI-compatible). If both are unavailable/unset, fall back further to a
 * legacy OpenAI key or a generic OpenAI-compatible endpoint, and finally
 * return null so callers can use their own deterministic/mock fallback.
 *
 * Every provider here speaks the OpenAI-compatible /chat/completions shape,
 * so one fetch implementation covers all of them.
 */

export type LlmProvider = "openrouter" | "nvidia" | "openai" | "custom";

type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  extraHeaders?: Record<string, string>;
};

const SAKSHAM_HEADERS = {
  "HTTP-Referer": "https://saksham.gov.in",
  "X-Title": "Saksham Skill Intelligence",
};

function providerConfig(name: LlmProvider): ProviderConfig | null {
  switch (name) {
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY || "";
      if (!apiKey) return null;
      return {
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey,
        defaultModel: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        extraHeaders: SAKSHAM_HEADERS,
      };
    }
    case "nvidia": {
      const apiKey = process.env.NVIDIA_API_KEY || "";
      if (!apiKey) return null;
      return {
        baseUrl:
          process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
        apiKey,
        defaultModel: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
      };
    }
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY || "";
      if (!apiKey) return null;
      return {
        baseUrl: "https://api.openai.com/v1",
        apiKey,
        defaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      };
    }
    case "custom": {
      const apiKey = process.env.LLM_API_KEY || "";
      const baseUrl = process.env.LLM_BASE_URL || "";
      if (!apiKey || !baseUrl) return null;
      return {
        baseUrl,
        apiKey,
        defaultModel: process.env.LLM_MODEL || "gpt-4o-mini",
      };
    }
  }
}

/** Fixed fallback order. OpenRouter -> NVIDIA -> OpenAI -> generic custom. */
const PROVIDER_ORDER: LlmProvider[] = ["openrouter", "nvidia", "openai", "custom"];

/** Providers that currently have a usable API key configured, in fallback order. */
export function availableProviders(): LlmProvider[] {
  return PROVIDER_ORDER.filter((p) => providerConfig(p) !== null);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatCompleteResult = {
  content: string;
  provider: LlmProvider;
  model: string;
};

export type ChatCompleteOptions = {
  maxTokens?: number;
  temperature?: number;
  /** Per-attempt timeout in ms before treated as failed and falling back. */
  timeoutMs?: number;
};

/**
 * Try each configured provider in order (OpenRouter -> NVIDIA -> ...) until
 * one succeeds. Returns null only if every configured provider failed, or
 * none are configured (LLM_ENABLED off / no keys set) — callers should then
 * use their own mock/deterministic fallback.
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts: ChatCompleteOptions = {},
): Promise<ChatCompleteResult | null> {
  const { maxTokens = 500, temperature = 0.3, timeoutMs = 15000 } = opts;

  for (const name of PROVIDER_ORDER) {
    const cfg = providerConfig(name);
    if (!cfg) continue; // not configured, skip straight to next

    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
          ...(cfg.extraHeaders ?? {}),
        },
        body: JSON.stringify({
          model: cfg.defaultModel,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        console.warn(
          `[ai-service] ${name} call failed: ${res.status} ${res.statusText} — trying next provider`,
        );
        continue; // fall through to the next provider in PROVIDER_ORDER
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.warn(`[ai-service] ${name} returned no content — trying next provider`);
        continue;
      }
      return { content, provider: name, model: cfg.defaultModel };
    } catch (e) {
      console.warn(`[ai-service] ${name} call threw (${e instanceof Error ? e.message : e}) — trying next provider`);
      continue;
    }
  }

  return null; // every configured provider failed, or none configured
}
