const { Hono } = require("hono");
const { serve } = require("@hono/node-server");
const auth = require("./routes/auth");
const releases = require("./routes/releases");
const health = require("./routes/health");
const telemetry = require("./routes/telemetry");

const app = new Hono();

// CORS
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (c.req.method === "OPTIONS") return c.text("", 204);
  await next();
});

// Routes
app.route("/v1/auth", auth);
app.route("/v1/releases", releases);
app.route("/v1/health", health);
app.route("/v1/telemetry", telemetry);

// Root
app.get("/", (c) => c.json({
  name: "Darknode API",
  version: "1.0.0",
  docs: "https://darknode.ai/docs",
  endpoints: ["/v1/health", "/v1/auth", "/v1/releases", "/v1/telemetry"],
}));

const PORT = process.env.PORT || 3000;
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Darknode API running on :${PORT}`);
});
