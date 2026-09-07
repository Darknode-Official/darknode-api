const { Hono } = require("hono");
const https = require("https");

const app = new Hono();

// API keys from environment — you set these once on Fly.io
const PROVIDERS = {
  claude: { url: "https://api.anthropic.com/v1/messages", key: () => process.env.ANTHROPIC_API_KEY },
  openai: { url: "https://api.openai.com/v1/chat/completions", key: () => process.env.OPENAI_API_KEY },
};

function proxyRequest(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname, path: parsed.pathname,
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

app.post("/chat", async (c) => {
  // Validate API key
  const userKey = c.req.header("X-API-Key");
  if (!userKey?.startsWith("dk_")) return c.json({ error: "Invalid Darknode API key. Get one at darknode.ai" }, 401);

  const { model, messages, max_tokens } = await c.req.json();
  if (!messages) return c.json({ error: "messages required" }, 400);

  // Route to the right provider based on model name
  let provider, reqBody, reqHeaders;

  if (!model || model.startsWith("claude")) {
    // Claude (default)
    const key = PROVIDERS.claude.key();
    if (!key) return c.json({ error: "Claude not configured on this server" }, 503);
    provider = "claude";
    reqHeaders = { "x-api-key": key, "anthropic-version": "2023-06-01" };
    reqBody = {
      model: model || "claude-sonnet-4-20250514",
      max_tokens: max_tokens || 4096,
      messages,
    };
  } else if (model.startsWith("gpt") || model.startsWith("o")) {
    const key = PROVIDERS.openai.key();
    if (!key) return c.json({ error: "OpenAI not configured on this server" }, 503);
    provider = "openai";
    reqHeaders = { Authorization: "Bearer " + key };
    reqBody = { model, messages, max_tokens: max_tokens || 4096 };
  } else {
    return c.json({ error: "Unknown model: " + model + ". Use claude-* or gpt-*" }, 400);
  }

  try {
    const result = await proxyRequest(PROVIDERS[provider].url, reqHeaders, reqBody);
    return c.json({ provider, ...result.body }, result.status);
  } catch (e) {
    return c.json({ error: "Proxy error: " + e.message }, 502);
  }
});

// GET /v1/ai/models — list available models
app.get("/models", (c) => {
  const available = [];
  if (PROVIDERS.claude.key()) available.push(
    { id: "claude-sonnet-4-20250514", provider: "anthropic" },
    { id: "claude-haiku-4-5-20251001", provider: "anthropic" },
  );
  if (PROVIDERS.openai.key()) available.push(
    { id: "gpt-4o", provider: "openai" },
    { id: "gpt-4o-mini", provider: "openai" },
  );
  return c.json({ models: available, note: available.length ? undefined : "No AI providers configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY." });
});

module.exports = app;
