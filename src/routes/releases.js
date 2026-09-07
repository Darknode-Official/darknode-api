const { Hono } = require("hono");
const app = new Hono();

const CURRENT = {
  cli: { version: "2.0.0", url: "https://github.com/Darknode-Official/darknode-cli/releases/latest", changelog: "https://darknode.ai/changelog" },
  os: { version: "1.0.0", url: "https://github.com/Darknode-Official/darknode-os/releases/latest" },
  app: { version: "1.0.0", url: "https://github.com/Darknode-Official/darknode-app/releases/latest" },
};

app.get("/latest", (c) => c.json(CURRENT));
app.get("/latest/:product", (c) => {
  const product = c.req.param("product");
  return CURRENT[product] ? c.json(CURRENT[product]) : c.json({ error: "unknown product" }, 404);
});

module.exports = app;
