import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

// Lazy on purpose: unlike the OpenAI-compat integration, this key is optional
// for the app to boot — only the AI press-release feature needs it, and a
// missing key should fail that one request, not crash the whole server.
export function getAnthropicClient(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY não está definida. Defina-a no .env do api-server para usar a geração de notícias com IA.",
    );
  }
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
