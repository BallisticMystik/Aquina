import express from "express";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const { Pool } = pg;

const PORT = Number(process.env.PORT) || 3000;
const publicDir = __dirname;

let pool = null;
function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

app.get("/api/health", async (_req, res) => {
  const p = getPool();
  if (!p) {
    return res.json({ ok: true, db: "not_configured" });
  }
  try {
    const r = await p.query("select 1 as n");
    return res.json({ ok: true, db: "connected", ping: r.rows[0]?.n });
  } catch (e) {
    return res.status(500).json({ ok: false, db: "error", message: String(e.message) });
  }
});

async function resolveIndexHtml() {
  const tryNames = ["ÆG-AQUILA.html", "AEG-AQUILA.html", "index.html"];
  for (const n of tryNames) {
    const p = path.join(publicDir, n);
    try {
      await readFile(p);
      return p;
    } catch {
      /* next */
    }
  }
  const files = await readdir(publicDir);
  const found = files.find((f) => f.toLowerCase().endsWith("aquila.html"));
  return found ? path.join(publicDir, found) : null;
}

app.get("/", async (_req, res) => {
  const indexPath = await resolveIndexHtml();
  if (!indexPath) {
    return res.status(404).send("No entry HTML (e.g. *AQUILA.html) found");
  }
  const html = await readFile(indexPath, "utf8");
  res.type("html").send(html);
});

app.use(express.static(publicDir, { index: false }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Listening on ${PORT}`);
});
