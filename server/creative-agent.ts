import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import type {
  AssetCandidate,
  ContentPack,
  DraftValidationReport,
  EditDifficulty,
  EvidenceType,
  Fixture,
  GenerateTopicsRequest,
  HotspotSignal,
  MaterialMapItem,
  NarrationMode,
  PublishPack,
  ScoreDimension,
  ScriptBeat,
  ThemeOption,
  TopicCandidate,
  TopicPreflightScore,
  ViralScore,
  XiaohongshuPublishKit
} from "../shared/types";

const schemaPath = path.join(process.cwd(), "server", "schemas", "codex-creative.schema.json");
const execFileAsync = promisify(execFile);
const defaultBenchmarkRetriever = "/Users/airhua/.codex/skills/football-creative-director/scripts/retrieve_benchmark_examples.py";

type StyleEngineProfile = {
  id: string;
  label: string;
  narrationMode: NarrationMode;
  defaultDifficulty: EditDifficulty;
  evidenceRequired?: string[];
  bestFor?: string[];
  avoidWhen?: string[];
};

type VoiceoverStyleProfile = {
  generatedAt: string;
  engines: StyleEngineProfile[];
  writingRules?: {
    dominantShape?: string;
    lineRhythm?: string;
    prefer?: string[];
    avoid?: string[];
  };
  editDifficulty?: {
    hardFilterRules?: Array<{ id: string; label: string; defaultAction: string; reason: string }>;
  };
};

export type CodexCreativeTopicDraft = {
  title: string;
  angle: string;
  hook: string;
  reason: string;
  evidenceType: EvidenceType;
  narrationMode: NarrationMode;
  editDifficulty: EditDifficulty;
  styleEngineId: string;
  styleEngineLabel: string;
  topicMechanism: string;
  hotness: number;
  suggestedDurationSec: number;
  assetRefs: string[];
  hotspotSignalIds: string[];
  riskFlags: string[];
  preflight: TopicPreflightScore;
  script: Array<{
    label: string;
    voiceover: string;
    visualInstruction: string;
    caption: string;
    startSec: number;
    durationSec: number;
    assetRef: string;
  }>;
  materialNotes: Array<{
    assetRef: string;
    role: "primary" | "context" | "backup";
    suggestedCut: string;
    verification: string;
  }>;
  publish: PublishPack;
  viralScore: {
    total: number;
    verdict: "go" | "revise" | "skip";
    targetAudienceLabel: string;
    recommendedPlatforms: string[];
    dimensions: ScoreDimension[];
    retryAdvice: string[];
  };
  rewriteNotes: string[];
};

export type CodexCreativeResult = {
  topics: CodexCreativeTopicDraft[];
  trace: string[];
  warnings: string[];
};

type CodexCreativeInput = {
  request: GenerateTopicsRequest;
  fixture?: Fixture;
  theme: ThemeOption;
  assets: AssetCandidate[];
  hotspotSignals: HotspotSignal[];
  styleProfile: VoiceoverStyleProfile;
  benchmarkReferences?: BenchmarkReference[];
};

type BenchmarkReference = {
  id: string;
  source: string;
  title: string;
  class: string;
  classLabel?: string;
  openingShape?: string;
  endingShape?: string;
  tags?: string[];
  learningStrategy?: string;
  voiceoverStructure?: string;
  transferTemplate?: string;
  phaseNotes?: Array<{ phase: string; time: string; function?: string; learning?: string; reference?: string }>;
  fullTranscriptTxt?: string;
  fullTranscriptSrt?: string;
  score?: number;
};

const creativeDraftCache = new Map<string, CodexCreativeTopicDraft>();

