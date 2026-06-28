import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type LearningCard = {
  id: string;
  source: "youtube" | "xhs";
  title: string;
  url: string;
  class: string;
  opening_shape: string;
  ending_shape: string;
  tags?: string[];
  char_count: number;
  segment_count: number;
  duration_sec?: number;
  transcript_file: string;
};

type SegmentStudy = {
  id: string;
  source: "youtube" | "xhs";
  processed_segments?: Array<{
    function: string;
    technique: string;
    phase: string;
    char_count: number;
  }>;
};

type EngineId =
  | "question_explainer"
  | "visible_incident"
  | "human_relationship"
  | "star_micro_action"
  | "commentary_assist"
  | "subtitle_first"
  | "fact_list";

const learningCardsPath = path.join(process.cwd(), "docs/benchmark-voiceover-learning/voiceover-learning-cards.json");
const segmentStudyPath = path.join(process.cwd(), "docs/benchmark-voiceover-learning/voiceover-segment-learning.json");
const manifestPath = path.join(process.cwd(), "docs/benchmark-full-transcripts/full-transcript-manifest.json");
const outputJsonPath = path.join(process.cwd(), "data/benchmark/football-creators/voiceover-style-profile.json");
const outputDocPath = path.join(process.cwd(), "docs/benchmark-voiceover-style-profile.md");

const engineMap: Record<string, EngineId> = {
  question_explainer: "question_explainer",
  twist_story: "visible_incident",
  emotional_time_story: "human_relationship",
  general_narrative: "visible_incident",
  star_micro_story: "star_micro_action",
  live_match_commentary: "commentary_assist",
  clip_commentary: "commentary_assist",
  silent_or_subtitle_only: "subtitle_first"
};

const engineBlueprints: Record<
  EngineId,
  {
    label: string;
    narrationMode: "narrative_voiceover" | "commentary_assisted" | "subtitle_first";
    defaultDifficulty: "low" | "medium" | "high";
    bestFor: string[];
    avoidWhen: string[];
    evidenceRequired: string[];
    openingMoves: string[];
    voiceoverMoves: string[];
    topicShapes: string[];
  }
