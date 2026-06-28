import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateContentPack, generateTopics } from "../server/pipeline";
import type { OutputLanguage } from "../shared/types";

function argValue(name: string, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const topic = argValue("--topic", "France vs Senegal 2002 World Cup shock");
const language = (argValue("--language", "zh") || "zh") as OutputLanguage;
const count = Number(argValue("--count", "5"));

const response = await generateTopics({ topicText: topic, language, count });
const selected = response.topics[0];
const pack = generateContentPack(selected, response.assets);
const outDir = path.join(process.cwd(), "runs", `codex-pack-${Date.now()}`);
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "topics.json"), JSON.stringify(response, null, 2), "utf8");
await writeFile(path.join(outDir, "content-pack.json"), JSON.stringify(pack, null, 2), "utf8");

console.log(JSON.stringify({ ok: true, outDir, title: pack.title, assets: pack.assets.length }, null, 2));