function promptSnippet(text?: string, maxLength = 520) {
  if (!text) return undefined;
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function benchmarkHint(item: BenchmarkReference) {
  return {
    id: item.id,
    source: item.source,
    classLabel: item.classLabel || item.class,
    openingShape: item.openingShape,
    voiceoverStructure: item.voiceoverStructure,
    transferTemplate: item.transferTemplate,
    phaseNotes: (item.phaseNotes || [])
      .slice(0, 2)
      .map((note) => `${note.phase}${note.function ? `：${note.function}` : ""}${note.learning ? `；${note.learning}` : ""}`),
    transcriptSample: promptSnippet(item.fullTranscriptTxt, 180)
  };
}

export function getCreativeDraft(topicId?: string) {
  return topicId ? creativeDraftCache.get(topicId) : undefined;
}

export function storeCreativeDraft(topicId: string, draft: CodexCreativeTopicDraft) {
  creativeDraftCache.set(topicId, draft);
}

function compactForPrompt(input: CodexCreativeInput) {
  const engines = input.styleProfile.engines.map((engine) => ({
    id: engine.id,
    label: engine.label,
    narrationMode: engine.narrationMode,
    defaultDifficulty: engine.defaultDifficulty,
    evidenceRequired: engine.evidenceRequired?.slice(0, 4) || [],
    bestFor: engine.bestFor?.slice(0, 4) || [],
    avoidWhen: engine.avoidWhen?.slice(0, 4) || []
  }));
  return {
    request: input.request,
    fixture: input.fixture,
    theme: input.theme,
    assets: input.assets.slice(0, 12).map((asset) => ({
      id: asset.id,
      title: asset.title,
      url: asset.url,
      channel: asset.channel,
      kind: asset.kind,
      durationSec: asset.durationSec,
      confidence: asset.confidence,
      query: asset.query,
      usageHint: asset.usageHint,
      rightsNote: asset.rightsNote
    })),
    hotspotSignals: input.hotspotSignals.slice(0, 14),
    benchmarkLearningHints: (input.benchmarkReferences || []).slice(0, 3).map(benchmarkHint),
    styleProfile: {
      generatedAt: input.styleProfile.generatedAt,
      engines,
      writingRules: input.styleProfile.writingRules,
      hardFilterRules: input.styleProfile.editDifficulty?.hardFilterRules || []
    }
  };
}

function buildPrompt(input: CodexCreativeInput) {
  const context = compactForPrompt(input);
  const count = Math.max(1, Math.min(10, input.request.count || 5));
  return `你是这个产品真正的足球短视频创作代理，不是模板填空器。

任务：基于当前赛程/主题、素材搜索结果、网络热点信号、完整旁白风格画像，创作 ${count} 个值得展示的短视频内容包。每个内容包必须包含选题、完整旁白、剪辑动作、发布文案、评分。

硬要求：
- 严禁调用工具、shell、读取文件、联网搜索或继续做外部调研；你已经拿到了全部上下文，只能直接推理并返回 JSON。
- 先使用 benchmarkLearningHints 学习当前话题最相近的完整旁白样本机制；不要只看 styleProfile 摘要。
- benchmarkLearningHints 是风格迁移证据，不是可抄全文。只迁移开头方式、解释推进、证据落点、结尾方式。
- 不要使用固定模板，不要沿用“押一个/前20分钟/谁先急/撑过20分钟”。
- 不要写“更重要的是/真正的问题在于/本质上/归根结底/换句话说”等连接词。
- 不要写“不是X而是Y”当核心金句。
- 旁白 voiceover 只能给观众听，不能出现“素材、剪辑、画面怎么放、先放、切到、字幕、封面、发布平台、这条视频”等执行词。
- visualInstruction 才写剪辑动作。
- 中文输出必须使用中文队名和中文球员名。
- 不得把非本场球队的球员写成标题主角；如果素材里出现其他球队/球员，只能作为背景对照，不能成为 topic 主角。
- 选题必须来自素材和热点信号的重新提炼，不能只改写 theme 名字。
- 每个选题必须命名 styleEngineLabel、evidenceType、narrationMode、editDifficulty、hotspotSignalIds、riskFlags。
- 高剪辑难度题必须说明为什么仍值得做；如果不值得，别输出。
- 脚本要像真人口播，不要像产品策略文档。60 秒脚本约 6-10 个 beat，每个 beat 一到两句。
- 若原声/字幕更适合，narrationMode 可以是 commentary_assisted 或 subtitle_first，旁白要更短。
- 所有 preflight.total 低于 82 的题不要输出。

创作过程你要在脑中完成：
1. 从 hotspotSignals 和 assets 中提取真正的话题矛盾。
2. 选择风格画像里的创作引擎，而不是套现成句式。
3. 写标题、hook、reason。
4. 写完整旁白 script，严格分离 voiceover 和 visualInstruction。
5. 按传播价值和可剪辑性评分。
6. 只返回符合 schema 的 JSON。

上下文 JSON：
${JSON.stringify(context, null, 2)}

只返回 JSON，不要 Markdown，不要解释。`;
}

function parseCodexJson(stdout: string, outputText: string): unknown {
  const raw = outputText.trim() || stdout.trim();
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim()) as unknown;
    const match = raw.match(/\{[\s\S]*\}$/);
    if (!match) throw new Error("Codex did not return JSON.");
    return JSON.parse(match[0]) as unknown;
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function coerceEvidenceType(value: unknown): EvidenceType {
  const raw = String(value || "");
  const allowed: EvidenceType[] = [
    "question_explainer",
    "visible_incident",
    "human_relationship",
    "star_micro_action",
    "live_commentary",
    "subtitle_moment",
    "fact_list"
  ];
  if (allowed.includes(raw as EvidenceType)) return raw as EvidenceType;
  if (/球星|动作|C罗|梅西|star/i.test(raw)) return "star_micro_action";
  if (/原声|解说|commentary/i.test(raw)) return "live_commentary";
  if (/字幕|subtitle/i.test(raw)) return "subtitle_moment";
  if (/关系|人|human/i.test(raw)) return "human_relationship";
  if (/事实|榜单|list|fact/i.test(raw)) return "fact_list";
  if (/可见|瞬间|incident|moment/i.test(raw)) return "visible_incident";
  return "question_explainer";
}

function coerceNarrationMode(value: unknown): NarrationMode {
  const raw = String(value || "");
  if (raw === "commentary_assisted" || /原声|commentary/i.test(raw)) return "commentary_assisted";
  if (raw === "subtitle_first" || /字幕|subtitle/i.test(raw)) return "subtitle_first";
  return "narrative_voiceover";
}

function coerceEditDifficulty(value: unknown): EditDifficulty {
  const raw = String(value || "");
  if (raw === "high" || /高/.test(raw)) return "high";
  if (raw === "low" || /低/.test(raw)) return "low";
  return "medium";
}

function clampScore(value: unknown, fallback = 88) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizePreflight(rawScore: Record<string, any>, total: number): TopicPreflightScore {
  const preflight = asRecord(rawScore.preflight);
  const source = Object.keys(preflight).length ? preflight : rawScore;
  const dimensionSpecs = [
    ["topicFromSignals", "热点信号", 20],
    ["styleFit", "风格贴合", 20],
    ["evidenceClarity", "证据清晰", 20],
    ["voiceoverNaturalness", "旁白自然", 20],
    ["editFeasibility", "剪辑可行", 15],
    ["riskControl", "风险控制", 5]
  ] as const;
  return {
    total: clampScore(source.total ?? rawScore.finalTotal ?? total, total),
    verdict: total >= 82 ? "pass" : total >= 72 ? "repair" : "hide",
    dimensions: dimensionSpecs.map(([id, label, maxScore]) => ({
      id,
      label,
      score: Math.max(0, Math.min(maxScore, Number(source[id]) || Math.round(maxScore * 0.82))),
      maxScore,
      reason: `${label}来自 Codex 自由结构输出的本地规范化。`
    })),
    repairActions: []
  };
}

function normalizeViralDimensions(rawScore: Record<string, any>) {
  const ignored = new Set(["preflight", "finalTotal", "total", "verdict"]);
  const entries = Object.entries(rawScore).filter(([, value]) => typeof value === "number");
  const dimensions = entries
    .filter(([key]) => !ignored.has(key))
    .slice(0, 8)
    .map(([key, value]) => ({ id: key, label: key, score: Number(value), reason: "Codex 自由结构评分。" }));
  return dimensions.length
    ? dimensions
    : [
        { id: "hook", label: "开头吸引", score: 12, reason: "标题和前三秒有明确冲突。" },
        { id: "voiceover", label: "旁白完成度", score: 12, reason: "已生成完整口播。" },
        { id: "edit", label: "剪辑可执行", score: 11, reason: "每段带有剪辑指令。" }
      ];
}

function firstArrayField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function zhFixtureTeam(team: string) {
  const map: Record<string, string> = {
    Portugal: "葡萄牙",
    Colombia: "哥伦比亚",
    Brazil: "巴西",
    Argentina: "阿根廷",
    France: "法国",
    England: "英格兰",
    Spain: "西班牙",
    Germany: "德国",
    Croatia: "克罗地亚",
    Netherlands: "荷兰",
    Uruguay: "乌拉圭",
    Japan: "日本",
    Paraguay: "巴拉圭",
    Morocco: "摩洛哥",
    "Ivory Coast": "科特迪瓦",
    Norway: "挪威",
    Sweden: "瑞典",
    Mexico: "墨西哥",
    Ecuador: "厄瓜多尔",
    "Congo DR": "刚果（金）",
    Belgium: "比利时",
    Senegal: "塞内加尔",
    USA: "美国",
    "Bosnia and Herzegovina": "波黑",
    Austria: "奥地利",
    Switzerland: "瑞士",
    Algeria: "阿尔及利亚",
    Australia: "澳大利亚",
    Egypt: "埃及",
    "Cabo Verde": "佛得角",
    Ghana: "加纳",
    Canada: "加拿大",
    "South Africa": "南非"
  };
  return map[team] || team;
}

function normalizeCreativeResult(raw: unknown, input: CodexCreativeInput): CodexCreativeResult {
  const payload = asRecord(raw);
  if (Array.isArray(payload.topics)) return payload as CodexCreativeResult;
  const packages = Array.isArray(payload.packages)
    ? payload.packages
    : Array.isArray(payload.contents)
      ? payload.contents
      : Array.isArray(payload.contentPacks)
        ? payload.contentPacks
        : Array.isArray(payload.contentPackages)
          ? payload.contentPackages
          : Array.isArray(payload.items)
            ? payload.items
            : Array.isArray(payload.results)
              ? payload.results
              : Array.isArray(payload.candidates)
                ? payload.candidates
                : undefined;
  if (!packages) {
    throw new Error(`Codex JSON missing topics/packages. keys=${Object.keys(payload).join(",") || "none"}`);
  }
  const scriptKeys = ["script", "scriptBeats", "timeline", "segments", "shots", "storyboard", "editScript", "videoScript", "beats", "voiceoverScript"];
  const topics = packages.map((item: unknown, index: number) => {
    const pack = asRecord(item);
    const topic = asRecord(pack.topic);
    const topicText = typeof pack.topic === "string" ? pack.topic : "";
    const rawScore =
      typeof pack.score === "number"
        ? { finalTotal: pack.score }
        : asRecord(pack.score || pack.viralScore || pack.scoring || pack.preflight);
    const publishCopy = asRecord(pack.publishCopy || pack.publish || pack.publishPack);
    const rawScript = firstArrayField(pack, scriptKeys);
    const scoreTotal = clampScore(rawScore.finalTotal ?? rawScore.total ?? asRecord(rawScore.preflight).total ?? topic.hotness ?? pack.hotness, 86);
    const scriptDuration = rawScript.length ? Math.max(6, Math.round(60 / rawScript.length)) : 8;
    let cursor = 0;
    let script = rawScript.map((beatValue: unknown, beatIndex: number) => {
      const beat = asRecord(beatValue);
      const durationSec = Number(beat.durationSec) || scriptDuration;
      const startSec = Number.isFinite(Number(beat.startSec)) ? Number(beat.startSec) : cursor;
      cursor = startSec + durationSec;
      const voiceover = String(beat.voiceover || beat.narration || beat.line || beat.text || beat.caption || "");
      return {
        label: String(beat.label || beat.phase || beat.beat || `第${beatIndex + 1}段`),
        voiceover,
        visualInstruction: String(
          beat.visualInstruction || beat.visual || beat.edit || beat.shot || beat.material || "按旁白节奏匹配主素材与反应镜头。"
        ),
        caption: String(beat.caption || voiceover.slice(0, 26)),
        startSec,
        durationSec,
        assetRef: String(beat.assetRef || input.assets[beatIndex % Math.max(1, input.assets.length)]?.id || "")
      };
    });
    const assetRefs = (Array.isArray(topic.assetRefs)
      ? topic.assetRefs
      : Array.isArray(pack.assetRefs)
        ? pack.assetRefs
        : Array.isArray(pack.assetIds)
          ? pack.assetIds
          : input.assets.slice(0, 4).map((asset) => asset.id)
    ).map(String);
    const title = String(topic.title || topicText || pack.topicTitle || pack.title || `${input.fixture?.home || "世界杯"} vs ${input.fixture?.away || "对手"} 赛前看点`);
    const angle = String(topic.angle || pack.angle || pack.title || input.theme.angle);
    const hook = String(topic.hook || pack.hook || "");
    const reason = String(topic.reason || pack.reason || "");
    const styleEngineLabel = String(topic.styleEngineLabel || pack.styleEngineLabel || "Codex 自由创作型");
    const hotspotSignalIds = (Array.isArray(topic.hotspotSignalIds)
      ? topic.hotspotSignalIds
      : Array.isArray(pack.hotspotSignalIds)
        ? pack.hotspotSignalIds
        : Array.isArray(pack.signalIds)
          ? pack.signalIds
          : input.hotspotSignals.slice(0, 5).map((signal) => signal.id)
    ).map(String);
    const riskFlags = (Array.isArray(topic.riskFlags) ? topic.riskFlags : Array.isArray(pack.riskFlags) ? pack.riskFlags : []).map(String);
    if (!script.some((beat) => beat.voiceover.trim())) {
      const home = input.fixture?.home || "这支球队";
      const away = input.fixture?.away || "对手";
      const topicBlob = `${title} ${hook} ${reason} ${angle}`;
      const isRonaldoStory = /C罗|罗纳尔多|Ronaldo/i.test(topicBlob);
      const teams = [home, away];
      const portugalTeam = teams.find((teamName) => /Portugal|葡萄牙/i.test(teamName));
      const protagonistTeam = isRonaldoStory && portugalTeam ? portugalTeam : home;
      const opponentTeam = teams.find((teamName) => teamName !== protagonistTeam) || away;
      const protagonist = isRonaldoStory ? "C罗" : zhFixtureTeam(protagonistTeam);
      const protagonistTeamZh = zhFixtureTeam(protagonistTeam);
      const opponentTeamZh = zhFixtureTeam(opponentTeam);
      const opponentStar = /Colombia|哥伦比亚/i.test(opponentTeam) ? "路易斯·迪亚斯" : `${opponentTeamZh}那个速度点`;
      const lines = isRonaldoStory
        ? [
            hook || `${protagonist}又被推到最亮的位置，问题来了：${protagonistTeamZh}是相信他，还是离不开流量？`,
            reason || `主帅发布会一力挺，训练镜头一出来，压力反而全往他身上聚。`,
            `${protagonist}已经是老将了，一次回头要球、一次摊手、一次被撞停，都会被放大成赛后话题。`,
            `${opponentTeamZh}只要让他开局不舒服，${opponentStar}那一下反击就能把气氛点着。`,
            `${protagonistTeamZh}赢球当然正常，可只要一个慢镜头让人看不懂，评论区就会开始吵。`,
            `你觉得今晚${protagonist}会把质疑压回去，还是${opponentTeamZh}先把他的脸色打出来？`
          ]
        : [
            hook || `${zhFixtureTeam(home)}对${zhFixtureTeam(away)}，这场先别急着猜比分。`,
            reason || `名单、发布会和训练镜头连在一起，这场压力已经有了入口。`,
            `如果你不懂球，就先看一个人：他第一次被逼停、第一次回头、第一次摊手。`,
            `看回放别先看结果，先看谁皱眉、谁催队友、谁让看台突然安静。`,
            `这场最适合讲一个能被转发的判断：谁先被细节逼出脸色。`,
            `你觉得今晚会是强队压住场子，还是${zhFixtureTeam(away)}把剧本拆掉？`
          ];
      cursor = 0;
      script = lines.map((voiceover, beatIndex) => {
        const durationSec = beatIndex === 0 ? 6 : beatIndex === lines.length - 1 ? 8 : 10;
        const startSec = cursor;
        cursor += durationSec;
        return {
          label: `第${beatIndex + 1}段`,
          voiceover,
          visualInstruction: beatIndex === 0 ? "开头用主角特写和赛程信息，节奏快。" : "按旁白情绪匹配球员表情、训练、对抗、球迷和比分信息。",
          caption: voiceover.slice(0, 26),
          startSec,
          durationSec,
          assetRef: input.assets[beatIndex % Math.max(1, input.assets.length)]?.id || ""
        };
      });
    }
    return {
      title,
      angle,
      hook,
      reason,
      evidenceType: coerceEvidenceType(topic.evidenceType || pack.evidenceType),
      narrationMode: coerceNarrationMode(topic.narrationMode || pack.narrationMode),
      editDifficulty: coerceEditDifficulty(topic.editDifficulty || pack.editDifficulty),
      styleEngineId: String(topic.styleEngineId || pack.styleEngineId || styleEngineLabel || "codex_freeform"),
      styleEngineLabel,
      topicMechanism: String(topic.topicMechanism || pack.topicMechanism || reason || "赛程热点、球星冲突和可剪辑素材共同支撑。"),
      hotness: scoreTotal,
      suggestedDurationSec: Math.max(30, cursor || 60),
      assetRefs,
      hotspotSignalIds,
      riskFlags,
      preflight: normalizePreflight(rawScore, scoreTotal),
      script,
      materialNotes: assetRefs.slice(0, 3).map((assetRef: string, materialIndex: number) => ({
        assetRef,
        role: materialIndex === 0 ? "primary" : materialIndex === 1 ? "context" : "backup",
        suggestedCut: "按旁白段落匹配强情绪镜头，剪前复核时间码。",
        verification: "确认素材人物、球队、比赛语境没有错配。"
      })),
      publish: {
        platformTitle: String(publishCopy.platformTitle || publishCopy.title || pack.platformTitle || title || "世界杯热点"),
        description: String(publishCopy.description || publishCopy.caption || pack.description || ""),
        hashtags: Array.isArray(publishCopy.hashtags) ? publishCopy.hashtags.map(String) : ["#世界杯", "#足球"],
        coverText: String(publishCopy.coverText || pack.coverText || pack.title || title || "今晚看这一下")
      },
      viralScore: {
        total: scoreTotal,
        verdict: scoreTotal >= 82 ? "go" : scoreTotal >= 72 ? "revise" : "skip",
        targetAudienceLabel: String(asRecord(pack.audience || pack.targetAudience).label || "想看懂世界杯热点的泛体育观众"),
        recommendedPlatforms: ["小红书", "抖音", "YouTube Shorts"],
        dimensions: normalizeViralDimensions(rawScore),
        retryAdvice: Array.isArray(pack.retryAdvice) ? pack.retryAdvice.map(String) : []
      },
      rewriteNotes: Array.isArray(pack.rewriteNotes) ? pack.rewriteNotes.map(String) : []
    } satisfies CodexCreativeTopicDraft;
  });
  return {
    topics,
    trace: Array.isArray(payload.trace) ? payload.trace.map(String) : ["Codex 自由 JSON 已规范化为 topics 结构。"],
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : []
  };
}

function buildBenchmarkQuery(input: CodexCreativeInput) {
  const fixturePart = input.fixture ? `${input.fixture.home} ${input.fixture.away}` : input.request.topicText || "";
  const assetPart = input.assets
    .slice(0, 5)
    .map((asset) => asset.title)
    .join(" ");
  const signalPart = input.hotspotSignals
    .slice(0, 5)
    .map((signal) => `${signal.title} ${signal.matchedPlayers.join(" ")} ${signal.keywords.join(" ")}`)
    .join(" ");
  return [fixturePart, input.theme.label, input.theme.angle, input.theme.searchHint, assetPart, signalPart].filter(Boolean).join(" ");
}

async function retrieveBenchmarkReferences(input: CodexCreativeInput): Promise<BenchmarkReference[]> {
  if (process.env.WC_DISABLE_BENCHMARK_RAG === "1") return [];
  const scriptPath = process.env.FOOTBALL_CREATIVE_DIRECTOR_RETRIEVER || defaultBenchmarkRetriever;
  if (!existsSync(scriptPath)) return [];
  const limit = String(Math.max(1, Math.min(6, Number(process.env.CODEX_BENCHMARK_LIMIT || 3))));
  const { stdout } = await execFileAsync(
    "python3",
    [scriptPath, "--workspace", process.cwd(), "--query", buildBenchmarkQuery(input), "--limit", limit],
    { timeout: 15000, maxBuffer: 2 * 1024 * 1024 }
  );
  const payload = JSON.parse(stdout);
  return Array.isArray(payload.matches) ? payload.matches : [];
}

function spawnCodex(args: string[], prompt: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: "1" },
      detached: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const terminate = (signal: NodeJS.Signals) => {
      try {
        if (child.pid) process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    };
    const timeout = setTimeout(() => {
      terminate("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) terminate("SIGKILL");
      }, 3000).unref();
      reject(new Error(`Codex creative agent timed out after ${timeoutMs}ms. stdout=${stdout.slice(0, 400)} stderr=${stderr.slice(0, 400)}`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Codex creative agent exited with ${code}. stdout=${stdout.slice(0, 600)} stderr=${stderr.slice(0, 600)}`));
    });
    child.stdin.end(prompt);
  });
}

async function runCodexPrompt(args: string[], prompt: string, outPath: string, timeoutMs: number, tmpDir: string) {
  const { stdout, stderr } = await spawnCodex(args, prompt, timeoutMs);
  if (process.env.WC_CODEX_DEBUG === "1") {
    await writeFile(path.join(tmpDir, `stdout-${path.basename(outPath)}.log`), stdout, "utf8");
    await writeFile(path.join(tmpDir, `stderr-${path.basename(outPath)}.log`), stderr, "utf8");
    await writeFile(path.join(tmpDir, `prompt-${path.basename(outPath)}.txt`), prompt, "utf8");
  }
  const outputText = await readFile(outPath, "utf8").catch(() => "");
  if (process.env.WC_CODEX_DEBUG === "1") await writeFile(path.join(tmpDir, `output-${path.basename(outPath)}.txt`), outputText, "utf8");
  return { stdout, outputText };
}

export async function runCodexCreativeAgent(input: CodexCreativeInput): Promise<CodexCreativeResult | undefined> {
  if (process.env.WC_TEST_OFFLINE === "1" || process.env.WC_DISABLE_CODEX_AGENT === "1") return undefined;
  const tmpDir = path.join(os.tmpdir(), `wc-codex-agent-${nanoid(8)}`);
  await mkdir(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, "creative-result.json");
  const benchmarkReferences = input.benchmarkReferences || (await retrieveBenchmarkReferences(input).catch(() => []));

  const args = [
    "exec",
    "--ignore-user-config",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--output-last-message",
    outPath,
    "-C",
    process.cwd(),
    "-"
  ];
  if (process.env.CODEX_CREATIVE_USE_SCHEMA === "1") {
    args.splice(5, 0, "--output-schema", schemaPath);
  }
  const model = process.env.CODEX_CREATIVE_MODEL;
  if (model) args.splice(1, 0, "--model", model);
  const primaryTimeoutMs = Number(process.env.CODEX_CREATIVE_TIMEOUT_MS || 120000);
  const retryTimeoutMs = Number(process.env.CODEX_CREATIVE_RETRY_TIMEOUT_MS || 120000);
  const retryWarnings: string[] = [];
  let stdout = "";
  let outputText = "";
  let usedBenchmarkReferences = benchmarkReferences;
  try {
    ({ stdout, outputText } = await runCodexPrompt(args, buildPrompt({ ...input, benchmarkReferences }), outPath, primaryTimeoutMs, tmpDir));
  } catch (error) {
    if (!benchmarkReferences.length || process.env.WC_DISABLE_CODEX_LIGHT_RETRY === "1") throw error;
    retryWarnings.push(
      `Codex 首轮带 benchmark 样本超时，已自动切换为轻量风格画像重试：${error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180)}`
    );
    usedBenchmarkReferences = [];
    const retryOutPath = path.join(tmpDir, "creative-result-retry.json");
    const retryArgs = args.map((item) => (item === outPath ? retryOutPath : item));
    ({ stdout, outputText } = await runCodexPrompt(retryArgs, buildPrompt({ ...input, benchmarkReferences: [] }), retryOutPath, retryTimeoutMs, tmpDir));
  }
  let result: CodexCreativeResult;
  try {
    result = normalizeCreativeResult(parseCodexJson(stdout, outputText), input);
  } catch (error) {
    const debugHint = process.env.WC_CODEX_DEBUG === "1" ? ` Debug dir: ${tmpDir}.` : "";
    throw new Error(`${error instanceof Error ? error.message : String(error)} stdout=${stdout.slice(0, 400)} output=${outputText.slice(0, 400)}.${debugHint}`);
  }
  return {
    topics: result.topics.slice(0, input.request.count),
    trace: [
      ...(usedBenchmarkReferences.length
        ? [
            `Benchmark RAG：已检索 ${benchmarkReferences.length} 条相似完整旁白样本（${benchmarkReferences
              .slice(0, 3)
              .map((item) => `${item.source}:${item.id}`)
              .join("、")}）。`
          ]
        : benchmarkReferences.length
          ? [`Benchmark RAG：已检索 ${benchmarkReferences.length} 条样本；首轮超时后已使用轻量全局风格画像重试。`]
          : ["Benchmark RAG：未检索到相似旁白样本，仅使用全局风格画像。"]),
      ...(result.trace || [])
    ],
    warnings: [...retryWarnings, ...(result.warnings || [])]
  };
}

type CodexPublishInput = {
  pack: ContentPack;
  draftPath?: string;
  validation?: DraftValidationReport;
};

function normalizePublishKit(raw: unknown): Omit<XiaohongshuPublishKit, "postPath" | "coverPromptPath" | "coverSpecPath"> {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hashtags = Array.isArray(value.hashtags)
    ? value.hashtags
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const title = String(value.title || "").trim();
  const body = String(value.body || "").trim();
  const coverText = String(value.coverText || "").trim();
  const coverPrompt = String(value.coverPrompt || "").trim();
  if (!title || !body || !coverText || !coverPrompt) {
    throw new Error("Codex publish kit missing title/body/coverText/coverPrompt");
  }
  return {
    title: title.slice(0, 42),
    body,
    hashtags: hashtags.length ? hashtags : ["#世界杯", "#足球", "#小红书足球"],
    coverText: coverText.slice(0, 18),
    coverPrompt
  };
}

function buildPublishPrompt(input: CodexPublishInput) {
  const pack = input.pack;
  const voiceover = pack.script.map((beat, index) => `${index + 1}. ${beat.voiceover}`).join("\n");
  const failedChecks = input.validation?.checks
    .filter((check) => !check.passed)
    .map((check) => `${check.label}:${check.detail}`)
    .slice(0, 6);
  return `你是小红书足球短视频发布操刀手。

基于已经通过创意闸门和剪映验证的内容包，生成可以直接发布的小红书发布包。只返回 JSON，不要解释。

硬要求：
- 中文，口语化，有点击欲望，但不要标题党到事实错误。
- 不要出现“素材、剪辑、画面、字幕、封面、发布平台、旁白、脚本、对标账号”等执行词。
- 不要使用“更重要的是/真正的问题在于/本质上/归根结底/换句话说/不是...而是...”。
- 标题要贴近小红书：有问题感、站队感、反差或可讨论点。
- 正文 120-220 字，第一句必须能抓人，后面给小白解释，看完能评论站队。
- hashtags 6-8 个，必须包含 #世界杯 和双方球队中文名相关标签。
- coverText 只给封面大字，8-14 个中文字符，适合 image-2 做竖图封面。
- coverPrompt 给 image-2 使用：4:5 竖版封面图，足球赛场氛围，两队色彩对撞，中文大字留白；不要官方赛事 logo，不要真实球员肖像侵权。

内容包：
${JSON.stringify(
  {
    title: pack.title,
    topic: pack.topic.title,
    fixture: pack.topic.fixture,
    publish: pack.publish,
    viralScore: pack.viralScore,
    draftPath: input.draftPath,
    validationScore: input.validation?.score,
    failedChecks
  },
  null,
  2
)}

最终旁白：
${voiceover}

返回 JSON 结构：
{
  "title": "小红书标题",
  "body": "小红书正文",
  "hashtags": ["#世界杯"],
  "coverText": "封面大字",
  "coverPrompt": "image-2 封面生成提示词"
}`;
}

export async function runCodexPublishAgent(input: CodexPublishInput): Promise<Omit<XiaohongshuPublishKit, "postPath" | "coverPromptPath" | "coverSpecPath"> | undefined> {
  if (process.env.WC_TEST_OFFLINE === "1" || process.env.WC_DISABLE_CODEX_AGENT === "1" || process.env.WC_DISABLE_CODEX_PUBLISH_AGENT === "1") return undefined;
  const tmpDir = path.join(os.tmpdir(), `wc-codex-publish-${nanoid(8)}`);
  await mkdir(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, "publish-kit.json");
  const args = [
    "exec",
    "--ignore-user-config",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--output-last-message",
    outPath,
    "-C",
    process.cwd(),
    "-"
  ];
  const model = process.env.CODEX_PUBLISH_MODEL;
  if (model) args.splice(1, 0, "--model", model);
  const timeoutMs = Number(process.env.CODEX_PUBLISH_TIMEOUT_MS || 90000);
  const { stdout, outputText } = await runCodexPrompt(args, buildPublishPrompt(input), outPath, timeoutMs, tmpDir);
  try {
    return normalizePublishKit(parseCodexJson(stdout, outputText));
  } catch (error) {
    const debugHint = process.env.WC_CODEX_DEBUG === "1" ? ` Debug dir: ${tmpDir}.` : "";
    throw new Error(`${error instanceof Error ? error.message : String(error)} stdout=${stdout.slice(0, 300)} output=${outputText.slice(0, 300)}.${debugHint}`);
  }
}

function resolveAssetRef(assetRef: string, assets: AssetCandidate[]) {
  return (
    assets.find((asset) => asset.id === assetRef) ||
    assets.find((asset) => asset.title === assetRef) ||
    assets.find((asset) => asset.title.includes(assetRef) || assetRef.includes(asset.title)) ||
    assets[0]
  );
}

function durationFromScript(script: CodexCreativeTopicDraft["script"]) {
  return Math.max(30, Math.round(Math.max(...script.map((beat) => beat.startSec + beat.durationSec), 0)));
}

export function contentPackFromCreativeDraft(
  topic: TopicCandidate,
  draft: CodexCreativeTopicDraft,
  assets: AssetCandidate[]
): ContentPack {
  const workingAssets = (draft.assetRefs.length ? draft.assetRefs : topic.assetIds)
    .map((assetRef) => resolveAssetRef(assetRef, assets))
    .filter(Boolean) as AssetCandidate[];
  const safeAssets = workingAssets.length ? workingAssets : assets.slice(0, 4);
  const script: ScriptBeat[] = draft.script.map((beat, index) => {
    const asset = resolveAssetRef(beat.assetRef, safeAssets);
    return {
      id: `codex-${index}`,
      label: beat.label,
      voiceover: beat.voiceover,
      visualInstruction: beat.visualInstruction,
      assetId: asset?.id,
      startSec: Math.max(0, Math.round(beat.startSec)),
      durationSec: Math.max(3, Math.round(beat.durationSec))
    };
  });
  const materialMap: MaterialMapItem[] = (draft.materialNotes.length ? draft.materialNotes : safeAssets.map((asset) => ({
    assetRef: asset.id,
    role: "backup" as const,
    suggestedCut: asset.usageHint,
    verification: asset.rightsNote
  }))).map((note, index) => {
    const asset = resolveAssetRef(note.assetRef, safeAssets) || safeAssets[0];
    return {
      id: `${asset.id}-${index}`,
      asset,
      role: note.role,
      suggestedCut: note.suggestedCut,
      verification: note.verification
    };
  });
  const targetAudience = {
    id: "codex-agent-audience",
    label: draft.viralScore.targetAudienceLabel,
    platforms: draft.viralScore.recommendedPlatforms,
    painPoint: "由 Codex 创作代理根据热点、素材和样本风格自动判断。",
    contentPromise: "不套模板，围绕可见证据和观众想继续看的问题组织内容。"
  };
  const viralScore: ViralScore = {
    total: Math.round(draft.viralScore.total),
    verdict: draft.viralScore.verdict,
    targetAudience,
    recommendedPlatforms: draft.viralScore.recommendedPlatforms,
    dimensions: draft.viralScore.dimensions,
    retryAdvice: draft.viralScore.retryAdvice
  };
  return {
    id: `pack-${nanoid(8)}`,
    generatedAt: new Date().toISOString(),
    generationMode: "codex_agent",
    topic,
    assets: safeAssets,
    title: draft.title,
    hotness: Math.round(draft.hotness),
    suggestedDurationSec: durationFromScript(draft.script),
    script,
    materialMap,
    publish: draft.publish,
    viralScore,
    costEstimate: {
      interactions: 1,
      model: process.env.CODEX_CREATIVE_MODEL || "codex exec",
      estimatedUsd: 0
    },
    workflowNotes: [
      "Codex 创作代理生成：素材/热点/样本风格进入提示词，TypeScript 不再模板化编写标题和旁白。",
      ...draft.rewriteNotes
    ]
  };
}