> = {
  question_explainer: {
    label: "问题解释型",
    narrationMode: "narrative_voiceover",
    defaultDifficulty: "medium",
    bestFor: ["规则争议", "反常操作", "战术板/教练指令", "非球迷看不懂的镜头"],
    avoidWhen: ["没有可见问题", "只能讲抽象趋势", "需要逐帧证明但没有完整比赛"],
    evidenceRequired: ["一个具体问题", "一条规则或原因", "能被暂停看的动作/站位/回放"],
    openingMoves: ["直接问为什么", "先把观众可能看错的点说出来", "用一句话说明看这球的条件"],
    voiceoverMoves: ["问题", "普通话解释规则/原因", "把答案落到动作", "给观众一个判断句"],
    topicShapes: ["为什么这个动作会让全场吵起来？", "先别急着站队，这一下到底算不算犯规？"]
  },
  visible_incident: {
    label: "可见瞬间反转型",
    narrationMode: "narrative_voiceover",
    defaultDifficulty: "medium",
    bestFor: ["门将失误", "拒绝下场", "回放后改观", "一次反击或庆祝动作"],
    avoidWhen: ["没有主镜头", "只能靠文案硬讲", "素材全是新闻图"],
    evidenceRequired: ["一个动作", "一次回放/慢镜头/原声变化", "后果或误会"],
    openingMoves: ["从动作开始", "说第一眼容易看错", "把后果压到第二句"],
    voiceoverMoves: ["动作", "第一眼判断", "回放改写", "谁被误会/谁要背锅"],
    topicShapes: ["第一眼都以为稳了，慢镜头出来才知道哪里不对", "一个低级动作，把全队辛苦拼来的希望送走"]
  },
  human_relationship: {
    label: "人物关系揭示型",
    narrationMode: "narrative_voiceover",
    defaultDifficulty: "low",
    bestFor: ["球星和球迷", "旧队友/父子/教练关系", "最后一舞", "弱队人物故事"],
    avoidWhen: ["人物关系未经证实", "只有比分没有人", "需要大量历史素材但找不到"],
    evidenceRequired: ["一个人物", "一个反应/对视/拥抱/表情", "一个时间差或旧事实"],
    openingMoves: ["先给相遇/反应", "延迟揭示身份", "用一个年份或旧关系补事实"],
    voiceoverMoves: ["看见人", "揭示关系", "补一个时间事实", "落到情绪余味"],
    topicShapes: ["他看到这个人之后，表情突然变了", "17 年后再相遇，球王先认出的不是对手"]
  },
  star_micro_action: {
    label: "球星微动作型",
    narrationMode: "narrative_voiceover",
    defaultDifficulty: "medium",
    bestFor: ["梅西/C罗/姆巴佩/哈兰德", "压力与衰老", "队长责任", "成人礼"],
    avoidWhen: ["只想列荣誉", "没有球星特写", "素材只剩远景"],
    evidenceRequired: ["一个球星", "一个触球/助跑/回头/摊手/回追", "一句为什么这个动作能说明问题"],
    openingMoves: ["别写履历，先看动作", "把流量名字落成一个镜头", "用动作解释压力"],
    voiceoverMoves: ["球星名字", "动作", "压力解释", "评论区选择"],
    topicShapes: ["C罗那几步助跑，像是在拒绝结局", "亚马尔回头看替补席那一下，比过人更像成人礼"]
  },
  commentary_assist: {
    label: "原声解说辅助型",
    narrationMode: "commentary_assisted",
    defaultDifficulty: "high",
    bestFor: ["新鲜进球", "高能集锦", "真实解说", "绝杀/神扑/帽子戏法"],
    avoidWhen: ["原声不可用", "版权/平台音频风险高", "旁白会抢掉现场情绪"],
    evidenceRequired: ["清晰原声", "比分/球员字幕", "至少一个高能动作"],
    openingMoves: ["标题先定调", "旁白只补一句背景", "让原声承担情绪"],
    voiceoverMoves: ["一句短引入", "原声", "字幕解释", "结果/评论问题"],
    topicShapes: ["原声已经够狠，旁白别抢戏", "这个球只需要给名字和比分，剩下交给现场"]
  },
  subtitle_first: {
    label: "字幕/原声主导型",
    narrationMode: "subtitle_first",
    defaultDifficulty: "high",
    bestFor: ["无口播热梗", "极短名场面", "评论区搬运", "表情包式瞬间"],
    avoidWhen: ["需要完整讲解", "没有强字幕", "画面本身不够懂"],
    evidenceRequired: ["一条强字幕", "一个能停住的瞬间", "无需解释也能懂的情绪"],
    openingMoves: ["大字先打结论", "保留原声/静默", "只加极短说明"],
    voiceoverMoves: ["少说", "停顿", "让字幕和动作负责"],
    topicShapes: ["这一秒不用讲道理，字幕放中间就够了"]
  },
  fact_list: {
    label: "事实盘点型",
    narrationMode: "narrative_voiceover",
    defaultDifficulty: "high",
    bestFor: ["榜单", "历史最佳阵容", "纪录盘点", "门将/红牌合集"],
    avoidWhen: ["没有多素材", "只有一场比赛", "每个事实都需要独立画面"],
    evidenceRequired: ["至少三段不同素材", "每项一个数字或画面", "明确排序或问题"],
    openingMoves: ["用一个反常数字开场", "先问为什么", "不要铺完整榜单"],
    voiceoverMoves: ["问题", "一项事实", "一段画面", "快收束"],
    topicShapes: ["为什么世界杯总能养出一战封神的门将？"]
  }
};

function countBy<T extends Record<string, any>>(items: T[], key: keyof T) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = String(item[key] || "unknown");
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

function topEntries(counts: Record<string, number>, limit = 8) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({ id, count }));
}

function difficultyForCard(card: LearningCard) {
  const title = card.title;
  if (card.class === "live_match_commentary" || card.class === "clip_commentary" || card.class === "silent_or_subtitle_only") return "high";
  if (/榜|最佳|阵容|排名|盘点|有哪些|几位|多少|top|list/i.test(title)) return "high";
  if (/越位|VAR|红牌|点球|犯规|裁判|战术|指令|规则/.test(title)) return "medium";
  if (card.segment_count > 80 || (card.duration_sec ?? 0) > 95) return "high";
  return "medium";
}

