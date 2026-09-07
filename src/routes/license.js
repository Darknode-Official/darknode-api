const { Hono } = require("hono");
const fs = require("fs");
const path = require("path");

const app = new Hono();
const DB_FILE = process.env.AUTH_DB || path.join(__dirname, "../../data/users.json");

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch (_) { return {}; }
}
function saveUsers(users) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// Tier definitions
const TIERS = {
  free: {
    name: "Free",
    price: 0,
    engine: "ollama",
    models: ["gpt-oss:120b", "gpt-oss:20b", "qwen2.5-coder", "deepseek-coder", "hermes3", "llama3.1"],
    description: "Local AI — runs on your machine, unlimited, $0 forever",
    requestsPerDay: -1,  // unlimited (it's local)
    maxTokens: 32768,
    cloudAI: false,      // no cloud API key bundled
    features: ["nexus-engine", "cli-tools", "local-ai", "mcp-servers", "plugins"],
  },
  pro: {
    name: "Pro",
    price: 15,
    engine: "cloud",
    models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-20250514", "gpt-4o-mini"],
    description: "Cloud AI — Claude Sonnet + Haiku, 500 requests/day",
    requestsPerDay: 500,
    maxTokens: 8192,
    cloudAI: true,       // your API key bundled
    features: ["nexus-engine", "cli-tools", "local-ai", "cloud-ai", "mcp-servers", "plugins", "priority-support"],
  },
  ultra: {
    name: "Ultra",
    price: 30,
    engine: "cloud",
    models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "gpt-4o", "gpt-4o-mini"],
    description: "Full power — Claude Opus + all models, 5000 requests/day",
    requestsPerDay: 5000,
    maxTokens: 32768,
    cloudAI: true,
    features: ["nexus-engine", "cli-tools", "local-ai", "cloud-ai", "mcp-servers", "plugins", "priority-support", "multi-agent", "early-access"],
  },
};

// POST /v1/license/verify
app.post("/verify", async (c) => {
  const { apiKey } = await c.req.json();
  if (!apiKey) return c.json({ valid: false, error: "API key required" }, 400);

  const users = loadUsers();
  const user = Object.entries(users).find(([_, u]) => u.apiKey === apiKey);
  if (!user) return c.json({ valid: false, error: "Invalid key" }, 401);

  const [email, data] = user;
  const tier = data.tier || "free";
  const tierInfo = TIERS[tier] || TIERS.free;

  return c.json({
    valid: true,
    tier,
    ...tierInfo,
  });
});

// POST /v1/license/usage
app.post("/usage", async (c) => {
  const { apiKey, requests, tokens, model } = await c.req.json();
  if (!apiKey) return c.json({ error: "API key required" }, 400);

  const users = loadUsers();
  const entry = Object.entries(users).find(([_, u]) => u.apiKey === apiKey);
  if (!entry) return c.json({ error: "Invalid key" }, 401);

  const [email, data] = entry;
  data.usage = data.usage || { requests: 0, tokens: 0 };
  data.usage.requests += requests || 0;
  data.usage.tokens += tokens || 0;
  data.lastActive = new Date().toISOString();
  users[email] = data;
  saveUsers(users);

  return c.json({ ok: true });
});

// GET /v1/license/tiers — public, show on the website
app.get("/tiers", (c) => {
  return c.json({ tiers: Object.entries(TIERS).map(([id, t]) => ({ id, name: t.name, price: t.price, description: t.description, models: t.models, features: t.features, cloudAI: t.cloudAI })) });
});

module.exports = app;
