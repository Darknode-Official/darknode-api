const { Hono } = require("hono");
const app = new Hono();

app.get("/", (c) => c.json({
  status: "ok",
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
  version: "1.0.0",
  node: process.version,
}));

module.exports = app;
