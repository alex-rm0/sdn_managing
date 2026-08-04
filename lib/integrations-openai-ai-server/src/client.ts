import OpenAI from "openai";

function createClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

let cachedClient: OpenAI | undefined;

// Deferred so importing this module (e.g. transitively, at server startup)
// doesn't crash the whole process when this optional integration isn't
// configured — the env vars are only required once a route actually uses it.
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, _receiver) {
    if (!cachedClient) cachedClient = createClient();
    return Reflect.get(cachedClient, prop, cachedClient);
  },
});