function riskFlagsForCard(card: LearningCard) {
  const flags = new Set<string>();
  const title = card.title;
  if (card.class === "live_match_commentary" || card.class === "clip_commentary") flags.add("needs_original_audio");
  if (card.class === "silent_or_subtitle_only") flags.add("subtitle_or_raw_sound_only");
  if (/越位|VAR|红牌|点球|犯规|裁判|战术|指令|规则/.test(title)) flags.add("strict_visual_rule_match");
  if (/榜|最佳|阵容|排名|盘点|有哪些|几位|多少|top|list/i.test(title)) flags.add("multi_asset_fact_list");
  if (card.segment_count > 120) flags.add("long_live_or_full_match_density");
  if (card.char_count < 80) flags.add("too_little_voiceover_to_model");
  return [...flags];
}

async function main() {
  const [cards, segmentStudies, manifest] = await Promise.all([
    readFile(learningCardsPath, "utf8").then((text) => JSON.parse(text) as LearningCard[]),
    readFile(segmentStudyPath, "utf8").then((text) => JSON.parse(text) as SegmentStudy[]),
    readFile(manifestPath, "utf8").then((text) => JSON.parse(text) as Array<{ id: string; has_text: boolean }>)
  ]);

  const usableCards = cards.filter((card) => card.char_count >= 80 && !["silent_or_subtitle_only"].includes(card.class));
  const classes = countBy(cards, "class");
  const openings = countBy(cards, "opening_shape");
  const endings = countBy(cards, "ending_shape");
  const sourceCounts = countBy(cards, "source");
  const functionCounts: Record<string, number> = {};
  const techniqueCounts: Record<string, number> = {};
  for (const study of segmentStudies) {
    for (const segment of study.processed_segments || []) {
      functionCounts[segment.function] = (functionCounts[segment.function] || 0) + 1;
      techniqueCounts[segment.technique] = (techniqueCounts[segment.technique] || 0) + 1;
    }
  }

  const cardsByEngine = new Map<EngineId, LearningCard[]>();
  for (const card of cards) {
    const mapped = engineMap[card.class] || "visible_incident";
    if (!cardsByEngine.has(mapped)) cardsByEngine.set(mapped, []);
    cardsByEngine.get(mapped)!.push(card);
  }
  const factListCards = cards.filter((card) => difficultyForCard(card) === "high" && /榜|最佳|阵容|排名|盘点|有哪些|几位|多少|top|list/i.test(card.title));
  cardsByEngine.set("fact_list", factListCards);

  const engines = Object.entries(engineBlueprints).map(([id, blueprint]) => {
    const engineId = id as EngineId;
    const sampleCards = cardsByEngine.get(engineId) || [];
    const charCounts = sampleCards.map((card) => card.char_count).filter(Boolean);
    const risks = sampleCards.flatMap(riskFlagsForCard);
    return {
      id: engineId,
      ...blueprint,
      sampleCount: sampleCards.length,
      sourceMix: countBy(sampleCards, "source"),
      medianChars: percentile(charCounts, 0.5),
      p80Chars: percentile(charCounts, 0.8),
      riskFlags: topEntries(
        risks.reduce<Record<string, number>>((acc, flag) => {
          acc[flag] = (acc[flag] || 0) + 1;
          return acc;
        }, {}),
        6
      ),
      sampleIds: sampleCards.slice(0, 10).map((card) => card.id)
    };
  });

  const difficultyBuckets = cards.reduce<Record<string, number>>((acc, card) => {
    const key = difficultyForCard(card);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const riskBuckets = cards.flatMap(riskFlagsForCard).reduce<Record<string, number>>((acc, flag) => {
    acc[flag] = (acc[flag] || 0) + 1;
    return acc;
  }, {});
  const profile = {
    generatedAt: new Date().toISOString(),
    evidenceBase: {
      totalVideos: cards.length,
      usableNarratedVideos: usableCards.length,
      fullTranscriptManifest: manifestPath,
      emptyAsrIds: manifest.filter((item) => !item.has_text).map((item) => item.id),
      sourceCounts
    },
    globalSignals: {
      classCounts: topEntries(classes, 12),
      openingCounts: topEntries(openings, 12),
      endingCounts: topEntries(endings, 12),
      segmentFunctionCounts: topEntries(functionCounts, 16),
      segmentTechniqueCounts: topEntries(techniqueCounts, 12),
      medianNarratedChars: percentile(usableCards.map((card) => card.char_count), 0.5),
      p80NarratedChars: percentile(usableCards.map((card) => card.char_count), 0.8)
    },
    engines,
    editDifficulty: {
      buckets: difficultyBuckets,
      riskBuckets,
      hardFilterRules: [
        {
          id: "strict_visual_rule_match",
          label: "规则/战术逐帧匹配",
          defaultAction: "hide_unless_full_match_or_diagram",
          reason: "越位、VAR、战术指令类题必须和画面精确对齐，缺完整比赛或示意图时容易翻车。"
        },
        {
          id: "needs_original_audio",
          label: "强依赖原声解说",
          defaultAction: "route_to_commentary_assisted",
          reason: "实况解说类不是旁白型脚本，强行加解说会抢掉现场情绪。"
        },
        {
          id: "multi_asset_fact_list",
          label: "多素材盘点",
          defaultAction: "lower_topic_score",
          reason: "榜单/盘点需要多段素材逐条对应，自动剪辑成本高。"
        },
        {
          id: "subtitle_or_raw_sound_only",
          label: "字幕/原声主导",
          defaultAction: "route_to_subtitle_first",
          reason: "这类样本靠字幕和原声成立，不适合生成长旁白。"
        }
      ]
    },
    writingRules: {
      dominantShape: "直接问题/可见瞬间 -> 少量背景 -> 解释推进 -> 证据补充 -> 余味或站队",
      lineRhythm: "短句为主，一句一个信息点；60 秒约 10-18 个口播块。",
      prefer: ["具体动作", "人名", "比分/年份/排名只留一个", "回放/原声/表情", "谁被误会或谁要承担后果"],
      avoid: [
        "押一个/前20分钟/谁先急",
        "更重要的是/真正的问题在于/本质上/归根结底",
        "不是X而是Y",
        "客观赛前分析",
        "把剪辑思路念给观众听"
      ]
    }
  };

  await mkdir(path.dirname(outputJsonPath), { recursive: true });
  await mkdir(path.dirname(outputDocPath), { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await writeFile(outputDocPath, buildDoc(profile), "utf8");
  console.log(JSON.stringify({ outputJsonPath, outputDocPath, engines: engines.length, videos: cards.length }, null, 2));
}

function buildDoc(profile: any) {
  const engineRows = profile.engines
    .map(
      (engine: any) =>
        `| ${engine.label} | ${engine.sampleCount} | ${engine.narrationMode} | ${engine.defaultDifficulty} | ${engine.evidenceRequired.join(" / ")} |`
    )
    .join("\n");
  const classRows = profile.globalSignals.classCounts.map((item: any) => `| ${item.id} | ${item.count} |`).join("\n");
  const riskRows = profile.editDifficulty.hardFilterRules
    .map((item: any) => `| ${item.label} | ${item.defaultAction} | ${item.reason} |`)
    .join("\n");
  return `# 完整旁白风格画像

生成时间：${profile.generatedAt}

这份画像来自完整旁白文件，不是标题摘录。完整原文仍保存在 \`docs/benchmark-full-transcripts/\`，这里仅沉淀可迁移的写作机制、剪辑难度和生成约束。

## 样本概况

- 视频总数：${profile.evidenceBase.totalVideos}
- 可用于旁白建模：${profile.evidenceBase.usableNarratedVideos}
- YouTube：${profile.evidenceBase.sourceCounts.youtube || 0}
- 小红书：${profile.evidenceBase.sourceCounts.xhs || 0}
- ASR 为空：${profile.evidenceBase.emptyAsrIds.join("、") || "无"}
- 中位旁白字数：${profile.globalSignals.medianNarratedChars}
- 80 分位旁白字数：${profile.globalSignals.p80NarratedChars}

## 类型分布

| 类型 | 数量 |
|---|---:|
${classRows}

## 可调用叙事引擎

| 引擎 | 样本数 | 旁白模式 | 默认剪辑难度 | 必须有的证据 |
|---|---:|---|---|---|
${engineRows}

## 结论

- 对标样本最常见入口是“问题”和“可见瞬间”，不是固定预测句。
- 好旁白先给观众一个想知道的缺口，再补一个事实，不堆资料。
- 小红书样本中有一批原声/字幕主导内容，不能强行改成长旁白。
- 规则解释、实况解说、榜单盘点都要在选题阶段标高难度，没有素材就降权或隐藏。

## 高难度过滤

| 风险 | 默认动作 | 原因 |
|---|---|---|
${riskRows}

## 写作硬规则

- 主形状：${profile.writingRules.dominantShape}
- 节奏：${profile.writingRules.lineRhythm}
- 优先：${profile.writingRules.prefer.join("、")}
- 避免：${profile.writingRules.avoid.join("、")}
`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
