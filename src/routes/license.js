const { Hono } = require("hono");
const fs = require("fs");
const path = require("path");

const app = new Hono();
const DB_FILE = process.env.AUTH_DB || path.join(__dirname, "../../data/users.json");

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch (_) { return {}; }
}

// POST /v1/license/verify — the self-hosted container pings this to check
// if the user's license is valid. Returns { valid, tier, limits }.
// This is the ONLY thing your server does — validate the key. No AI runs here.
app.post("/verify", async (c) => {
  const { apiKey } = await c.req.json();
  if (!apiKey) return c.json({ valid: false, error: "API key required" }, 400);

  const users = loadUsers();
  const user = Object.entries(users).find(([_, u]) => u.apiKey === apiKey);
  if (!user) return c.json({ valid: false, error: "Invalid key" }, 401);

  const [email, data] = user;
  const tier = data.tier || "free";

  const TIER_LIMITS = {
    free:  { requestsPerDay: 50,   models: ["claude-haiku-4-5-20251001"], maxTokens: 4096 },
    pro:   { requestsPerDay: 500,  models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-20250514"], maxTokens: 8192 },
    ultra: { requestsPerDay: 5000, models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-20250514", "claude-opus-4-20250514"], maxTokens: 32768 },
  };

  return c.json({
    valid: true,
    tier,
    limits: TIER_LIMITS[tier] || TIER_LIMITS.free,
    // The container uses these to gate access — but AI runs on THEIR server
  });
});

// POST /v1/license/usage — the container reports usage so you can track/bill
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

  const saveUsers = (u) => {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(u, null, 2));
  };
  users[email] = data;
  saveUsers(users);

  return c.json({ ok: true });
});

module.exports = app;
