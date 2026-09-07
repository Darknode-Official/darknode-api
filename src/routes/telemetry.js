const { Hono } = require("hono");
const fs = require("fs");
const path = require("path");

const app = new Hono();
const TELEMETRY_FILE = process.env.TELEMETRY_DB || path.join(__dirname, "../../data/telemetry.json");

app.post("/", async (c) => {
  const event = await c.req.json();
  // Append to file (simple, no DB needed)
  let events = [];
  try { events = JSON.parse(fs.readFileSync(TELEMETRY_FILE, "utf8")); } catch (_) {}
  events.push({ ...event, receivedAt: new Date().toISOString() });
  // Keep last 10K events
  if (events.length > 10000) events = events.slice(-10000);
  fs.mkdirSync(path.dirname(TELEMETRY_FILE), { recursive: true });
  fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(events));
  return c.json({ ok: true });
});

app.get("/stats", (c) => {
  let events = [];
  try { events = JSON.parse(fs.readFileSync(TELEMETRY_FILE, "utf8")); } catch (_) {}
  return c.json({ totalEvents: events.length });
});

module.exports = app;
