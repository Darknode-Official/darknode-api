const { Hono } = require("hono");
const crypto = require("crypto");
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

// POST /v1/auth/signup — create account, get API key
app.post("/signup", async (c) => {
  const { email, name } = await c.req.json();
  if (!email) return c.json({ error: "email required" }, 400);

  const users = loadUsers();
  if (users[email]) return c.json({ error: "account exists" }, 409);

  const apiKey = "dk_" + crypto.randomBytes(24).toString("hex");
  users[email] = {
    name: name || email.split("@")[0],
    apiKey,
    createdAt: new Date().toISOString(),
    usage: { requests: 0, tokens: 0 },
  };
  saveUsers(users);

  return c.json({ apiKey, message: "Account created. Use this key in the X-API-Key header." });
});

// POST /v1/auth/login — get API key by email
app.post("/login", async (c) => {
  const { email } = await c.req.json();
  const users = loadUsers();
  const user = users[email];
  if (!user) return c.json({ error: "account not found" }, 404);
  return c.json({ apiKey: user.apiKey, name: user.name });
});

// GET /v1/auth/me — get account info (requires API key)
app.get("/me", (c) => {
  const key = c.req.header("X-API-Key") || c.req.header("Authorization")?.replace("Bearer ", "");
  if (!key) return c.json({ error: "API key required" }, 401);

  const users = loadUsers();
  const user = Object.values(users).find(u => u.apiKey === key);
  if (!user) return c.json({ error: "invalid API key" }, 401);

  return c.json({ name: user.name, createdAt: user.createdAt, usage: user.usage });
});

module.exports = app;
