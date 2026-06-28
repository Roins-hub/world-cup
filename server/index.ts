import cors from "cors";
import express from "express";
import path from "node:path";
import { z } from "zod";
import type { ContentPackRequest } from "../shared/types";
import {
  buildThemeOptions,
  generateContentPack,
  generateTopics,
  generateXiaohongshuPublishAssets,
  getEnvironmentStatus,
  prepareJianying,
  runJianyingScript
} from "./pipeline";
import { getFutureFixtures } from "./fixtures";

const app = express();
const port = Number(process.env.PORT || 4317);

app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use("/artifacts/runs", express.static(path.join(process.cwd(), "runs")));

const generateTopicsSchema = z.object({
  language: z.enum(["zh", "en", "es", "fr"]),
  topicText: z.string().optional(),
  fixtureId: z.string().optional(),
  themeId: z.string().optional(),
  count: z.number().int().min(1).max(10)
});

const prepareSchema = z.object({
  pack: z.any(),
  draftName: z.string().optional(),
  speaker: z.string().optional(),
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  downloadMode: z.enum(["plan_only", "download_highlights"]).optional()
});

const runSchema = z.object({
  scriptPath: z.string()
});

const xhsPublishSchema = z.object({
  scriptPath: z.string(),
  draftPath: z.string().optional(),
  generateCoverImage: z.boolean().optional()
});

app.get("/api/health", async (_req, res) => {
  res.json(await getEnvironmentStatus());
});

app.get("/api/fixtures", (_req, res) => {
  const fixtures = getFutureFixtures();
  res.json({ fixtures, generatedAt: new Date().toISOString() });
});

app.get("/api/themes", (req, res) => {
  const fixtures = getFutureFixtures();
  const fixture = fixtures.find((item) => item.id === req.query.fixtureId) || fixtures[0];
  res.json({ themes: buildThemeOptions(fixture) });
});

app.post("/api/topics", async (req, res, next) => {
  try {
    const body = generateTopicsSchema.parse(req.body);
    res.json(await generateTopics(body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/content-pack", (req, res, next) => {
  try {
    const body = req.body as ContentPackRequest;
    if (!body.topic || !Array.isArray(body.assets)) {
      res.status(400).json({ error: "topic and assets are required" });
      return;
    }
    res.json(generateContentPack(body.topic, body.assets));
  } catch (error) {
    next(error);
  }
});

app.post("/api/jianying/prepare", async (req, res, next) => {
  try {
    const body = prepareSchema.parse(req.body);
    res.json(await prepareJianying(body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/jianying/run", async (req, res, next) => {
  try {
    const body = runSchema.parse(req.body);
    res.json(await runJianyingScript(body.scriptPath));
  } catch (error) {
    next(error);
  }
});

app.post("/api/xhs/publish", async (req, res, next) => {
  try {
    const body = xhsPublishSchema.parse(req.body);
    res.json(await generateXiaohongshuPublishAssets(body));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`World Cup Creator Pack API listening on http://localhost:${port}`);
});
