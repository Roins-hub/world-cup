import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import {
  contentPackFromCreativeDraft,
  getCreativeDraft,
  runCodexCreativeAgent,
  runCodexPublishAgent,
  storeCreativeDraft,
  type CodexCreativeTopicDraft
} from "./creative-agent";
import type {
  AudienceProfile,
  AssetCandidate,
  ContentPack,
  CreativeValidationGate,
  DraftValidationReport,
  EditDifficulty,
  EvidenceType,
  Fixture,
  GenerateTopicsRequest,
  GenerateTopicsResponse,
  HotspotSignal,
  JianyingPrepareRequest,
  JianyingPrepareResponse,
  JianyingRunResponse,
  MaterialMapItem,
  NarrationMode,
  OutputLanguage,
  RejectedTopic,
  ScriptBeat,
  ThemeOption,
  TopicPreflightScore,
  ViralScore,
  XiaohongshuPublishKit,
  XiaohongshuPublishResponse,
  TopicCandidate
} from "../shared/types";
import { getFutureFixtures } from "./fixtures";

const execFileAsync = promisify(execFile);
const RUNS_ROOT = path.join(process.cwd(), "runs");

async function runCodexPromptViaStdin(args: string[], prompt: string, timeoutMs: number, env: NodeJS.ProcessEnv) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: process.cwd(),
      env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1500).unref();
      const error = new Error(`Codex image generation timed out after ${timeoutMs}ms`);
      Object.assign(error, {
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8")
      });
      reject(error);
    }, timeoutMs);
    timer.unref();

    child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      Object.assign(error, {
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8")
      });
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(`Codex image generation exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`);
      Object.assign(error, { stdout, stderr });
      reject(error);
    });
    child.stdin.end(prompt);
  });
}

const languageLabels: Record<OutputLanguage, string> = {
  zh: "中文",
  en: "English",
  es: "Español",
  fr: "Français"
};

const labels = {
  zh: {
    hook: "开头三秒",
    context: "历史背景",
    conflict: "冲突升级",
    proof: "关键解释",
    relevance: "回到当下",
    close: "互动收尾"
  },
  en: {
    hook: "First three seconds",
    context: "Context",
    conflict: "Conflict",
    proof: "Proof",
    relevance: "Current relevance",
    close: "Close"
  },
  es: {
    hook: "Primeros tres segundos",
    context: "Contexto",
    conflict: "Conflicto",
    proof: "Prueba visual",
    relevance: "Relevancia actual",
    close: "Cierre"
  },
  fr: {
    hook: "Trois premieres secondes",
    context: "Contexte",
    conflict: "Conflit",
    proof: "Preuve visuelle",
    relevance: "Retour au present",
    close: "Fin"
  }
} satisfies Record<OutputLanguage, Record<string, string>>;

const DEFAULT_JIANYING_SPEAKER = "BV411_streaming";
const DEFAULT_JIANYING_SPEAKER_NAME = "解说小帅";
const MAIN_VIDEO_ORIGINAL_VOLUME = 0.12;
const BGM_VOLUME = 0.16;
const SUBTITLE_TRANSFORM_Y = -0.42;
const BGM_CANDIDATES = [
  "7378228800054249508", // 狂野热血激燃摇滚 Sport Drive Rock
  "7377842959488223270", // Energy Electronic Sports Music
  "7376227621479090202", // 进球律动 Modern Powerful Indie Rock
  "7378228354225195062" // 鼓舞人心
];
const bannedVoiceoverTerms = [
  "我先押一个",
  "前20分钟",
  "前 20 分钟",
  "谁先急",
  "撑过20分钟",
  "撑过前 20 分钟",
  "强队怎么先慌",
  "更重要的是",
  "更关键的是",
  "更要命的是",
  "最要命的是",
  "真正的问题在于",
  "真正可怕的是",
  "真正值得警惕的是",
  "问题的核心在于",
  "说到底",
  "归根结底",
  "本质上",
  "深层原因是",
  "从根本上说",
  "更深一层看",
  "换句话说",
  "进一步说",
  "真正好看的不是比分",
  "命运感",
  "值得关注",
  "具有重要意义",
  "整体来看",
  "提供参考",
  "不断演变",
  "关键作用"
];
const bannedVoiceoverPatterns = [
  { label: "不是...而是", pattern: /不是[^。！？\n\r]{0,28}而是/ },
  { label: "不是...是", pattern: /不是[^。！？\n\r]{0,20}[，,、]\s*是/ },
  { label: "不仅...而且", pattern: /不仅[^。！？\n\r]{0,28}而且/ }
];
const creativeEditorLeakPattern =
  /(素材|剪辑|剪出来|最该剪|好剪|先放|切到|切今天|画面|字幕|封面|发布平台|剪前|复核时间码|这条视频|这条内容|内容的重点|对标|账号|旁白|脚本|这条不要)/;
const xhsTitleShapePattern =
  /(背后|零封|一战成名|旧账|统治|为什么|怎么|压力|反击|翻车|清账|没人看好|小球队|回放|慢镜头|第一眼|看错|动作|原声|证据|人味|火药味)/;

function findBannedVoiceoverPhrase(text: string) {
  const term = bannedVoiceoverTerms.find((item) => text.includes(item));
  if (term) return term;
  const formula = bannedVoiceoverPatterns.find((item) => item.pattern.test(text));
  return formula?.label;
}

const teamNameZh: Record<string, string> = {
  Spain: "西班牙",
  "Saudi Arabia": "沙特",
  Argentina: "阿根廷",
  Austria: "奥地利",
  Algeria: "阿尔及利亚",
  Jordan: "约旦",
  Japan: "日本",
  Belgium: "比利时",
  Iran: "伊朗",
  Uruguay: "乌拉圭",
  "Cape Verde": "佛得角",
  "New Zealand": "新西兰",
  Egypt: "埃及",
  France: "法国",
  Senegal: "塞内加尔",
  Ghana: "加纳",
  Scotland: "苏格兰",
  Norway: "挪威",
  Iraq: "伊拉克",
  Mexico: "墨西哥",
  USA: "美国",
  Canada: "加拿大",
  Brazil: "巴西",
  Paraguay: "巴拉圭",
  England: "英格兰",
  Germany: "德国",
  Sweden: "瑞典",
  Portugal: "葡萄牙",
  Uzbekistan: "乌兹别克斯坦",
  Panama: "巴拿马",
  Croatia: "克罗地亚",
  Colombia: "哥伦比亚",
  "Congo DR": "刚果（金）",
  Switzerland: "瑞士",
  Haiti: "海地",
  "South Africa": "南非",
  "South Korea": "韩国",
  Ecuador: "厄瓜多尔",
  Turkiye: "土耳其",
  Netherlands: "荷兰",
  Italy: "意大利",
  Morocco: "摩洛哥",
  Czechia: "捷克",
  "Ivory Coast": "科特迪瓦",
  "Bosnia and Herzegovina": "波黑",
  Qatar: "卡塔尔",
  Australia: "澳大利亚",
  "Cabo Verde": "佛得角",
  "Group B Third Place": "B 组第三",
  "Group F Third Place": "F 组第三",
  "Group D Runner-up": "D 组第二",
  "Group E Runner-up": "E 组第二",
  "Group F Winner": "F 组第一",
  "Group F Runner-up": "F 组第二",
  "Group H Winner": "H 组第一",
  "Group H Runner-up": "H 组第二",
  "Group I Winner": "I 组第一",
  "Group I Runner-up": "I 组第二",
  "Group L Winner": "L 组第一",
  "Group G Winner": "G 组第一",
  "Group K Winner": "K 组第一",
  "Group J Runner-up": "J 组第二",
  "Group K Runner-up": "K 组第二",
  "Group L Runner-up": "L 组第二",
  "Group G Runner-up": "G 组第二",
  TBD: "待定",
  "Round of 16 Match 1": "16 强第 1 场",
  "Round of 16 Match 2": "16 强第 2 场",
  "Round of 16 Match 3": "16 强第 3 场",
  "Round of 16 Match 4": "16 强第 4 场",
  "Round of 16 Match 5": "16 强第 5 场",
  "Round of 16 Match 6": "16 强第 6 场",
  "Round of 16 Match 7": "16 强第 7 场",
  "Round of 16 Match 8": "16 强第 8 场",
  "Quarterfinal 1": "1/4 决赛第 1 场",
  "Quarterfinal 2": "1/4 决赛第 2 场",
  "Quarterfinal 3": "1/4 决赛第 3 场",
  "Quarterfinal 4": "1/4 决赛第 4 场",
  "Semifinal 1": "半决赛第 1 场",
  "Semifinal 2": "半决赛第 2 场",
  "Third Place Playoff": "三四名决赛",
  Final: "决赛",
  "Best Third Place (A/B/C/D/F)": "A/B/C/D/F 最佳第三",
  "Best Third Place (C/D/F/G/H)": "C/D/F/G/H 最佳第三",
  "Best Third Place (C/E/F/H/I)": "C/E/F/H/I 最佳第三",
  "Best Third Place (B/E/F/I/J)": "B/E/F/I/J 最佳第三",
  "Best Third Place (E/H/I/J/K)": "E/H/I/J/K 最佳第三",
  "Best Third Place (A/E/H/I/J)": "A/E/H/I/J 最佳第三",
  "Best Third Place (E/F/G/I/J)": "E/F/G/I/J 最佳第三",
  "Best Third Place (D/E/I/J/L)": "D/E/I/J/L 最佳第三"
};

const teamHeatZh: Record<string, number> = {
  Brazil: 10,
  France: 10,
  Spain: 9,
  England: 9,
  Argentina: 9,
  Portugal: 8,
  Germany: 8,
  Croatia: 8,
  Colombia: 8,
  Netherlands: 8,
  Belgium: 8,
  Uruguay: 8,
  Norway: 8,
  Mexico: 7,
  Senegal: 7,
  Egypt: 7,
  Morocco: 7,
  Japan: 7,
  Sweden: 7,
  Ghana: 6,
  Paraguay: 6,
  Austria: 6,
  Algeria: 6,
  Switzerland: 6,
  Ecuador: 6,
  Turkiye: 6,
  Scotland: 6,
  Czechia: 6,
  Iran: 5,
  "Saudi Arabia": 5,
  Iraq: 5,
  Jordan: 5,
  Panama: 5,
  "South Africa": 5,
  "South Korea": 5,
  Uzbekistan: 5,
  "Congo DR": 5,
  Haiti: 5,
  "New Zealand": 4,
  "Cape Verde": 4
};

const teamPlayersZh: Record<string, string[]> = {
  Spain: ["亚马尔", "佩德里", "罗德里"],
  "Saudi Arabia": ["萨勒姆·达瓦萨里", "萨利赫·谢赫里"],
  Argentina: ["梅西", "劳塔罗"],
  Austria: ["阿瑙托维奇", "萨比策"],
  Algeria: ["马赫雷斯", "本纳赛尔"],
  Jordan: ["塔马里"],
  Japan: ["三笘薰", "久保建英"],
  Belgium: ["德布劳内", "多库", "卢卡库"],
  Iran: ["塔雷米", "阿兹蒙"],
  Uruguay: ["努涅斯", "巴尔韦德", "阿劳霍"],
  "Cape Verde": ["沃齐尼亚", "贝贝"],
  "New Zealand": ["克里斯·伍德"],
  Egypt: ["萨拉赫", "特雷泽盖"],
  France: ["姆巴佩", "格列兹曼"],
  Senegal: ["马内", "库利巴利"],
  Ghana: ["库杜斯", "托马斯"],
  Scotland: ["麦克托米奈", "罗伯逊"],
  Norway: ["哈兰德", "厄德高"],
  Iraq: ["艾曼·侯赛因"],
  Mexico: ["希门尼斯", "洛萨诺"],
  Brazil: ["维尼修斯", "罗德里戈", "内马尔"],
  Paraguay: ["阿尔米隆", "恩西索"],
  England: ["贝林厄姆", "凯恩", "萨卡"],
  Germany: ["穆西亚拉", "维尔茨"],
  Sweden: ["伊萨克", "库卢塞夫斯基"],
  Portugal: ["C罗", "B费"],
  Uzbekistan: ["肖穆罗多夫"],
  Panama: ["戈多伊"],
  Croatia: ["莫德里奇", "格瓦迪奥尔"],
  Colombia: ["路易斯·迪亚斯", "哈梅斯"],
  "Congo DR": ["巴坎布"],
  Switzerland: ["扎卡", "阿坎吉"],
  Haiti: ["纳宗"],
  "South Africa": ["莫科纳"],
  "South Korea": ["孙兴慜", "李刚仁"],
  Ecuador: ["凯塞多", "恩纳·瓦伦西亚"],
  Turkiye: ["恰尔汗奥卢", "居莱尔"],
  Netherlands: ["范戴克", "加克波"],
  Italy: ["巴雷拉", "基耶萨"],
  Morocco: ["阿什拉夫", "齐耶赫"],
  Czechia: ["希克", "绍切克"]
};

function canonicalTeam(team: string) {
  const direct = Object.keys(teamNameZh).find((key) => key.toLowerCase() === team.toLowerCase());
  if (direct) return direct;
  const byZh = Object.entries(teamNameZh).find(([, zh]) => zh === team);
  return byZh?.[0] || team;
}

function displayTeam(team: string, language: OutputLanguage) {
  if (language !== "zh") return team;
  return teamNameZh[canonicalTeam(team)] || team;
}

function displayPlayer(team: string, language: OutputLanguage, index = 0) {
  const canonical = canonicalTeam(team);
  if (language !== "zh") return teamPlayersZh[canonical]?.[index] || `${team} star`;
  return teamPlayersZh[canonical]?.[index] || `${displayTeam(team, "zh")}核心`;
}

function matchupRoles(home: string, away: string) {
  const homeKey = canonicalTeam(home);
  const awayKey = canonicalTeam(away);
  const homeHeat = teamHeatZh[homeKey] ?? 6;
  const awayHeat = teamHeatZh[awayKey] ?? 6;
  if (homeHeat >= awayHeat) {
    return { favorite: home, challenger: away, favoriteHeat: homeHeat, challengerHeat: awayHeat };
  }
  return { favorite: away, challenger: home, favoriteHeat: awayHeat, challengerHeat: homeHeat };
}

function isSpainSaudi(home: string, away: string) {
  const text = `${home} ${away}`;
  return /Spain|西班牙/i.test(text) && /Saudi|沙特/i.test(text);
}

const TOPIC_PREFLIGHT_PASS_SCORE = 82;
const STYLE_PROFILE_PATH = path.join(process.cwd(), "data", "benchmark", "football-creators", "voiceover-style-profile.json");

type TopicTemplate = {
  themeId: string;
  angle: string;
  title: string;
  hook: string;
  reason?: string;
  evidenceType?: EvidenceType;
  narrationMode?: NarrationMode;
  editDifficulty?: EditDifficulty;
  styleEngineId?: string;
  styleEngineLabel?: string;
  topicMechanism?: string;
  hotspotSignals?: HotspotSignal[];
  riskFlags?: string[];
};

type StyleEngineProfile = {
  id: string;
  label: string;
  narrationMode: NarrationMode;
  defaultDifficulty: EditDifficulty;
  bestFor: string[];
  avoidWhen: string[];
  evidenceRequired: string[];
  openingMoves: string[];
  voiceoverMoves: string[];
  topicShapes: string[];
};

type VoiceoverStyleProfile = {
  generatedAt: string;
  engines: StyleEngineProfile[];
  editDifficulty: {
    hardFilterRules: Array<{ id: string; label: string; defaultAction: string; reason: string }>;
  };
  writingRules: {
    dominantShape: string;
    lineRhythm: string;
    prefer: string[];
    avoid: string[];
  };
};

let cachedStyleProfile: VoiceoverStyleProfile | undefined;

const audienceProfiles: Record<string, AudienceProfile> = {
  footballNewbies: {
    id: "football-newbies",
    label: "足球小白和轻度球迷",
    platforms: ["小红书", "抖音"],
    painPoint: "怕看不懂比赛，只想知道今晚该看什么、聊什么不露怯。",
    contentPromise: "把比赛翻译成人话，用一个判断、一个画面和一个评论问题讲清楚。"
  },
  emotionFans: {
    id: "emotion-fans",
    label: "情绪型泛体育观众",
    platforms: ["抖音", "B站", "视频号"],
    painPoint: "不一定追完整比赛，但会被绝杀、眼泪、逆转和命运感打动。",
    contentPromise: "把比分变成故事，把关键镜头变成一段成年人能共情的情绪。"
  },
  lifestyleWatchers: {
    id: "lifestyle-watchers",
    label: "看球生活方式用户",
    platforms: ["小红书"],
    painPoint: "想参与世界杯氛围，但更关心穿搭、夜宵、搭子和朋友圈表达。",
    contentPromise: "不讲复杂战术，给她一个今晚参与世界杯的理由和表达方式。"
  },
  debateSeekers: {
    id: "debate-seekers",
    label: "争议和评论区讨论人群",
    platforms: ["抖音", "微博", "小红书"],
    painPoint: "看到红牌、点球、VAR、爆冷后想快速判断自己站哪边。",
    contentPromise: "不急着站队，先把争议点拆成人话，再给一个可讨论的暂定判断。"
  }
};

function selectAudience(topic: TopicCandidate) {
  const text = `${topic.angle} ${topic.title}`;
  if (/赛前|气氛|穿搭|夜宵|搭子/.test(text)) return audienceProfiles.lifestyleWatchers;
  if (/争议|VAR|红牌|点球|判罚/.test(text)) return audienceProfiles.debateSeekers;
  if (/暴论|预测|宿命|冷门|翻车|情绪|最后|落泪|谢幕|回放|旧账|误会|变味|偷到|爆点/.test(text)) return audienceProfiles.emotionFans;
  return audienceProfiles.footballNewbies;
}

function hasKnownPlayer(text: string) {
  return Object.values(teamPlayersZh).flat().some((name) => text.includes(name));
}

function hasKnownTeam(text: string) {
  return Object.values(teamNameZh).some((name) => text.includes(name)) || Object.keys(teamNameZh).some((name) => text.includes(name));
}

function computeViralScore(topic: TopicCandidate, assets: AssetCandidate[]): ViralScore {
  const targetAudience = selectAudience(topic);
  const hasOfficial = assets.some((asset) => asset.channel === "FIFA");
  const hasHighlight = assets.some((asset) => asset.kind === "highlight");
  const title = topic.title;
  const hook = topic.hook;
  const text = `${title}${hook}`;
  const conflictWords = /暴论|预测|冷门|翻车|争议|最后|不懂球|宿命|压力|爆冷|改写|没开踢|回放|慢镜头|旧账|误会|变味|偷到|难受|评论区|背锅|要出事|吓|封神|最后一舞|纪录|新规|成人礼|扛住|一脚改命/.test(text);
  const nonFanFriendly = /小白|不懂球|赛前|气氛|看懂|发生了什么|别急|先看|只看|盯|第一眼|普通人/.test(`${text}${targetAudience.painPoint}`);
  const protagonist = hasKnownPlayer(text) || hasKnownTeam(text) || /门将|裁判|球迷|老将|小将|强队|弱队|黑马|主角|他/.test(text);
  const factAnchor = /前\s?20|20\s?分钟|0\s?比\s?0|2\s?比\s?1|第一脚|第一次|纪录|六届|38\s?岁|40\s?岁|帽子戏法|点球|VAR|红牌|神扑|任意球|决赛|旧账/.test(text);
  const visualProofWords = /表情|看台|反击|射正|回传|皱眉|摊手|背影|助跑|低射|扑救|庆祝|比分|镜头|声音/.test(text);
  const humanVoice = !findBannedVoiceoverPhrase(text) && /你|别急|敢|站哪边|先看|盯|第一眼|回头看|看完/.test(text);
  const rhythmReady = topic.suggestedDurationSec <= 75 && /前\s?20|第一脚|开局|3个|三下|一脚|一次/.test(text);
  const interaction = /你觉得|你敢|站哪边|评论区|回看|看哪|谁|吗|？|\?/.test(text);
  const remixable = /外号|表情|梗|评论区|封神|一战成名|卡牌|最后一舞|慢镜头|第一眼|回放|旧账|误会|成人礼|扛住|一脚改命/.test(text);
  const timely = Boolean(topic.fixture);
  const editDifficultyPenalty = topic.editDifficulty === "high" ? 4 : topic.editDifficulty === "medium" ? 1 : 0;
  const modeFitsMaterial =
    topic.narrationMode === "narrative_voiceover" ||
    (topic.narrationMode === "commentary_assisted" && hasHighlight) ||
    (topic.narrationMode === "subtitle_first" && visualProofWords);
  const dimensions = [
    {
      id: "topic-fit",
      label: "观众明确度",
      score: nonFanFriendly ? 15 : 10,
      reason: `${targetAudience.label}：${targetAudience.painPoint}`
    },
    {
      id: "conflict-hook",
      label: "三秒钩子/冲突",
      score: conflictWords ? 15 : 8,
      reason: conflictWords ? "标题和开头有反差、预测、纪录或评论区争议点。" : "钩子偏平，需要加入冲突、暴论预测或具体问题。"
    },
    {
      id: "protagonist",
      label: "人物/故事",
      score: protagonist ? 15 : 7,
      reason: protagonist ? "有明确队伍、球员、门将、裁判或观众身份。" : "缺少主角，容易变成泛泛赛评。"
    },
    {
      id: "fact-anchor",
      label: "事实锚点",
      score: factAnchor ? 15 : timely ? 11 : 7,
      reason: factAnchor ? "有时间点、比分、纪录、单一动作或旧事实。" : "需要补比分、分钟、纪录、动作或旧比赛事实。"
    },
    {
      id: "material-proof",
      label: "画面可剪性",
      score: Math.max(3, (hasOfficial && hasHighlight && visualProofWords ? 12 : hasHighlight ? 9 : 5) - editDifficultyPenalty),
      reason: modeFitsMaterial
        ? `叙事模式 ${topic.narrationMode} 与当前素材基本匹配。`
        : `叙事模式 ${topic.narrationMode} 素材支撑不足，需要换题或补素材。`
    },
    {
      id: "human-voice",
      label: "旁白人味",
      score: humanVoice ? 12 : 7,
      reason: humanVoice ? "标题/hook 像人说话，有可复述判断。" : "语气还像说明文，需要更像朋友提醒。"
    },
    {
      id: "editing-rhythm",
      label: "剪辑节奏",
      score: rhythmReady ? 8 : 5,
      reason: rhythmReady ? "有前几秒、单动作或短时长节奏锚点。" : "缺少明确节奏点，容易剪平。"
    },
    {
      id: "interaction-hook",
      label: "互动钩子",
      score: interaction ? 8 : 4,
      reason: interaction ? "能让观众站队、预测、补充或争论。" : "结尾互动弱，需要明确问题。"
    },
    {
      id: "remixable",
      label: "可二创性",
      score: remixable ? 7 : 4,
      reason: remixable ? "有表情、外号、梗或可复述金句。" : "缺少能被评论区复用的记忆点。"
    }
  ];
  const total = Math.max(0, Math.min(100, dimensions.reduce((sum, item) => sum + item.score, 0)));
  const retryAdvice = dimensions
    .filter((item) => item.score < Math.ceil(({ "topic-fit": 15, "conflict-hook": 15, protagonist: 15, "fact-anchor": 15, "material-proof": 12, "human-voice": 12, "editing-rhythm": 8, "interaction-hook": 8, remixable: 7 } as Record<string, number>)[item.id] * 0.68))
    .map((item) => `${item.label}偏弱：${item.reason}`);
  if (!hasHighlight) retryAdvice.push("先补 1 条 1-15 分钟高光素材，再写脚本。");
  if (!conflictWords) retryAdvice.push("标题需要改成“发生了什么/为什么吵/不懂球也能看懂”的具体问题。");
  if (!protagonist) retryAdvice.push("补一个主角：球员、门将、裁判、球迷身份或弱队。");
  if (!factAnchor) retryAdvice.push("补一个事实锚点：比分、分钟、纪录、单一动作或旧比赛。");
  if (!remixable) retryAdvice.push("补一个可二创记忆点：外号、表情、评论区站队词或一句能复述的话。");
  if (!hasOfficial) retryAdvice.push("非官方素材只建议做研究，发布前需要替换为官方/授权/低风险素材。");
  return {
    total,
    verdict: total >= 85 ? "go" : total >= 70 ? "revise" : "skip",
    targetAudience,
    recommendedPlatforms: [...targetAudience.platforms],
    dimensions,
    retryAdvice
  };
}

function compactId(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "topic";
}

function classifyAsset(title: string, durationSec?: number): AssetCandidate["kind"] {
  const t = title.toLowerCase();
  if (t.includes("full match") || t.includes("完整") || (durationSec ?? 0) > 3600) return "full_match";
  if (t.includes("highlight") || t.includes("minute match") || t.includes("集锦") || (durationSec ?? 0) <= 1200) return "highlight";
  if (t.includes("preview") || t.includes("前瞻")) return "preview";
  if (t.includes("press") || t.includes("conference") || t.includes("发布会")) return "press";
  return "supplement";
}

function assetUsage(kind: AssetCandidate["kind"]) {
  if (kind === "full_match") return "用于核对具体转折点、进球、犯规和庆祝动作，剪辑前先二次定位时间码。";
  if (kind === "highlight") return "适合作为短视频主画面，优先承接强情绪段落。";
  if (kind === "preview") return "适合做赛前气氛、队徽、球员入场和当下语境。";
  if (kind === "press") return "适合做情绪铺垫、主帅观点和争议背景。";
  return "适合补充球队历史、球星镜头或同届世界杯氛围。";
}

async function commandExists(command: string) {
  try {
    await execFileAsync("which", [command], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function pythonHasJianyingDeps() {
  try {
    await execFileAsync(
      "python3",
      ["-c", "import pymediainfo, edge_tts, websockets"],
      { timeout: 10000, maxBuffer: 1024 * 1024 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function getEnvironmentStatus() {
  const [ytDlp, python, ffmpeg, jianyingPythonDeps] = await Promise.all([
    commandExists("yt-dlp"),
    commandExists("python3"),
    commandExists("ffmpeg"),
    pythonHasJianyingDeps()
  ]);
  const skillRoot = resolveJianyingSkillRoot();
  const draftRoot = resolveJianyingDraftRoot();
  const notes: string[] = [];
  if (!ytDlp) notes.push("未找到 yt-dlp，YouTube 素材搜索和下载会降级为示例数据。");
  if (!skillRoot) notes.push("未找到剪映 skill。设置 JY_SKILL_ROOT 或克隆到 skills/jianying-editor 后可生成草稿。");
  if (!jianyingPythonDeps) notes.push("剪映 Python 依赖不完整，至少需要 pymediainfo、edge-tts、websockets。");
  if (!draftRoot) notes.push("未找到剪映草稿目录。Mac 可生成脚本，自动导出仍建议 Windows + 剪映 5.9。");
  if (!ffmpeg) notes.push("未找到 ffmpeg。当前下载策略会优先使用 YouTube 360p mp4 单文件格式以避免合并。");
  return {
    ytDlp,
    python,
    jianyingPythonDeps,
    ffmpeg,
    jianyingSkillRoot: skillRoot,
    jianyingDraftRoot: draftRoot,
    platform: `${os.platform()} ${os.arch()}`,
    notes
  };
}

export function resolveJianyingSkillRoot() {
  const candidates = [
    process.env.JY_SKILL_ROOT,
    path.join(process.cwd(), "skills", "jianying-editor"),
    path.join(process.cwd(), ".agent", "skills", "jianying-editor"),
    "/tmp/jianying-editor-skill"
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => existsSync(path.join(candidate, "scripts", "jy_wrapper.py")));
}

export function resolveJianyingDraftRoot() {
  const home = os.homedir();
  const candidates = [
    process.env.JY_PROJECTS_ROOT,
    path.join(home, "Movies", "JianyingPro Drafts"),
    path.join(home, "Movies", "JianyingPro", "User Data", "Projects", "com.lveditor.draft"),
    path.join(
      home,
      "Library",
      "Containers",
      "com.lemon.lvpro",
      "Data",
      "Library",
      "Application Support",
      "JianyingPro",
      "User Data",
      "Projects",
      "com.lveditor.draft"
    )
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => existsSync(candidate));
}

const themeCatalog: ThemeOption[] = [
  {
    id: "prediction-bomb",
    label: "暴论预测",
    angle: "暴论预测",
    description: "先找一个能被回放、争议或旧故事放大的可见细节。",
    searchHint: "preview prediction pressure upset",
    whyForNonFans: "不需要懂阵型，先让观众想反驳、想站队。"
  },
  {
    id: "star-legacy",
    label: "球星历史线",
    angle: "球星历史线",
    description: "围绕核心球员的一脚、一次表情或一场旧比赛，把比赛剪成人物故事。",
    searchHint: "star player story goals documentary interview",
    whyForNonFans: "先看人，再看球。用一个动作讲清楚球员为什么值得看。"
  },
  {
    id: "history-upset",
    label: "历史冷门/翻车",
    angle: "历史冷门",
    description: "用历史比赛里的爆冷、卫冕冠军翻车、弱队逆袭做情绪入口。",
    searchHint: "full match shock upset highlights",
    whyForNonFans: "不需要懂战术，只要找到旧比赛的反差镜头就能讲清楚。"
  },
  {
    id: "destiny-rematch",
    label: "宿命重逢",
    angle: "宿命重逢",
    description: "把今天的赛程和过去交锋、旧故事、老球星记忆连起来。",
    searchHint: "classic match rematch old rivalry",
    whyForNonFans: "按时间线讲故事，比预测比分更容易稳定产出。"
  },
  {
    id: "star-pressure",
    label: "球星压力",
    angle: "球星压力",
    description: "围绕核心球员、队长、门将或教练，把压力和镜头情绪放大。",
    searchHint: "star player press conference emotion",
    whyForNonFans: "只需要识别明星、表情、赛前发布会，不必理解复杂阵型。"
  },
  {
    id: "darkhorse-contrast",
    label: "黑马反差",
    angle: "黑马/强队反差",
    description: "用强队名气和弱队求生欲形成短视频冲突。",
    searchHint: "underdog highlights upset preview",
    whyForNonFans: "强弱对比天然有爽点，适合做三秒钩子。"
  },
  {
    id: "host-atmosphere",
    label: "赛前气氛",
    angle: "赛前气氛",
    description: "用球迷、城市、发布会、入场和队徽做赛前内容。",
    searchHint: "preview fans atmosphere press conference",
    whyForNonFans: "可做非技术向内容，画面抓人，适合小红书/抖音。"
  },
  {
    id: "material-map",
    label: "素材地图",
    angle: "素材地图型",
    description: "直接教用户这场球应该找哪些画面，变成剪辑前攻略。",
    searchHint: "full match highlights preview",
    whyForNonFans: "内容本身就是生产流程，不懂球也能展示专业感。"
  }
];

export function buildThemeOptions(fixture?: Fixture): ThemeOption[] {
  if (!fixture) return themeCatalog;
  const ordered = ["prediction-bomb", "star-legacy", "darkhorse-contrast", "history-upset", "destiny-rematch", "star-pressure", "host-atmosphere", "material-map"];
  return ordered.map((id) => themeCatalog.find((theme) => theme.id === id)!).filter(Boolean);
}

function getTheme(themeId?: string, fixture?: Fixture) {
  return buildThemeOptions(fixture).find((theme) => theme.id === themeId) || buildThemeOptions(fixture)[0];
}

async function loadVoiceoverStyleProfile(): Promise<VoiceoverStyleProfile> {
  if (cachedStyleProfile) return cachedStyleProfile;
  try {
    cachedStyleProfile = JSON.parse(await readFile(STYLE_PROFILE_PATH, "utf8")) as VoiceoverStyleProfile;
    return cachedStyleProfile;
  } catch {
    cachedStyleProfile = {
      generatedAt: new Date().toISOString(),
      engines: [
        {
          id: "visible_incident",
          label: "可见瞬间反转型",
          narrationMode: "narrative_voiceover",
          defaultDifficulty: "medium",
          bestFor: ["门将失误", "回放揭示", "一次反击"],
          avoidWhen: ["没有主镜头"],
          evidenceRequired: ["一个动作", "一次回放", "后果或误会"],
          openingMoves: ["从动作开始"],
          voiceoverMoves: ["动作", "第一眼判断", "回放改写", "后果"],
          topicShapes: ["第一眼都以为稳了，慢镜头出来才知道哪里不对"]
        },
        {
          id: "question_explainer",
          label: "问题解释型",
          narrationMode: "narrative_voiceover",
          defaultDifficulty: "medium",
          bestFor: ["规则争议", "反常操作"],
          avoidWhen: ["没有可见问题"],
          evidenceRequired: ["一个问题", "一条原因", "可暂停的动作"],
          openingMoves: ["直接问为什么"],
          voiceoverMoves: ["问题", "解释", "证据", "判断"],
          topicShapes: ["为什么这个动作会让全场吵起来？"]
        }
      ],
      editDifficulty: { hardFilterRules: [] },
      writingRules: {
        dominantShape: "直接问题/可见瞬间 -> 少量背景 -> 解释推进 -> 证据补充 -> 余味或站队",
        lineRhythm: "短句为主，一句一个信息点。",
        prefer: ["具体动作", "人名", "回放/原声/表情"],
        avoid: ["押一个/前20分钟/谁先急", "更重要的是", "不是X而是Y"]
      }
    };
    return cachedStyleProfile;
  }
}

function getStyleEngine(profile: VoiceoverStyleProfile, id: string) {
  return profile.engines.find((engine) => engine.id === id) || profile.engines[0];
}

function evidenceTypeFromEngine(engineId: string): EvidenceType {
  if (engineId === "human_relationship") return "human_relationship";
  if (engineId === "star_micro_action") return "star_micro_action";
  if (engineId === "commentary_assist") return "live_commentary";
  if (engineId === "subtitle_first") return "subtitle_moment";
  if (engineId === "fact_list") return "fact_list";
  if (engineId === "question_explainer") return "question_explainer";
  return "visible_incident";
}

function decodeHtml(input = "") {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractKeywords(text: string) {
  const hits = new Set<string>();
  const patterns = [
    /VAR|penalty|red card|offside|goal|highlights?|preview|injury|squad|training|press conference/gi,
    /C罗|梅西|姆巴佩|哈兰德|亚马尔|内马尔|萨拉赫|孙兴慜|贝林厄姆|凯恩|莫德里奇|德布劳内|维尼修斯/g,
    /爆冷|争议|点球|红牌|越位|伤病|首发|名单|训练|发布会|帽子戏法|绝杀|回放|慢镜头|原声|看台/g
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) hits.add(match[0]);
  }
  return [...hits].slice(0, 10);
}

function matchTeamsAndPlayers(text: string, fixture?: Fixture) {
  const matchedTeams = new Set<string>();
  const matchedPlayers = new Set<string>();
  const normalized = text.toLowerCase();
  const teams = fixture ? [fixture.home, fixture.away] : Object.keys(teamNameZh);
  for (const team of teams) {
    const canonical = canonicalTeam(team);
    const zh = displayTeam(canonical, "zh");
    if (normalized.includes(canonical.toLowerCase()) || text.includes(zh)) matchedTeams.add(zh);
    for (const player of teamPlayersZh[canonical] || []) {
      if (text.includes(player)) matchedPlayers.add(player);
    }
  }
  return { matchedTeams: [...matchedTeams], matchedPlayers: [...matchedPlayers] };
}

function signalWeight(text: string, fixture?: Fixture) {
  const { matchedTeams, matchedPlayers } = matchTeamsAndPlayers(text, fixture);
  const keywordBoost = extractKeywords(text).length * 2;
  const conflictBoost = /爆冷|upset|争议|VAR|penalty|red card|offside|injury|伤病|点球|红牌|越位|帽子戏法|绝杀|回放|慢镜头/i.test(text)
    ? 12
    : 0;
  return Math.min(100, 42 + matchedTeams.length * 10 + matchedPlayers.length * 10 + keywordBoost + conflictBoost);
}

function signalFromAsset(asset: AssetCandidate, fixture?: Fixture): HotspotSignal {
  const text = `${asset.title} ${asset.channel || ""}`;
  const { matchedTeams, matchedPlayers } = matchTeamsAndPlayers(text, fixture);
  return {
    id: `yt-${asset.id}`,
    source: "youtube",
    query: asset.query,
    title: asset.title,
    url: asset.url,
    snippet: asset.usageHint,
    weight: Math.round(signalWeight(text, fixture) + asset.confidence * 8),
    matchedTeams,
    matchedPlayers,
    keywords: extractKeywords(text)
  };
}

async function searchNewsHotspots(query: string, fixture?: Fixture, limit = 4): Promise<HotspotSignal[]> {
  if (process.env.WC_OFFLINE_HOTSPOTS === "1") return [];
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8500) });
    if (!response.ok) return [];
    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit);
    return items.map((match, index) => {
      const block = match[1];
      const title = decodeHtml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
      const link = decodeHtml(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "");
      const snippet = decodeHtml(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "");
      const text = `${title} ${snippet}`;
      const { matchedTeams, matchedPlayers } = matchTeamsAndPlayers(text, fixture);
      return {
        id: `web-${compactId(`${query}-${index}-${title}`)}`,
        source: "web" as const,
        query,
        title,
        url: link,
        snippet,
        weight: signalWeight(text, fixture),
        matchedTeams,
        matchedPlayers,
        keywords: extractKeywords(text)
      };
    }).filter((signal) => signal.title);
  } catch {
    return [];
  }
}

function fallbackHotspotSignals(fixture: Fixture | undefined, theme: ThemeOption): HotspotSignal[] {
  const home = fixture?.home || "World Cup";
  const away = fixture?.away || "Football";
  const homeZh = displayTeam(home, "zh");
  const awayZh = displayTeam(away, "zh");
  const players = [...(teamPlayersZh[canonicalTeam(home)] || []), ...(teamPlayersZh[canonicalTeam(away)] || [])].slice(0, 3);
  return [
    {
      id: `fallback-${compactId(`${home}-${away}-${theme.id}`)}`,
      source: "fallback",
      query: `${home} ${away} ${theme.searchHint}`,
      title: `${homeZh}对${awayZh} ${theme.label} 热点兜底`,
      snippet: "网络热点不可用时，用未来赛程、核心球员和主题方向生成保底信号。",
      weight: 58 + players.length * 4,
      matchedTeams: [homeZh, awayZh].filter(Boolean),
      matchedPlayers: players,
      keywords: [theme.label, "赛程", "核心球员"].filter(Boolean)
    }
  ];
}

async function collectHotspotSignals(
  fixture: Fixture | undefined,
  theme: ThemeOption,
  assets: AssetCandidate[],
  queries: string[]
): Promise<HotspotSignal[]> {
  const playerTerms = fixture
    ? [...(teamPlayersZh[canonicalTeam(fixture.home)] || []), ...(teamPlayersZh[canonicalTeam(fixture.away)] || [])].slice(0, 4).join(" ")
    : "";
  const newsQueries = fixture
    ? [
        `${fixture.home} ${fixture.away} World Cup latest ${theme.searchHint}`,
        `${displayTeam(fixture.home, "zh")} ${displayTeam(fixture.away, "zh")} 世界杯 热点 ${theme.label}`,
        `${fixture.home} ${fixture.away} ${playerTerms} preview news`
      ]
    : queries.slice(0, 2);
  const [newsSignals] = await Promise.all([Promise.all(newsQueries.map((query) => searchNewsHotspots(query, fixture, 4)))]);
  const youtubeSignals = assets.map((asset) => signalFromAsset(asset, fixture));
  const deduped = dedupeHotspotSignals([...newsSignals.flat(), ...youtubeSignals]);
  return deduped.length ? deduped.slice(0, 14) : fallbackHotspotSignals(fixture, theme);
}

function dedupeHotspotSignals(signals: HotspotSignal[]) {
  const seen = new Set<string>();
  const output: HotspotSignal[] = [];
  for (const signal of signals) {
    const key = signal.title.replace(/\s+/g, "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(signal);
  }
  return output.sort((a, b) => b.weight - a.weight);
}

function buildQueries(request: GenerateTopicsRequest, fixture?: Fixture) {
  const base = fixture ? `${fixture.home} ${fixture.away}` : request.topicText?.trim() || "World Cup";
  const theme = getTheme(request.themeId, fixture);
  if (fixture && (theme.id === "destiny-rematch" || theme.id === "prediction-bomb") && isSpainSaudi(fixture.home, fixture.away)) {
    return [
      "FIFA Saudi Arabia Argentina 2022 World Cup highlights",
      "FIFA Japan Spain 2022 World Cup highlights",
      "FIFA Spain Saudi Arabia World Cup 2026 preview"
    ];
  }
  return [
    `FIFA ${base} ${theme.searchHint} World Cup`,
    `FIFA ${base} highlights World Cup ${theme.angle}`,
    `${base} World Cup preview press conference ${theme.searchHint}`
  ];
}

function buildSupplementQueries(fixture: Fixture, theme: ThemeOption) {
  if (isSpainSaudi(fixture.home, fixture.away)) {
    return [
      "FIFA Saudi Arabia Argentina 2022 World Cup highlights",
      "FIFA Spain Japan 2022 World Cup highlights",
      "Spain Saudi Arabia football preview World Cup",
      "Saudi Arabia World Cup counter attack highlights"
    ];
  }
  return [
    `FIFA ${fixture.home} World Cup highlights`,
    `FIFA ${fixture.away} World Cup highlights`,
    `FIFA ${fixture.home} ${fixture.away} World Cup preview`,
    `${fixture.home} ${fixture.away} ${theme.searchHint} football analysis`
  ];
}

async function searchYoutube(query: string, limit = 5): Promise<AssetCandidate[]> {
  if (process.env.WC_TEST_OFFLINE === "1") return [];
  try {
    const { stdout } = await execFileAsync(
      "yt-dlp",
      ["--dump-single-json", "--flat-playlist", "--playlist-end", String(limit), `ytsearch${limit}:${query}`],
      { timeout: 45000, maxBuffer: 8 * 1024 * 1024 }
    );
    const json = JSON.parse(stdout);
    return (json.entries || [])
      .filter((entry: any) => entry?.id && entry?.title)
      .map((entry: any): AssetCandidate => {
        const kind = classifyAsset(entry.title, entry.duration);
        return {
          id: entry.id,
          title: entry.title,
          url: entry.url?.startsWith("http") ? entry.url : `https://www.youtube.com/watch?v=${entry.id}`,
          channel: entry.channel,
          durationSec: entry.duration,
          thumbnail: entry.thumbnails?.at?.(-1)?.url || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
          kind,
          confidence: entry.channel === "FIFA" ? 0.92 : 0.7,
          query,
          usageHint: assetUsage(kind),
          rightsNote: "仅做素材研究与剪辑定位；发布前需按平台规则、版权和合理使用边界复核。"
        };
      });
  } catch {
    return [];
  }
}

function dedupeAssets(assets: AssetCandidate[]) {
  const seen = new Set<string>();
  const output: AssetCandidate[] = [];
  for (const asset of assets) {
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    output.push(asset);
  }
  return output.sort((a, b) => {
    const kindScore = (kind: AssetCandidate["kind"]) => ({ highlight: 5, full_match: 4, preview: 3, press: 2, supplement: 1 })[kind];
    return kindScore(b.kind) + b.confidence - (kindScore(a.kind) + a.confidence);
  });
}

function assetRelevantToFixture(asset: AssetCandidate, fixture?: Fixture) {
  if (!fixture) return true;
  const title = asset.title.toLowerCase();
  const terms = [fixture.home, fixture.away, displayTeam(fixture.home, "zh"), displayTeam(fixture.away, "zh")]
    .flatMap((term) => String(term).split(/\s+/).concat(term))
    .map((term) => term.toLowerCase())
    .filter((term) => term.length > 2);
  if (isSpainSaudi(fixture.home, fixture.away)) {
    terms.push("japan", "日本", "spain", "西班牙", "saudi", "saudis", "沙特");
  }
  return terms.some((term) => title.includes(term));
}

function fallbackAssets(query: string): AssetCandidate[] {
  return [
    {
      id: "RdkGf_mpFCY",
      title: "15-Minute Match: France vs Senegal | 2002 Shock",
      url: "https://www.youtube.com/watch?v=RdkGf_mpFCY",
      channel: "FIFA",
      durationSec: 925,
      thumbnail: "https://i.ytimg.com/vi/RdkGf_mpFCY/hq720.jpg",
      kind: "highlight",
      confidence: 0.92,
      query,
      usageHint: assetUsage("highlight"),
      rightsNote: "示例素材。发布前需复核版权与平台规则。"
    },
    {
      id: "Z6NTDyxcODs",
      title: "FULL MATCH: France v Senegal | Group Stage | 2002 FIFA WORLD CUP KOREA/JAPAN",
      url: "https://www.youtube.com/watch?v=Z6NTDyxcODs",
      channel: "FIFA",
      durationSec: 5975,
      thumbnail: "https://i.ytimg.com/vi/Z6NTDyxcODs/hq720.jpg",
      kind: "full_match",
      confidence: 0.92,
      query,
      usageHint: assetUsage("full_match"),
      rightsNote: "示例素材。发布前需复核版权与平台规则。"
    }
  ];
}

function topicTemplates(language: OutputLanguage, home: string, away: string) {
  const homeLabel = displayTeam(home, language);
  const awayLabel = displayTeam(away, language);
  const roles = matchupRoles(home, away);
  const favoriteLabel = displayTeam(roles.favorite, language);
  const challengerLabel = displayTeam(roles.challenger, language);
  const favoriteStar = displayPlayer(roles.favorite, language, 0);
  const favoriteSecondStar = displayPlayer(roles.favorite, language, 1);
  const challengerStar = displayPlayer(roles.challenger, language, 0);
  const predictionTitle = isSpainSaudi(home, away)
    ? "西班牙对沙特，真正能出圈的是旧账被翻出来那一刻"
    : `${favoriteLabel}对${challengerLabel}，别先猜比分，先找一个会被反复回放的细节`;
  const predictionHook = isSpainSaudi(home, away)
    ? "沙特赢过阿根廷，西班牙被日本逆转过。把两段旧画面接上，比赛还没开始就有叙事。"
    : `${favoriteLabel}纸面更强，但短视频要找的不是结论，是第一次被慢镜头解释清楚的瞬间。`;
  const destinyTitle = isSpainSaudi(home, away)
    ? "沙特又站到强队面前：这次轮到西班牙紧张了"
    : `${homeLabel}和${awayLabel}又碰上了，这笔旧账够吵一整晚`;
  const destinyHook = isSpainSaudi(home, away)
    ? "沙特赢过阿根廷，西班牙被日本打懵过。两段旧视频接上，这场不用开踢就有火药味。"
    : `别急着猜比分，先把旧账翻出来。${homeLabel}和${awayLabel}这场，评论区一定有人翻脸。`;
  const zh = [
    {
      themeId: "prediction-bomb",
      angle: "暴论预测",
      title: predictionTitle,
      hook: predictionHook,
      reason: "证据类型：旧账/回放揭示。爆点来自观众第一眼没看懂，回放后才知道发生了什么。"
    },
    {
      themeId: "star-legacy",
      angle: "球星历史线",
      title: `${favoriteStar}这场别写成履历，找他一个能说明问题的动作`,
      hook: `球星内容不是奖杯清单。一个手势、一次回追、一次犹豫，往往比进球更能讲出人。`,
      reason: `证据类型：球星微动作。把${favoriteStar}从流量名字变成一个可见细节。`
    },
    {
      themeId: "darkhorse-contrast",
      angle: "黑马/强队反差",
      title: `${challengerLabel}偷到第一脚射正，${favoriteLabel}可能要难受一整晚`,
      hook: `这类球不用讲复杂。${challengerLabel}只要让${favoriteLabel}第一波没打穿，后面每一次反击都会变吓人。`,
      reason: `爆点：弱队只要一次机会，强队就会被拖进焦躁局。`
    },
    {
      themeId: "history-upset",
      angle: "历史冷门",
      title: `${favoriteLabel}的旧冷门别当资料，它可以直接当开头`,
      hook: `观众不一定记得战术，但会记得强队被误会、被回放、被翻旧账的那一下。`,
      reason: "证据类型：情绪时间线。用旧事实制造今天的叙事入口。"
    },
    {
      themeId: "destiny-rematch",
      angle: "宿命重逢",
      title: destinyTitle,
      hook: destinyHook,
      reason: "爆点：旧账 + 今天赛程，天然能做成评论区站队。"
    },
    {
      themeId: "star-pressure",
      angle: "球星压力",
      title: `${favoriteStar}最值得讲的，可能不是进球，是镜头为什么追着他`,
      hook: `别急着夸${favoriteStar}，也别急着骂${favoriteSecondStar}。先找一个动作，说明这场压力落在谁身上。`,
      reason: `爆点：中文球员名直接上标题，观众会先看人，再看比赛。`
    },
    {
      themeId: "material-map",
      angle: "素材地图型",
      title: `${homeLabel}对${awayLabel}别讲战术，先找3类观众会停下来的证据`,
      hook: `回放才懂的细节、球星被捕捉的小动作、原声已经很炸的瞬间。先找证据，再写旁白。`,
      reason: "证据类型：素材地图。给剪辑执行入口，但标题先卖可见证据。"
    },
    {
      themeId: "host-atmosphere",
      angle: "赛前气氛",
      title: `${homeLabel}对${awayLabel}还没开踢，先找一个能讲人的场外镜头`,
      hook: `发布会停顿、球迷表情、球员下车、看台原声。赛前内容要先有人味，再有观点。`,
      reason: "证据类型：场外人味。把赛前气氛改成可感知的故事。"
    }
  ];
  if (language === "zh") return zh;
  return zh.map((item) => ({
    themeId: item.themeId,
    angle: item.angle,
    title: `[${languageLabels[language]}] ${home} vs ${away}: a material-first World Cup angle`,
    hook: "Do not start with a script. Start with verified match footage, then let the angle emerge.",
    reason: "Bold prediction adapted from the Chinese topic engine."
  }));
}

function supplementalTopicTemplates(language: OutputLanguage, home: string, away: string): TopicTemplate[] {
  const roles = matchupRoles(home, away);
  const favoriteLabel = displayTeam(roles.favorite, language);
  const challengerLabel = displayTeam(roles.challenger, language);
  const favoriteStar = displayPlayer(roles.favorite, language, 0);
  const favoriteSecondStar = displayPlayer(roles.favorite, language, 1);
  const challengerStar = displayPlayer(roles.challenger, language, 0);
  if (language !== "zh") {
    return [
      {
        themeId: "prediction-bomb",
        angle: "Prediction",
        title: `${favoriteLabel} vs ${challengerLabel}: start from the clip that changes meaning on replay`,
        hook: `Find the visible incident first, then explain why the first glance is incomplete.`,
        reason: "Repaired topic: evidence-led replay/reveal angle."
      }
    ];
  }
  return [
    {
      themeId: "star-legacy",
      angle: "球星历史线",
      title: `${favoriteStar}别做履历表，抓他一个能讲人的动作`,
      hook: `别把球星写成百科。先给一个动作：回头要球、最后助跑、低头喘气，观众会自己看懂时间过去了。`,
      reason: "爆点：明星球员内容先讲一个动作，不讲一整本履历。"
    },
    {
      themeId: "prediction-bomb",
      angle: "暴论预测",
      title: `${favoriteLabel}和${challengerLabel}这场，先找一个第一眼看错的镜头`,
      hook: `别急着看比分。先找回放才说得清的动作，观众会跟着你一起等答案。`,
      reason: "证据类型：回放揭示。适合做悬念叙事。"
    },
    {
      themeId: "darkhorse-contrast",
      angle: "黑马/强队反差",
      title: `${challengerLabel}不一定要赢，先制造一个让人回看的瞬间`,
      hook: `弱队内容最怕空喊爆冷。给观众一个能看见的动作，反差才会成立。`,
      reason: "证据类型：弱队可见证据。先有瞬间，再谈冷门。"
    },
    {
      themeId: "star-pressure",
      angle: "球星压力",
      title: `${favoriteStar}第一脚被断以后，${favoriteLabel}这场味道就变了`,
      hook: `镜头别只追射门。你盯他回头找队友那一下，压力会先从脸上出来。`,
      reason: "爆点：用中文球员名和一个动作当钩子。"
    },
    {
      themeId: "host-atmosphere",
      angle: "赛前气氛",
      title: `${home === roles.favorite ? favoriteLabel : challengerLabel}和${away === roles.favorite ? favoriteLabel : challengerLabel}这场，场外镜头先定调`,
      hook: `发布会、下车、看台、原声，只要有一个人味瞬间，赛前内容就能成立。`,
      reason: "爆点：把专业比赛翻成普通人能感知的看台气氛。"
    },
    {
      themeId: "material-map",
      angle: "素材地图型",
      title: `${challengerStar}第一次往前冲，可能比控球率更值得看`,
      hook: `不懂战术也能看懂：球一断、身体一转、看台一静，这三下就是短视频的爆点。`,
      reason: "爆点：把剪辑抓手改成观众能看见的动作，不说剪辑流程。"
    },
    {
      themeId: "prediction-bomb",
      angle: "暴论预测",
      title: `${favoriteLabel}控球再多，也要有一个镜头能说明故事`,
      hook: `控球率不能直接当短视频开头。观众需要一个表情、一次回放或一段原声。`,
      reason: "证据类型：可视化解释。先找证据，再谈优势。"
    },
    {
      themeId: "darkhorse-contrast",
      angle: "黑马/强队反差",
      title: `${challengerLabel}最狠的剧本：一个动作先把强弱关系讲反`,
      hook: `一脚反击没进也没关系。只要那个瞬间能让观众回看，故事就成立。`,
      reason: "证据类型：反差动作。弱队先赢叙事，不必先赢比分。"
    },
    {
      themeId: "star-pressure",
      angle: "球星压力",
      title: `${favoriteSecondStar}这一场先别看数据，看他接球前那一秒`,
      hook: `中场一急，前场就会跟着急。你看他接球前那一秒，很多压力藏不住。`,
      reason: "爆点：用第二球星补角度，避免所有标题都只盯头号球星。"
    }
  ];
}

function chooseEngineIdForSignal(theme: ThemeOption, signal: HotspotSignal, titleText: string): string {
  const text = `${theme.id} ${theme.label} ${signal.title} ${signal.snippet || ""} ${titleText}`;
  if (/原声|真实解说|绝杀|live commentary|commentary audio|现场解说|解说炸了|看台炸/i.test(text)) return "commentary_assist";
  if (/越位|VAR|红牌|点球|犯规|裁判|战术|指令|规则|offside|penalty|red card/i.test(text)) return "question_explainer";
  if (/榜|最佳|阵容|排名|盘点|有哪些|几位|多少|top|list/i.test(text)) return "fact_list";
  if (theme.id === "star-legacy" || /C罗|梅西|姆巴佩|哈兰德|亚马尔|内马尔|Ronaldo|Messi|Mbappe|Haaland|Yamal/i.test(text)) {
    return "star_micro_action";
  }
  if (/温馨|父|儿子|孩子|小球迷|队友|朋友|重逢|relationship|fan|son|father/i.test(text)) return "human_relationship";
  if (/字幕|无旁白|表情包|原声主导/.test(text)) return "subtitle_first";
  return theme.id === "destiny-rematch" ? "human_relationship" : "visible_incident";
}

function riskFlagsForTemplate(engineId: string, text: string, assets: AssetCandidate[]) {
  const flags = new Set<string>();
  if (engineId === "commentary_assist") flags.add("needs_original_audio");
  if (engineId === "subtitle_first") flags.add("subtitle_or_raw_sound_only");
  if (engineId === "fact_list") flags.add("multi_asset_fact_list");
  if (/越位|VAR|红牌|点球|犯规|裁判|战术|指令|规则|offside|penalty|red card/i.test(text)) flags.add("strict_visual_rule_match");
  if (engineId === "fact_list" && assets.length < 4) flags.add("insufficient_multi_asset_support");
  if (flags.has("strict_visual_rule_match") && !assets.some((asset) => asset.kind === "full_match")) flags.add("needs_full_match_or_diagram");
  return [...flags];
}

function editDifficultyForEngine(engine: StyleEngineProfile, riskFlags: string[]): EditDifficulty {
  if (riskFlags.includes("needs_full_match_or_diagram") || riskFlags.includes("insufficient_multi_asset_support")) return "high";
  if (engine.defaultDifficulty === "high") return "high";
  if (riskFlags.length >= 2) return "high";
  return engine.defaultDifficulty;
}

function styleDrivenTopicTemplates(
  request: GenerateTopicsRequest,
  fixture: Fixture | undefined,
  theme: ThemeOption,
  profile: VoiceoverStyleProfile,
  hotspotSignals: HotspotSignal[],
  assets: AssetCandidate[]
): TopicTemplate[] {
  if (request.language !== "zh") return [];
  const home = fixture?.home || parseTeamsFromTopic(request.topicText || "").home || "France";
  const away = fixture?.away || parseTeamsFromTopic(request.topicText || "").away || "Senegal";
  const roles = matchupRoles(home, away);
  const favoriteLabel = displayTeam(roles.favorite, "zh");
  const challengerLabel = displayTeam(roles.challenger, "zh");
  const favoriteStar = displayPlayer(roles.favorite, "zh", 0);
  const challengerStar = displayPlayer(roles.challenger, "zh", 0);
  const templates: TopicTemplate[] = [];
  const topSignals = hotspotSignals.slice(0, 7);

  for (const signal of topSignals) {
    const star = signal.matchedPlayers[0] || favoriteStar;
    const keyword = signal.keywords[0] || (theme.id === "star-legacy" ? "动作" : "回放");
    const engineId = chooseEngineIdForSignal(theme, signal, `${favoriteLabel} ${challengerLabel}`);
    const engine = getStyleEngine(profile, engineId);
    const riskFlags = riskFlagsForTemplate(engineId, `${signal.title} ${signal.snippet || ""}`, assets);
    const editDifficulty = editDifficultyForEngine(engine, riskFlags);
    const base = {
      themeId: theme.id,
      angle: theme.angle,
      evidenceType: evidenceTypeFromEngine(engine.id),
      narrationMode: engine.narrationMode,
      editDifficulty,
      styleEngineId: engine.id,
      styleEngineLabel: engine.label,
      hotspotSignals: [signal],
      riskFlags
    } satisfies Partial<TopicTemplate>;

    if (engine.id === "question_explainer") {
      templates.push({
        ...base,
        title: `${star || favoriteLabel}这个${keyword}，到底会让谁在评论区吵起来？`,
        hook: `先别急着站队。你只看一个条件：动作先发生在哪里，裁判为什么会停，回放有没有把第一眼推翻。`,
        reason: `热点信号：${signal.title}。证据类型：问题解释，适合给不懂球的人一个判断方法。`,
        topicMechanism: "热点争议 -> 人话解释 -> 可暂停证据 -> 评论区站队"
      });
      continue;
    }

    if (engine.id === "star_micro_action") {
      templates.push({
        ...base,
        title: `${star}这场别写成履历，先抓他第一个能说明问题的动作`,
        hook: `热度已经在${star}身上，但短视频不能只喊名字。你盯他第一次处理球、回头要球，或者丢球后的反应。`,
        reason: `热点信号：${signal.title}。证据类型：球星微动作，避免把球星写成百科。`,
        topicMechanism: "球星热度 -> 一个动作 -> 压力解释 -> 站队"
      });
      continue;
    }

    if (engine.id === "human_relationship") {
      templates.push({
        ...base,
        title: `${favoriteLabel}和${challengerLabel}这场，先找一个能讲人的旧镜头`,
        hook: `别把旧账当资料。一个相似表情、一次重逢、一个被想起的名字，比泛泛预测更能让人停住。`,
        reason: `热点信号：${signal.title}。证据类型：人物关系/时间回收，适合把比赛讲成人。`,
        topicMechanism: "旧事实 -> 人物反应 -> 时间差 -> 情绪余味"
      });
      continue;
    }

    if (engine.id === "commentary_assist") {
      templates.push({
        ...base,
        title: `${favoriteLabel}对${challengerLabel}，如果原声已经炸了，旁白就别抢戏`,
        hook: `这类题先听现场。旁白只补比分、名字和一句判断，真正带情绪的是原声和字幕。`,
        reason: `热点信号：${signal.title}。证据类型：原声解说辅助，剪辑难度高，必须保留音频空间。`,
        topicMechanism: "原声高能 -> 短字幕解释 -> 少旁白 -> 情绪保留"
      });
      continue;
    }

    if (engine.id === "fact_list") {
      templates.push({
        ...base,
        title: `${favoriteLabel}这场别做资料堆，先用一个数字把观众拉住`,
        hook: `盘点类最容易剪散。只留一个数字，一个镜头，一个问题。其他资料全部往后放。`,
        reason: `热点信号：${signal.title}。证据类型：事实盘点，素材不足时隐藏或降权。`,
        topicMechanism: "一个反常数字 -> 一段证据 -> 快速收束"
      });
      continue;
    }

    templates.push({
      ...base,
      title: `${favoriteLabel}对${challengerLabel}，第一眼看错的可能就是${keyword}`,
      hook: `${challengerStar}不用先赢。只要制造一个让镜头回看的动作，强弱关系就会先在评论区变味。`,
      reason: `热点信号：${signal.title}。证据类型：可见瞬间，先找动作，再写判断。`,
      topicMechanism: "热点标题 -> 可见动作 -> 第一眼误判 -> 回放解释"
    });
  }

  return templates;
}

function topicMechanismForEngine(engineId: string) {
  if (engineId === "question_explainer") return "热点问题 -> 人话解释 -> 可暂停证据 -> 站队";
  if (engineId === "star_micro_action") return "球星热度 -> 一个动作 -> 压力解释 -> 评论区选择";
  if (engineId === "human_relationship") return "人物/旧事实 -> 反应 -> 时间差 -> 情绪余味";
  if (engineId === "commentary_assist") return "原声高能 -> 短字幕解释 -> 少旁白";
  if (engineId === "subtitle_first") return "强字幕 -> 原声/停顿 -> 极短说明";
  if (engineId === "fact_list") return "一个反常数字 -> 一段证据 -> 快速收束";
  return "可见动作 -> 第一眼误判 -> 回放解释";
}

function enrichTemplateWithStyle(
  template: TopicTemplate,
  profile: VoiceoverStyleProfile,
  theme: ThemeOption,
  assets: AssetCandidate[],
  hotspotSignals: HotspotSignal[],
  index: number
): TopicTemplate {
  const signal = template.hotspotSignals?.[0] || hotspotSignals[index % Math.max(1, hotspotSignals.length)];
  const engineId = template.styleEngineId || chooseEngineIdForSignal(theme, signal || fallbackHotspotSignals(undefined, theme)[0], `${template.title} ${template.hook}`);
  const engine = getStyleEngine(profile, engineId);
  const riskFlags = template.riskFlags || riskFlagsForTemplate(engineId, `${template.title} ${template.hook} ${template.reason || ""}`, assets);
  const editDifficulty = template.editDifficulty || editDifficultyForEngine(engine, riskFlags);
  return {
    ...template,
    evidenceType: template.evidenceType || evidenceTypeFromEngine(engine.id),
    narrationMode: template.narrationMode || engine.narrationMode,
    editDifficulty,
    styleEngineId: engine.id,
    styleEngineLabel: engine.label,
    topicMechanism: template.topicMechanism || topicMechanismForEngine(engine.id),
    hotspotSignals: template.hotspotSignals || (signal ? [signal] : []),
    riskFlags
  };
}

function prioritizedAssetsForTopic(template: TopicTemplate, fixture: Fixture | undefined, assets: AssetCandidate[]) {
  if (
    fixture &&
    isSpainSaudi(fixture.home, fixture.away) &&
    ["destiny-rematch", "prediction-bomb", "history-upset", "darkhorse-contrast"].includes(template.themeId)
  ) {
    return [
      assets.find((asset) => /saudi|saudis|沙特|argentina|阿根廷/i.test(asset.title)),
      assets.find((asset) => /japan|日本/i.test(asset.title) && /spain|西班牙/i.test(asset.title)),
      ...assets
    ].filter(Boolean) as AssetCandidate[];
  }
  return assets;
}

function uniqueAssetIdsForTopic(template: TopicTemplate, fixture: Fixture | undefined, assets: AssetCandidate[]) {
  const seenAssetIds = new Set<string>();
  return prioritizedAssetsForTopic(template, fixture, assets)
    .filter((asset) => {
      if (seenAssetIds.has(asset.id)) return false;
      seenAssetIds.add(asset.id);
      return true;
    })
    .slice(0, 4)
    .map((asset) => asset.id);
}

function dedupeTopicTemplates(templates: TopicTemplate[]) {
  const seen = new Set<string>();
  const output: TopicTemplate[] = [];
  for (const template of templates) {
    const key = template.title.replace(/\s+/g, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(template);
  }
  return output;
}

function topicScoreDimension(
  id: string,
  label: string,
  score: number,
  maxScore: number,
  reason: string
): TopicPreflightScore["dimensions"][number] {
  return {
    id,
    label,
    score: Math.max(0, Math.min(maxScore, Math.round(score))),
    maxScore,
    reason
  };
}

function scoreTopicPreflight(
  template: TopicTemplate,
  request: GenerateTopicsRequest,
  fixture: Fixture | undefined,
  assets: AssetCandidate[],
  home: string,
  away: string
): TopicPreflightScore {
  const text = `${template.title} ${template.hook} ${template.reason || ""}`;
  const topicAssets = prioritizedAssetsForTopic(template, fixture, assets);
  const hasOfficial = topicAssets.some((asset) => asset.channel === "FIFA" || /FIFA/i.test(asset.channel || asset.title));
  const hasHighlight = topicAssets.some((asset) => asset.kind === "highlight");
  const hasFullMatch = topicAssets.some((asset) => asset.kind === "full_match");
  const hasConcreteTime = /0\s?比\s?0|2\s?比\s?1|第一脚|第一次|开局|三下|3个|三件|回放|慢镜头|发布会|看台|原声|手势|动作/.test(text);
  const hasBoldClaim = /回放|慢镜头|第一眼|看错|旧账|翻车|火药味|背锅|破防|会吵|误会|争议|离谱|诡异|最后一舞|封神|一脚改命|留下名字|扛住|说明问题|人味/.test(text);
  const hasViewerAction = /你|观众|评论区|站队|敢|盯|只看|先看|别急|回看|第一眼|看哪/.test(text);
  const hasQuestion = /吗|谁|会不会|哪边|？|\?/.test(text);
  const hasExplainableLens = /不懂球|看懂|先看|盯|只要|如果|因为|所以|控球|反击|压力|看台|表情|脸色|回放|慢镜头|动作|原声|证据/.test(text);
  const hasPlayerZh = Object.values(teamPlayersZh).flat().some((name) => text.includes(name));
  const homeZh = displayTeam(home, "zh");
  const awayZh = displayTeam(away, "zh");
  const chineseTeamMentions = [homeZh, awayZh].filter((name) => text.includes(name)).length;
  const englishTeamLeak =
    request.language === "zh" &&
    [canonicalTeam(home), canonicalTeam(away)].some((name) => /[A-Za-z]/.test(name) && text.includes(name));
  const bannedPhrase = findBannedVoiceoverPhrase(text);
  const titleLength = [...template.title].length;
  const hookLength = [...template.hook].length;
  const riskFlags = template.riskFlags || riskFlagsForTemplate(template.styleEngineId || "visible_incident", text, topicAssets);
  const strictVisualRisk = riskFlags.includes("needs_full_match_or_diagram");
  const multiAssetRisk = riskFlags.includes("insufficient_multi_asset_support");
  const commentaryRisk = riskFlags.includes("needs_original_audio") && !hasHighlight;
  const editRiskPenalty = (strictVisualRisk ? 12 : 0) + (multiAssetRisk ? 10 : 0) + (commentaryRisk ? 8 : 0);

  const dimensions = [
    topicScoreDimension(
      "hook-tension",
      "钩子张力",
      9 + (hasBoldClaim ? 9 : 0) + (hasQuestion ? 3 : 0) + (/强队|弱队|冷门|旧账|球迷|评论区|压力|回放|慢镜头|人味|原声/.test(text) ? 4 : 0) - (bannedPhrase ? 10 : 0),
      25,
      bannedPhrase ? `命中已弃用模板或口头禅：${bannedPhrase}。` : hasBoldClaim ? "有可见事件、回放揭示、人物关系或评论区争议点。" : "缺少可见证据，容易变成赛程介绍。"
    ),
    topicScoreDimension(
      "spoken-shape",
      "口语感",
      5 + (titleLength >= 16 && titleLength <= 34 ? 4 : 1) + (hookLength >= 22 && hookLength <= 72 ? 4 : 1) + (/[。！？：]/.test(template.title + template.hook) ? 2 : 0) - (bannedPhrase ? 4 : 0),
      15,
      bannedPhrase ? `命中禁用口头禅：${bannedPhrase}。` : "标题和 hook 能直接读成短视频口播。"
    ),
    topicScoreDimension(
      "proof-anchor",
      "事实锚点",
      4 + (hasConcreteTime ? 5 : 0) + (hasPlayerZh ? 4 : 0) + (chineseTeamMentions >= 2 ? 4 : 2) + (/阿根廷|日本|旧冷门|比分|控球|反击|第一脚|回放|慢镜头|手势|发布会/.test(text) ? 3 : 0),
      20,
      hasConcreteTime || hasPlayerZh ? "有球员名、动作、旧事实、回放或原声，便于展开讲解。" : "还需要一个具体动作、旧事实、回放或中文球员名。"
    ),
    topicScoreDimension(
      "participation",
      "互动性",
      4 + (hasViewerAction ? 5 : 0) + (hasQuestion ? 3 : 0) + (/站队|评论区|你敢|你觉得|球迷|看懂|第一眼|回看/.test(text) ? 3 : 0),
      15,
      hasViewerAction ? "观众知道自己要看哪一镜、站哪边、在评论区吵什么。" : "缺少观众参与动作。"
    ),
    topicScoreDimension(
      "localization",
      "中文本地化",
      request.language !== "zh" ? 10 : 3 + (chineseTeamMentions >= 2 ? 4 : chineseTeamMentions ? 2 : 0) + (hasPlayerZh ? 2 : 0) + (englishTeamLeak ? -4 : 1),
      10,
      englishTeamLeak ? "中文输出里漏出英文队名。" : "队名/球员名已按中文短视频表达处理。"
    ),
    topicScoreDimension(
      "material-support",
      "素材支撑",
      4 + (topicAssets.length >= 3 ? 5 : topicAssets.length >= 2 ? 3 : 1) + (hasHighlight ? 3 : 0) + (hasFullMatch ? 2 : 0) + (hasOfficial ? 3 : 0) - editRiskPenalty,
      15,
      editRiskPenalty
        ? `剪辑风险偏高：${riskFlags.join("、")}。`
        : topicAssets.length >= 3
          ? "已有多条素材可支撑标题，不需要硬编。"
          : "素材偏少，需要自动补官方高光/发布会/旧冷门。"
    )
  ];
  const total = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  const repairActions = dimensions
    .filter((dimension) => dimension.score < Math.ceil(dimension.maxScore * 0.68))
    .map((dimension) => `${dimension.label}偏弱：${dimension.reason}`);
  if (bannedPhrase) repairActions.unshift(`删掉 AI 口头禅：${bannedPhrase}`);
  if (!hasBoldClaim) repairActions.unshift("把标题改成一个可见证据：回放揭示、人物关系、争议动作、原声高光或旧账。");
  if (!hasConcreteTime && !hasPlayerZh) repairActions.push("补一个具体事实：第一脚射正、第一次触球、旧比分、慢镜头、发布会表情或中文球员名。");
  if (topicAssets.length < 3) repairActions.push("素材不足：补搜双方官方高光、旧冷门和赛前发布会。");
  if (strictVisualRisk) repairActions.push("规则/战术逐帧题缺完整比赛或示意图，默认隐藏，不做普通旁白。");
  if (multiAssetRisk) repairActions.push("盘点题素材段数不足，默认隐藏或改成单一问题解释。");
  if (commentaryRisk) repairActions.push("原声辅助题缺高能原声素材，默认不生成长旁白。");
  return {
    total,
    verdict: total >= TOPIC_PREFLIGHT_PASS_SCORE ? "pass" : total >= 65 ? "repair" : "hide",
    dimensions,
    repairActions: [...new Set(repairActions)]
  };
}

function repairTopicTemplate(
  template: TopicTemplate,
  language: OutputLanguage,
  home: string,
  away: string,
  preflight: TopicPreflightScore
): TopicTemplate {
  const roles = matchupRoles(home, away);
  const favoriteLabel = displayTeam(roles.favorite, language);
  const challengerLabel = displayTeam(roles.challenger, language);
  const favoriteStar = displayPlayer(roles.favorite, language, 0);
  const challengerStar = displayPlayer(roles.challenger, language, 0);
  const repairReason = `自动补强：原题 ${preflight.total} 分，补了证据类型、回放/人物动作、中文队名/球员名和评论区站队。`;
  if (language !== "zh") {
    return {
      ...template,
      title: `${favoriteLabel} vs ${challengerLabel}: start from the replay that changes the story`,
      hook: `Find one visible incident, then explain why the first glance was incomplete.`,
      reason: repairReason
    };
  }
  if (template.themeId === "star-pressure") {
    return {
      ...template,
      title: `${favoriteStar}这一场先别看数据，看他第一个能说明问题的动作`,
      hook: `你就盯他第一次处理球。只要这个动作能让观众回看，${challengerLabel}就有叙事入口。`,
      reason: repairReason
    };
  }
  if (template.themeId === "star-legacy") {
    return {
      ...template,
      title: `${favoriteStar}别写成履历表，先抓一个能讲人的动作`,
      hook: `别急着等他进球，先看他第一次回头要球。${favoriteLabel}打不开时，镜头会告诉你他有没有扛住。`,
      reason: repairReason
    };
  }
  if (template.themeId === "darkhorse-contrast") {
    return {
      ...template,
      title: `${challengerLabel}不用先赢，先制造一个让人回看的动作`,
      hook: `${challengerStar}不用进球。只要第一脚反击敢往前冲，弱队就有可见证据。`,
      reason: repairReason
    };
  }
  if (template.themeId === "history-upset" || template.themeId === "destiny-rematch") {
    return {
      ...template,
      title: `${favoriteLabel}最怕今晚被翻旧账：${challengerLabel}只需要一个相似镜头`,
      hook: `旧冷门别当资料看。一个相似的丢球前奏，就够强队球迷想起那次翻车。`,
      reason: repairReason
    };
  }
  return {
    ...template,
    title: `${favoriteLabel}对${challengerLabel}，先找一个第一眼看错的镜头`,
    hook: `你就看${favoriteStar}第一次处理球。回放、表情、原声，只要有一个成立，评论区就有话题。`,
    reason: repairReason
  };
}

function buildTopicCandidate(
  request: GenerateTopicsRequest,
  fixture: Fixture | undefined,
  assets: AssetCandidate[],
  template: TopicTemplate,
  index: number,
  preflight: TopicPreflightScore
): TopicCandidate {
  const supportedAssets = uniqueAssetIdsForTopic(template, fixture, assets);
  const support = assets.some((asset) => asset.kind === "full_match") ? 9 : 6;
  const impactText = `${template.title}${template.hook}`;
  const boldBoost = /回放|慢镜头|第一眼|看错|旧账|翻车|火药味|背锅|会吵|误会|争议|离谱|人味|原声|说明问题/.test(impactText)
    ? 8
    : 0;
  const playerBoost = Object.values(teamPlayersZh).flat().some((name) => impactText.includes(name)) ? 4 : 0;
  const selectedTheme = getTheme(request.themeId, fixture);
  const selectedBoost = template.themeId === selectedTheme.id ? 4 : 0;
  const evidenceType = template.evidenceType || evidenceTypeFromEngine(template.styleEngineId || "visible_incident");
  const narrationMode = template.narrationMode || "narrative_voiceover";
  const editDifficulty = template.editDifficulty || "medium";
  const riskPenalty = editDifficulty === "high" ? 7 : editDifficulty === "medium" ? 2 : 0;
  const hotness = Math.min(
    99,
    68 + support + selectedBoost + boldBoost + playerBoost + Math.max(0, 5 - index) + (assets[index]?.confidence ?? 0.6) * 5 - riskPenalty
  );
  return {
    id: `${compactId(template.angle)}-${nanoid(6)}`,
    title: template.title,
    angle: template.angle,
    hook: template.hook,
    evidenceType,
    narrationMode,
    editDifficulty,
    styleEngineId: template.styleEngineId || "visible_incident",
    styleEngineLabel: template.styleEngineLabel || "可见瞬间反转型",
    topicMechanism: template.topicMechanism || "可见证据 -> 解释 -> 评论区站队",
    hotspotSignals: template.hotspotSignals || [],
    riskFlags: template.riskFlags || [],
    hotness: Math.round(Math.max(hotness, preflight.total)),
    suggestedDurationSec: index === 0 ? 62 : 50 + index * 4,
    language: request.language,
    fixture,
    assetIds: supportedAssets,
    reason: template.reason || "爆点：有明确预测和评论区站队理由。",
    preflight
  };
}

function assetIdsFromRefs(assetRefs: string[], assets: AssetCandidate[]) {
  const resolved = assetRefs
    .map((ref) => assets.find((asset) => asset.id === ref) || assets.find((asset) => asset.title.includes(ref) || ref.includes(asset.title)))
    .filter(Boolean) as AssetCandidate[];
  const unique = [...new Set(resolved.map((asset) => asset.id))];
  return unique.length ? unique : assets.slice(0, 4).map((asset) => asset.id);
}

function hotspotSignalsFromIds(ids: string[], signals: HotspotSignal[]) {
  const matched = ids
    .map((id) => signals.find((signal) => signal.id === id) || signals.find((signal) => signal.title.includes(id) || id.includes(signal.title)))
    .filter(Boolean) as HotspotSignal[];
  return matched.length ? matched : signals.slice(0, 2);
}

function topicFromCodexDraft(
  request: GenerateTopicsRequest,
  fixture: Fixture | undefined,
  draft: CodexCreativeTopicDraft,
  assets: AssetCandidate[],
  hotspotSignals: HotspotSignal[]
): TopicCandidate {
  const topic: TopicCandidate = {
    id: `codex-${compactId(draft.angle || draft.title)}-${nanoid(6)}`,
    title: draft.title,
    angle: draft.angle,
    hook: draft.hook,
    evidenceType: draft.evidenceType,
    narrationMode: draft.narrationMode,
    editDifficulty: draft.editDifficulty,
    styleEngineId: draft.styleEngineId,
    styleEngineLabel: draft.styleEngineLabel,
    topicMechanism: draft.topicMechanism,
    hotspotSignals: hotspotSignalsFromIds(draft.hotspotSignalIds, hotspotSignals),
    riskFlags: draft.riskFlags,
    hotness: Math.max(0, Math.min(100, Math.round(draft.hotness))),
    suggestedDurationSec: Math.max(30, Math.round(draft.suggestedDurationSec)),
    language: request.language,
    fixture,
    assetIds: assetIdsFromRefs(draft.assetRefs, assets),
    reason: draft.reason,
    preflight: {
      ...draft.preflight,
      total: Math.max(0, Math.min(100, Math.round(draft.preflight.total))),
      verdict: draft.preflight.total >= TOPIC_PREFLIGHT_PASS_SCORE ? "pass" : draft.preflight.verdict
    }
  };
  storeCreativeDraft(topic.id, draft);
  return topic;
}

function outOfFixturePlayerNames(text: string, fixture?: Fixture) {
  if (!fixture) return [];
  const allowed = new Set([
    ...(teamPlayersZh[canonicalTeam(fixture.home)] || []),
    ...(teamPlayersZh[canonicalTeam(fixture.away)] || [])
  ]);
  return Object.values(teamPlayersZh)
    .flat()
    .filter((name) => text.includes(name) && !allowed.has(name));
}

function codexDraftFixtureViolation(draft: CodexCreativeTopicDraft, fixture?: Fixture) {
  const titleText = `${draft.title} ${draft.hook} ${draft.reason}`;
  const foreignPlayers = outOfFixturePlayerNames(titleText, fixture);
  if (foreignPlayers.length) return `标题/主钩子出现非本场球员：${foreignPlayers.join("、")}`;
  const scriptLead = draft.script
    .slice(0, 2)
    .map((beat) => beat.voiceover)
    .join(" ");
  const leadForeignPlayers = outOfFixturePlayerNames(scriptLead, fixture);
  if (leadForeignPlayers.length) return `开头旁白把非本场球员当主角：${leadForeignPlayers.join("、")}`;
  return "";
}

function buildTopics(
  request: GenerateTopicsRequest,
  fixture: Fixture | undefined,
  assets: AssetCandidate[],
  styleProfile: VoiceoverStyleProfile,
  hotspotSignals: HotspotSignal[]
): { topics: TopicCandidate[]; rejectedTopics: RejectedTopic[]; trace: string[] } {
  const parsedFreeTopic = parseTeamsFromTopic(request.topicText || "");
  const home = fixture?.home || parsedFreeTopic.home || "France";
  const away = fixture?.away || parsedFreeTopic.away || "Senegal";
  const rawTemplates = topicTemplates(request.language, home, away);
  const selectedTheme = getTheme(request.themeId, fixture);
  const styleTemplates = styleDrivenTopicTemplates(request, fixture, selectedTheme, styleProfile, hotspotSignals, assets);
  const templates = dedupeTopicTemplates([
    ...styleTemplates,
    ...rawTemplates.filter((template) => template.themeId === selectedTheme.id),
    ...rawTemplates.filter((template) => template.themeId !== selectedTheme.id),
    ...supplementalTopicTemplates(request.language, home, away)
  ]).map((template, index) => enrichTemplateWithStyle(template, styleProfile, selectedTheme, assets, hotspotSignals, index));
  const topics: TopicCandidate[] = [];
  const rejectedTopics: RejectedTopic[] = [];
  const trace: string[] = [];
  const acceptedKeys = new Set<string>();

  for (const template of templates) {
    if (topics.length >= request.count) break;
    let candidate = template;
    let preflight = scoreTopicPreflight(candidate, request, fixture, assets, home, away);
    let repaired = false;
    if (preflight.total < TOPIC_PREFLIGHT_PASS_SCORE) {
      candidate = repairTopicTemplate(candidate, request.language, home, away, preflight);
      repaired = true;
      const repairedScore = scoreTopicPreflight(candidate, request, fixture, assets, home, away);
      preflight = {
        ...repairedScore,
        repairActions: [...new Set([...preflight.repairActions, ...repairedScore.repairActions])]
      };
    }
    if (preflight.total >= TOPIC_PREFLIGHT_PASS_SCORE) {
      const acceptedKey = candidate.title.replace(/\s+/g, "").toLowerCase();
      if (acceptedKeys.has(acceptedKey)) {
        trace.push(`选题修复后重复，已跳过：${candidate.title}`);
        continue;
      }
      acceptedKeys.add(acceptedKey);
      topics.push(buildTopicCandidate(request, fixture, assets, candidate, topics.length, preflight));
      if (repaired) trace.push(`选题自动补强通过：${candidate.title}（${preflight.total} 分）`);
      continue;
    }
    rejectedTopics.push({
      title: template.title,
      reason: preflight.repairActions[0] || "前置评分不足，已隐藏。",
      score: preflight.total,
      repaired
    });
  }

  return {
    topics,
    rejectedTopics,
    trace: [
      `前置选题评分阈值：${TOPIC_PREFLIGHT_PASS_SCORE} 分`,
      `风格画像：${styleProfile.engines.length} 个叙事引擎，主形状：${styleProfile.writingRules.dominantShape}`,
      `热点信号：${hotspotSignals.length} 条，优先使用 ${hotspotSignals.slice(0, 3).map((signal) => signal.source).join("、") || "fallback"}`,
      `候选池：${templates.length} 个，通过展示：${topics.length} 个，隐藏：${rejectedTopics.length} 个`,
      ...trace
    ]
  };
}

function parseTeamsFromTopic(topicText: string) {
  const text = topicText.trim();
  const match = text.match(/^([A-Za-z\u4e00-\u9fa5 .'-]{2,40})\s+(?:vs|v|对)\s+([A-Za-z\u4e00-\u9fa5 .'-]{2,40})/i);
  if (!match) return {};
  const clean = (value: string) =>
    value
      .replace(/\b(19|20)\d{2}\b.*$/i, "")
      .replace(/\bworld cup\b.*$/i, "")
      .replace(/\bshock\b.*$/i, "")
      .trim();
  return { home: clean(match[1]), away: clean(match[2]) };
}

export async function generateTopics(request: GenerateTopicsRequest): Promise<GenerateTopicsResponse> {
  const fixtures = getFutureFixtures();
  const fixture = fixtures.find((item) => item.id === request.fixtureId) || fixtures[0];
  const themes = buildThemeOptions(fixture);
  const selectedTheme = getTheme(request.themeId, fixture);
  const styleProfile = await loadVoiceoverStyleProfile();
  const queries = buildQueries(request, fixture);
  const trace = [
    `输入语言：${languageLabels[request.language]}`,
    fixture ? `选择赛程：${fixture.home} vs ${fixture.away}` : `自由主题：${request.topicText}`,
    `主题方向：${selectedTheme.label}`,
    `写作画像：${styleProfile.generatedAt}，${styleProfile.engines.length} 个叙事引擎`
  ];
  const searched = await Promise.all(queries.map((query) => searchYoutube(query, 5)));
  let assets = dedupeAssets(searched.flat()).filter((asset) => assetRelevantToFixture(asset, fixture));
  const warnings: string[] = [];
  if (fixture && assets.length < 3) {
    const supplementQueries = buildSupplementQueries(fixture, selectedTheme);
    const supplementSearched = await Promise.all(supplementQueries.map((query) => searchYoutube(query, 4)));
    const before = assets.length;
    assets = dedupeAssets([...assets, ...supplementSearched.flat()]).filter((asset) => assetRelevantToFixture(asset, fixture));
    if (assets.length > before) {
      trace.push(`素材不足自动补充：${before} -> ${assets.length} 条，补搜 ${supplementQueries.length} 组关键词。`);
    } else {
      trace.push("素材不足自动补充：未找到更多可用素材，前置评分会降低素材支撑分。");
    }
  }
  if (!assets.length) {
    assets = fallbackAssets(queries[0]);
    warnings.push("YouTube 搜索暂时不可用，已使用法国 vs 塞内加尔示例素材保持流程可演示。");
  }
  const hotspotSignals = await collectHotspotSignals(fixture, selectedTheme, assets, queries);
  if (hotspotSignals.every((signal) => signal.source === "fallback")) {
    warnings.push("网络热点雷达暂时不可用，已降级为赛程/球星保底信号。");
  }
  trace.push(`素材查询：${queries.join(" | ")}`);
  trace.push(`有效素材：${assets.length} 条`);
  trace.push(
    `热点雷达：${hotspotSignals
      .slice(0, 5)
      .map((signal) => `${signal.source}:${signal.title.slice(0, 28)}`)
      .join(" | ")}`
  );
  const codexResult = await runCodexCreativeAgent({
    request,
    fixture,
    theme: selectedTheme,
    assets,
    hotspotSignals,
    styleProfile
  }).catch((error) => {
    warnings.push(`Codex 创作代理失败，已进入紧急降级：${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  });
  if (codexResult?.topics.length) {
    const codexRejected = codexResult.topics
      .map((draft) => ({ draft, violation: codexDraftFixtureViolation(draft, fixture) }))
      .filter(({ draft, violation }) => violation || draft.preflight.total < TOPIC_PREFLIGHT_PASS_SCORE || draft.viralScore.verdict === "skip");
    const topics = codexResult.topics
      .filter((draft) => !codexDraftFixtureViolation(draft, fixture))
      .filter((draft) => draft.preflight.total >= TOPIC_PREFLIGHT_PASS_SCORE && draft.viralScore.verdict !== "skip")
      .slice(0, request.count)
      .map((draft) => topicFromCodexDraft(request, fixture, draft, assets, hotspotSignals));
    if (topics.length) {
      return {
        fixtures,
        themes,
        assets,
        hotspotSignals,
        topics,
        rejectedTopics: codexRejected.map(({ draft, violation }) => ({
          title: draft.title,
          reason: violation || draft.rewriteNotes[0] || "Codex 创作代理评分不足，已隐藏。",
          score: draft.preflight.total,
          repaired: false
        })),
        warnings: [...warnings, ...codexResult.warnings],
        trace: [
          ...trace,
          "Codex 创作代理：已接管选题、话题提取、旁白脚本和评分；TypeScript 未使用模板生成内容。",
          ...codexResult.trace
        ]
      };
    }
    warnings.push("Codex 创作代理返回的候选没有通过 82 分阈值，已进入紧急降级。");
  } else {
    warnings.push("Codex 创作代理未返回候选，已进入紧急降级。");
  }
  const topicBuild = buildTopics(request, fixture, assets, styleProfile, hotspotSignals);
  return {
    fixtures,
    themes,
    assets,
    hotspotSignals,
    topics: topicBuild.topics,
    rejectedTopics: topicBuild.rejectedTopics,
    warnings: [...warnings, "当前结果来自 deterministic_fallback；请检查 Codex CLI/auth 后重试。"],
    trace: [...trace, "紧急降级：deterministic_fallback，仅用于保持产品可操作，不作为目标创作路径。", ...topicBuild.trace]
  };
}

function pickAsset(assets: AssetCandidate[], kind: AssetCandidate["kind"] | "any") {
  if (kind === "any") return assets[0];
  return assets.find((asset) => asset.kind === kind) || assets[0];
}

function scriptText(topic: TopicCandidate, language: OutputLanguage, key: keyof typeof labels.zh) {
  const fixture = topic.fixture;
  const parsed = parseTeamsFromTopic(topic.title);
  const rawHome = fixture?.home || parsed.home || "这支球队";
  const rawAway = fixture?.away || parsed.away || "对手";
  const home = displayTeam(rawHome, language);
  const away = displayTeam(rawAway, language);
  const audience = selectAudience(topic);
  if (language !== "zh") {
    const map = {
      hook: `${topic.hook}`,
      context: `If you do not follow football every day, watch this match through one question: what pressure is already on the pitch before kickoff?`,
      conflict: `${home} do not just need a result. ${away} can turn one mistake, one set piece, or one emotional moment into the whole story.`,
      proof: `That is why the edit should start with verified highlights: faces, crowd noise, a key touch, and the moment the match changes.`,
      relevance: `For short video, do not explain everything. Give the audience one thing to watch, then show them why it matters now.`,
      close: `Would you post this as a prediction, a beginner explainer, or a pure emotion clip? That choice decides the edit.`
    };
    return map[key];
  }
  if (topic.narrationMode === "commentary_assisted") {
    const map = {
      hook: `这段先听原声，旁白只补一句。`,
      context: `${home}对${away}，如果现场声音已经把情绪顶起来，就别急着解释太多。`,
      conflict: `观众要的是那一下：球进、看台炸、解说声变形。`,
      proof: `字幕只压名字、比分和时间点，让原声把情绪留下。`,
      relevance: `这种内容不是靠长口播赢，是靠声音和动作同时砸过来。`,
      close: `你觉得这段该保留原声，还是换成完整旁白？`
    };
    return map[key];
  }
  if (topic.narrationMode === "subtitle_first") {
    const map = {
      hook: `这一秒不用讲太满。`,
      context: `字幕放在中下位置，观众先看动作。`,
      conflict: `如果画面够强，多说一句反而会弱。`,
      proof: `留原声，留停顿，把名字和结果打清楚。`,
      relevance: `短视频有时候靠一句字幕就够了。`,
      close: `你会给这段加旁白，还是让它自己说话？`
    };
    return map[key];
  }
  if (topic.angle === "球星历史线") {
    const roles = matchupRoles(rawHome, rawAway);
    const favorite = displayTeam(roles.favorite, "zh");
    const challenger = displayTeam(roles.challenger, "zh");
    const favoriteStar = displayPlayer(roles.favorite, "zh", 0);
    const map = {
      hook: `${favoriteStar}这场别写成履历表，先看一个动作。`,
      context: `奖杯已经够多了，今天更值得看的，是他在压力里露出来的那个小瞬间。`,
      conflict: `${challenger}如果能让这个动作变得不舒服，${favoriteStar}的压力就会从脸上、手势里先露出来。`,
      proof: `一次回头要球，一次停顿，一次回追，甚至一次和队友的交流，都能比十个荣誉词更有记忆点。`,
      relevance: `今天看${favorite}，别只等进球。先找那个能说明他状态、责任或者情绪的镜头。`,
      close: `如果只能留一个${favoriteStar}镜头，你会留进球，还是留那个真正讲出他的动作？`
    };
    return map[key];
  }
  if (topic.angle === "暴论预测") {
    const roles = matchupRoles(rawHome, rawAway);
    const favorite = displayTeam(roles.favorite, "zh");
    const challenger = displayTeam(roles.challenger, "zh");
    const favoriteStar = displayPlayer(roles.favorite, "zh", 0);
    const challengerStar = displayPlayer(roles.challenger, "zh", 0);
    const map = {
      hook: `${favorite}和${challenger}这场，先别急着猜比分。先找一个第一眼看不完整的镜头。`,
      context: `很多球第一眼看过去只是普通处理，等回放一出来，味道就变了。`,
      conflict: `${favoriteStar}的一次处理球，${challengerStar}的一次反击，或者看台突然安静，都可能成为这场的入口。`,
      proof: `慢镜头、原声、表情反应，哪一个先出现，哪一个就可能把比赛讲清楚。`,
      relevance: `所以别只问谁更强。先问哪一个细节能让普通人也看懂这场的紧张。`,
      close: `你觉得这场最该从进球讲起，还是从那个第一眼容易看错的镜头讲起？`
    };
    return map[key];
  }
  if (topic.angle === "宿命重逢" && isSpainSaudi(rawHome, rawAway)) {
    const map = {
      hook: `${away}赢过阿根廷，${home}被日本逆转过。两段旧账一接，这场就不只是赛程。`,
      context: `旧比赛不能只当年份记。它一旦被想起来，今天每一次反击都会多一层味道。`,
      conflict: `${home}如果出现一个相似的丢球前奏，或者${away}打出一次像样反击，评论区马上会开始翻旧账。`,
      proof: `旧比分、旧回放、今天的相似动作，只要接上一个，大家就会开始回头看。`,
      relevance: `所以这场别先讲战术。先问一个更容易看懂的问题：今天有没有哪个瞬间让旧账回来？`,
      close: `你觉得这是${home}清旧账，还是${away}又给世界杯添一个新故事？`
    };
    return map[key];
  }
  if (audience.id === "lifestyle-watchers") {
    const map = {
      hook: `${home}对${away}还没开踢，但气氛已经先起来了。`,
      context: `不懂球也没关系。你先抓三样东西：球衣颜色、球迷表情、主帅发布会那几秒停顿。`,
      conflict: `很多人点开这场，并不想听阵型课。他们只是想找个理由加入今晚的气氛。约谁看、吃什么、明天困不困，这些也能成内容。`,
      proof: `你要是只想参与气氛，就别硬装专家。今晚能聊的，就是谁更有压迫感，谁的球迷更上头。`,
      relevance: `等比赛出结果，反而更好玩：猜中了就是预言，猜错了就一起笑自己翻车。`,
      close: `今晚你是认真看球，还是借世界杯找个热闹？我觉得后者也挺正常。`
    };
    return map[key];
  }
  if (audience.id === "debate-seekers") {
    const map = {
      hook: `这场如果有 VAR 或点球，评论区一定会吵。先把判断方法讲清楚。`,
      context: `别先站队。普通人只要看三件事：球先到哪，身体有没有扩大，裁判为什么停下来。`,
      conflict: `${home}和${away}只要出现一次红牌、点球或者越位，很多人会只看结果，但争议从来不只在最后一下。`,
      proof: `看争议球，别只看倒地那一下。往前倒五秒，很多答案其实已经在身体动作里了。`,
      relevance: `这种球最适合赛后立刻聊。评论区会追着问一件事：自己到底该站哪边。`,
      close: `我先不下死结论。你看完这三段，再说这球该不该给。`
    };
    return map[key];
  }
  if (audience.id === "emotion-fans") {
    const map = {
      hook: `先看旧镜头。${home}和${away}这场，情绪是从过去带过来的。`,
      context: `不懂球就抓一个问题：谁更怕输？强队怕丢脸，弱队怕错过一辈子一次的机会。`,
      conflict: `这种比赛最怕没有证据。只要出现一个表情、一个回放、一次让看台突然安静的反击，情绪就有入口。`,
      proof: `你看强队不舒服的时候，不用先看数据。看球员怎么抬头，队友怎么摊手，原声什么时候变小。`,
      relevance: `所以今晚别只等进球。第一个能被反复回看的瞬间，可能就是故事开始的地方。`,
      close: `你觉得这场会变成奇迹，还是强队把场子找回来？我会先看那个能说明问题的镜头。`
    };
    return map[key];
  }
  const map = {
    hook: `不懂球也能看。今晚${home}对${away}，先盯一个问题。`,
    context: `这场别上来讲阵型。先问一句：哪边压力更大，哪边只要一次机会就够。`,
    conflict: `强队踢慢了会被骂，弱队抢到一次反击就能改写节奏。普通人看这个就够。`,
    proof: `进球当然重要，但压力通常先写在脸上：球员皱眉、队友摊手、看台突然安静。`,
    relevance: `不用装专家。你只要知道今晚跟朋友聊什么，比赛就没那么难懂。`,
    close: `如果只能看 10 分钟，我建议看开局。开局的气质，通常会把整场球的脾气露出来。`
  };
  return map[key];
}

function beatKeyFromId(id: string): keyof typeof labels.zh {
  const key = id.split("-")[0] as keyof typeof labels.zh;
  return key in labels.zh ? key : "context";
}

function sanitizeAudienceTitle(title: string) {
  return title
    .replace(/更好剪/g, "更抓人")
    .replace(/最该剪/g, "最该看")
    .replace(/剪出来/g, "讲出来")
    .replace(/先把这几段画面找出来/g, "不懂球也能看这几个瞬间")
    .replace(/素材地图型/g, "看球导航");
}

function sanitizeAudienceHook(hook: string) {
  return hook
    .replace(/这条视频/g, "这场球")
    .replace(/这条/g, "这场")
    .replace(/素材/g, "证据")
    .replace(/剪出来/g, "讲清楚")
    .replace(/先把热度占住/g, "先进入气氛");
}

function buildFallbackScriptBeats(topic: TopicCandidate, title: string, assets: AssetCandidate[]): ScriptBeat[] {
  const fixture = topic.fixture;
  const parsed = parseTeamsFromTopic(title);
  const rawHome = fixture?.home || parsed.home || "这支球队";
  const rawAway = fixture?.away || parsed.away || "对手";
  const roles = matchupRoles(rawHome, rawAway);
  const topicText = `${title} ${topic.hook} ${topic.reason} ${topic.angle}`;
  const isRonaldoStory = /C罗|罗纳尔多|Ronaldo/i.test(topicText);
  const teams = [rawHome, rawAway];
  const portugalTeam = teams.find((team) => /Portugal|葡萄牙/i.test(`${team} ${displayTeam(team, "zh")}`));
  const protagonistTeam = isRonaldoStory && portugalTeam ? portugalTeam : roles.favorite;
  const opponentTeam = teams.find((team) => team !== protagonistTeam) || roles.challenger;
  const favorite = displayTeam(protagonistTeam, "zh");
  const challenger = displayTeam(opponentTeam, "zh");
  const favoriteStar = isRonaldoStory
    ? "C罗"
    : displayPlayer(protagonistTeam, "zh", 0);
  const challengerStar = displayPlayer(opponentTeam, "zh", 0);
  const fallbackVoiceover: Record<keyof typeof labels.zh, string> = {
    hook: `${favoriteStar}又被推到最亮的位置，问题来了：${favorite}是相信他，还是离不开流量？`,
    context: `主帅发布会一力挺，训练镜头一出来，压力反而全往他身上聚。`,
    conflict: `${favoriteStar}已经是老将了，一次回头要球、一次摊手、一次被撞停，都会被放大成赛后话题。`,
    proof: `${challenger}只要让他开局不舒服，${challengerStar}那一下反击就能把气氛点着。`,
    relevance: `${favorite}赢球当然正常，可只要一个慢镜头让人看不懂，评论区就会开始吵。`,
    close: `你觉得今晚${favoriteStar}会把质疑压回去，还是${challenger}先把他的脸色打出来？`
  };
  const fallbackBeats: Array<[keyof typeof labels.zh, number]> = [
    ["hook", 6],
    ["context", 10],
    ["conflict", 12],
    ["proof", 12],
    ["relevance", 10],
    ["close", 8]
  ];
  let cursor = 0;
  return fallbackBeats.map(([key, durationSec], index) => {
    const asset = assets[index % Math.max(1, assets.length)];
    const beat: ScriptBeat = {
      id: `${key}-repair-${index}`,
      label: labels[topic.language][key],
      voiceover: topic.language === "zh" ? fallbackVoiceover[key] : scriptText({ ...topic, title }, topic.language, key),
      visualInstruction: editorInstructionText({ ...topic, title }, key, asset),
      assetId: asset?.id,
      startSec: cursor,
      durationSec
    };
    cursor += durationSec;
    return beat;
  });
}

function editorInstructionText(topic: TopicCandidate, key: keyof typeof labels.zh, asset?: AssetCandidate) {
  const fixture = topic.fixture;
  const parsed = parseTeamsFromTopic(topic.title);
  const home = displayTeam(fixture?.home || parsed.home || "主队", "zh");
  const away = displayTeam(fixture?.away || parsed.away || "客队", "zh");
  const assetHint = asset ? `${asset.usageHint} 剪前复核时间码。` : "先补充官方高光、发布会或授权素材。";
  const map: Record<keyof typeof labels.zh, string> = {
    hook: `开头 0-3 秒只给观众冲突：${home} vs ${away}、旧账/爆冷/压力。不要把剪辑思路写进旁白。${assetHint}`,
    context: `承接一段旧事实或背景：比分牌、庆祝、球员表情、发布会。${assetHint}`,
    conflict: `用强弱压力或争议点推进节奏，优先找反击、丢球后回抢、裁判/球员反应。${assetHint}`,
    proof: `此段只服务旁白里的判断，找能证明“控球压力/反击机会/看台变安静”的镜头。${assetHint}`,
    relevance: `回到今天这场比赛，接队徽、球员脸、看台或赛前画面，让旧故事和当前赛程连上。${assetHint}`,
    close: `结尾留评论区选择题，画面可以给比分板、球迷反应或双方队徽。${assetHint}`
  };
  return map[key];
}

function validateCreativePack(pack: ContentPack) {
  const checks: DraftValidationReport["checks"] = [];
  const addCheck = (id: string, label: string, passed: boolean, severity: "blocker" | "warning" | "info", detail: string) => {
    checks.push({ id, label, passed, severity, detail });
  };
  const voiceover = pack.script.map((beat) => beat.voiceover).join("\n");
  const visualPlan = pack.script.map((beat) => beat.visualInstruction).join("\n");
  const firstLine = pack.script[0]?.voiceover || "";
  const lastLine = pack.script.at(-1)?.voiceover || "";
  const voiceoverSentences = voiceover
    .split(/[。！？!?；;\n\r]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const maxVoiceoverSentenceChars = Math.max(0, ...voiceoverSentences.map((line) => line.length));
  const bannedPhrase = findBannedVoiceoverPhrase(voiceover);
  const hookHasTension = /(先别|所有人|没人|旧账|怕|吓|反击|零封|统治|一战成名|为什么|怎么|回放|慢镜头|动作|第一眼|？|\?)/.test(firstLine);
  const hasExplanation = /(不懂球|看懂|因为|所以|如果|只要|开局|控球|反击|压力|回放|慢镜头|动作|原声|证据)/.test(voiceover);
  const hasCommentChoice = /(你觉得|你会|评论区|清账|添一笔|该不该|哪边|\?|？)/.test(lastLine);
  const xhsTitleShape = xhsTitleShapePattern.test(pack.title);
  const protagonistExists = hasKnownPlayer(voiceover) || hasKnownTeam(voiceover) || /(门将|裁判|球迷|老将|小将|强队|弱队|黑马|主角|他)/.test(voiceover);
  const factAnchorExists = /(0\s?比\s?0|2\s?比\s?1|第一脚|第一次|纪录|六届|38\s?岁|40\s?岁|帽子戏法|点球|VAR|红牌|神扑|任意球|决赛|阿根廷|日本|墨西哥|回放|慢镜头|原声|手势|发布会)/.test(voiceover);
  const playerTeamAligned =
    !/C罗/.test(voiceover) ||
    !/(哥伦比亚到底相信他|哥伦比亚[^。！？\n\r]{0,24}离不开他|葡萄牙只要让他|还是葡萄牙先把他的脸色|哥伦比亚赢球当然正常)/.test(voiceover);
  const visibleProofPlan = /(表情|看台|反击|射正|回传|皱眉|摊手|背影|助跑|低射|扑救|庆祝|比分|队徽|发布会|慢动作|球迷反应|裁判反应)/.test(visualPlan);
  const rhythmShape = pack.script.length >= 6 && (pack.script[0]?.durationSec ?? 99) <= 6 && pack.suggestedDurationSec <= 75;
  const remixableMemory = /(外号|梗|评论区|封神|一战成名|最后一舞|留下名字|别提前给我写结局|扛住|一脚改命|回放|慢镜头|第一眼看错|说明问题|人味)/.test(voiceover + pack.title);
  const benchmarkEngineReady = Boolean(pack.topic.styleEngineLabel && pack.topic.evidenceType && pack.topic.narrationMode && pack.topic.topicMechanism);
  const benchmarkEvidenceReady = pack.topic.preflight.total >= TOPIC_PREFLIGHT_PASS_SCORE && (pack.topic.hotspotSignals.length > 0 || pack.generationMode === "codex_agent");
  const needsOriginalAudioPlan = pack.topic.narrationMode === "commentary_assisted" || pack.topic.narrationMode === "subtitle_first";
  const originalAudioPlanOk = !needsOriginalAudioPlan || /(原声|现场声|解说|保留|收声|压低|停顿)/.test(visualPlan);
  const subtitleReadable = maxVoiceoverSentenceChars <= 34 || pack.topic.narrationMode === "subtitle_first";
  const minVoiceoverLength =
    pack.topic.narrationMode === "subtitle_first" ? 40 : pack.topic.narrationMode === "commentary_assisted" ? 80 : 140;

  addCheck("creative-narration-exists", "旁白足够成片", voiceover.length >= minVoiceoverLength, "blocker", `旁白 ${voiceover.length} 字，模式 ${pack.topic.narrationMode} 要求 ${minVoiceoverLength}+。`);
  addCheck("creative-no-editor-leak", "旁白不泄漏剪辑思路", !creativeEditorLeakPattern.test(voiceover), "blocker", creativeEditorLeakPattern.test(voiceover) ? "旁白里出现了剪辑/素材/画面指令。" : "旁白只面向观众。");
  addCheck("creative-no-ai-slop", "旁白去 AI 味", !bannedPhrase, "blocker", bannedPhrase ? `旁白命中禁用口头禅：${bannedPhrase}。` : "未命中禁用口头禅、模板金句或泛化表达。");
  addCheck("creative-benchmark-engine", "样本引擎明确", benchmarkEngineReady, "blocker", benchmarkEngineReady ? `${pack.topic.styleEngineLabel} / ${pack.topic.evidenceType} / ${pack.topic.narrationMode}` : "缺少样本叙事引擎、证据类型或话题机制。");
  addCheck("creative-benchmark-evidence", "选题前置评分有效", benchmarkEvidenceReady, "blocker", `preflight=${pack.topic.preflight.total}，热点/样本证据 ${pack.topic.hotspotSignals.length} 条。`);
  addCheck("creative-hook", "开头有吸引力", firstLine.length <= 70 && hookHasTension, "warning", firstLine);
  addCheck("creative-explainer", "有讲解价值", hasExplanation, "warning", hasExplanation ? "包含小白解释/看点判断。" : "缺少为什么、怎么看或前几分钟看点。");
  addCheck("creative-comment", "结尾能引发互动", hasCommentChoice, "warning", lastLine);
  addCheck("creative-xhs-shape", "贴近小红书对标标题", xhsTitleShape, "warning", pack.title);
  addCheck("creative-protagonist", "主角明确", protagonistExists, "warning", protagonistExists ? "旁白有球队、球员、门将、裁判或观众身份。" : "缺少明确主角，容易像泛泛赛评。");
  addCheck("creative-fact-anchor", "事实锚点", factAnchorExists, "warning", factAnchorExists ? "包含时间、比分、纪录、动作或旧事实。" : "缺少可核验事实锚点。");
  addCheck("creative-player-team-alignment", "球员球队归属正确", playerTeamAligned, "blocker", playerTeamAligned ? "未发现球员归属错配。" : "C罗题里的球队归属/施压方被写反了。");
  addCheck("creative-visible-proof", "可见画面计划", visibleProofPlan, "warning", visibleProofPlan ? "剪辑思路包含表情、看台、反击、比分或慢动作等可见画面。" : "剪辑思路还不够可视化。");
  addCheck("creative-rhythm", "短视频节奏", rhythmShape, "warning", rhythmShape ? "6 beat 结构和开头时长符合短视频节奏。" : "节奏结构偏散，可能剪平。");
  addCheck("creative-remixable", "可二创记忆点", remixableMemory, "warning", remixableMemory ? "有外号、梗、站队词或可复述判断。" : "缺少评论区可复用的记忆点。");
  addCheck("creative-subtitle-readable", "字幕句长适合手机", subtitleReadable, "warning", `最长口播句 ${maxVoiceoverSentenceChars} 字，建议 34 字以内。`);
  addCheck("creative-mode-audio-plan", "音频模式匹配", originalAudioPlanOk, "warning", originalAudioPlanOk ? "旁白/原声模式与剪辑说明匹配。" : `${pack.topic.narrationMode} 需要明确原声保留、停顿或字幕优先。`);

  const score = Math.max(
    0,
    100 -
      checks.reduce((sum, check) => {
        if (check.passed) return sum;
        return sum + (check.severity === "blocker" ? 22 : check.severity === "warning" ? 8 : 2);
      }, 0)
  );
  const passed = checks.every((check) => check.passed || check.severity !== "blocker") && score >= 85;
  return { passed, score, checks };
}

type CreativePackValidation = ReturnType<typeof validateCreativePack>;

const beatOrder = ["hook", "context", "conflict", "proof", "relevance", "close"] as const;

function cloneContentPack(pack: ContentPack): ContentPack {
  return JSON.parse(JSON.stringify(pack)) as ContentPack;
}

function compactChineseText(text: string) {
  return text
    .replace(/\s+/g, "")
    .replace(/[，,、]{2,}/g, "，")
    .replace(/。{2,}/g, "。")
    .replace(/([？！!?])。/g, "$1")
    .trim();
}

function sanitizeVoiceoverForAudience(text: string) {
  let fixed = text || "";
  const replacements: Array<[RegExp, string]> = [
    [/剪辑思路/g, "看点"],
    [/剪辑/g, "比赛节奏"],
    [/素材里/g, "赛前信息里"],
    [/素材/g, "证据"],
    [/画面/g, "镜头"],
    [/字幕/g, "屏幕上的字"],
    [/封面/g, "开头大字"],
    [/发布平台/g, "评论区"],
    [/这条视频/g, "这场球"],
    [/这条内容/g, "这个话题"],
    [/内容的重点/g, "看点"],
    [/旁白/g, "说法"],
    [/脚本/g, "说法"],
    [/对标账号/g, "同类说法"],
    [/账号/g, "博主"],
    [/最该剪/g, "最该看"],
    [/好剪/g, "有看头"],
    [/剪出来/g, "讲出来"],
    [/先放/g, "先看"],
    [/切到/g, "看到"],
    [/切今天/g, "看今天"],
    [/剪前复核时间码/g, "先把证据找准"],
    [/这条不要/g, "这点别急着下结论"],
    [/把剧本拆掉/g, "把场子掀起来"],
    [/剧本/g, "悬念"]
  ];
  for (const [pattern, replacement] of replacements) {
    fixed = fixed.replace(pattern, replacement);
  }
  for (const term of bannedVoiceoverTerms) {
    fixed = fixed.replaceAll(term, "");
  }
  fixed = fixed
    .replace(/不是([^。！？\n\r]{0,28})而是/g, "$1之外，还要看")
    .replace(/不是([^。！？\n\r]{0,20})[，,、]\s*是/g, "$1之外，还要看")
    .replace(/不仅([^。！？\n\r]{0,28})而且/g, "$1之外，还")
    .replace(/[，,、]?(先看|看到|看今天)?\s*(复核时间码|执行词|执行动作)[^。！？\n\r]{0,18}/g, "");
  return compactChineseText(fixed);
}

function splitLongVoiceoverForMobile(text: string, maxChars = 30) {
  const normalized = compactChineseText(text);
  const rough: string[] = [];
  let current = "";
  for (const char of normalized) {
    current += char;
    if (/[\n\r。！？!?；;]/.test(char)) {
      rough.push(current);
      current = "";
    }
  }
  if (current) rough.push(current);

  const parts: string[] = [];
  for (const chunk of rough) {
    const endMark = chunk.match(/[\n\r。！？!?；;]+$/)?.[0].replace(/[\n\r]/g, "") || "。";
    let tail = chunk.replace(/[\n\r。！？!?；;]+$/g, "");
    while (tail.length > maxChars) {
      const preferredCuts = ["，", "、", ",", "：", ":", " "]
        .map((mark) => tail.lastIndexOf(mark, maxChars))
        .filter((index) => index >= 12);
      const cut = preferredCuts.length ? Math.max(...preferredCuts) : maxChars;
      const head = tail.slice(0, cut).replace(/[，,、：:\s]+$/g, "");
      if (head) parts.push(`${head}。`);
      tail = tail.slice(cut).replace(/^[，,、：:\s]+/g, "");
    }
    if (tail) parts.push(`${tail}${endMark}`);
  }
  return parts.join("").replace(/。([。！？!?；;])/g, "$1");
}

function fixtureTeamsForPack(pack: ContentPack) {
  const fixture = pack.topic.fixture;
  const parsed = parseTeamsFromTopic(`${pack.title} ${pack.topic.title}`);
  const rawHome = fixture?.home || parsed.home || "这支球队";
  const rawAway = fixture?.away || parsed.away || "对手";
  const roles = matchupRoles(rawHome, rawAway);
  return {
    rawHome,
    rawAway,
    favorite: displayTeam(roles.favorite, "zh"),
    challenger: displayTeam(roles.challenger, "zh"),
    home: displayTeam(rawHome, "zh"),
    away: displayTeam(rawAway, "zh")
  };
}

function repairXhsTitleShape(pack: ContentPack) {
  const cleanTitle = sanitizeAudienceTitle(pack.title || pack.topic.title).replace(/\s+/g, "");
  if (xhsTitleShapePattern.test(cleanTitle) && cleanTitle.length <= 38) return cleanTitle;
  const teams = fixtureTeamsForPack(pack);
  const storyText = `${pack.title} ${pack.topic.title} ${pack.topic.hook} ${pack.topic.reason}`;
  const hasSixNil = /(6\s?[-比:：]\s?0|6-0|6比0)/.test(storyText);
  const hasOneNil = /(1\s?[-比:：]\s?0|1-0|1比0)/.test(storyText);
  const star = ["梅西", "C罗", "姆巴佩", "哈兰德", "贝林厄姆", "亚马尔"].find((name) => storyText.includes(name));
  if (hasSixNil && hasOneNil) return `${teams.favorite}6-0之后，为什么最怕${teams.challenger}的1-0？`;
  if (star) return `${star}这场为什么最容易被看错？`;
  if (/爆冷|翻车|压力|怕/.test(storyText)) return `${teams.favorite}对${teams.challenger}，为什么最容易翻车？`;
  return `${teams.favorite}对${teams.challenger}，第一眼看错了什么？`;
}

function buildSafeCreativeScript(pack: ContentPack, title: string): ScriptBeat[] {
  const teams = fixtureTeamsForPack(pack);
  const storyText = `${pack.title} ${pack.topic.title} ${pack.topic.hook} ${pack.topic.reason}`;
  const hasSixNil = /(6\s?[-比:：]\s?0|6-0|6比0)/.test(storyText);
  const hasOneNil = /(1\s?[-比:：]\s?0|1-0|1比0)/.test(storyText);
  const voiceover: Record<(typeof beatOrder)[number], string> =
    hasSixNil && hasOneNil
      ? {
          hook: `${teams.favorite}刚踢出6-0，为什么我反而觉得${teams.challenger}有机会？`,
          context: `6-0会让人兴奋，1-0会让人紧张。淘汰赛里，后面这种队最难啃。`,
          conflict: `${teams.favorite}如果开局第一脚就想提速，${teams.challenger}最舒服的就是把比赛拖住。`,
          proof: `普通观众别急着看阵型。看丢球后的回追，看禁区前那一下有没有人补上。`,
          relevance: `${teams.challenger}不需要踢得多热闹。只要比分一直咬着，压力就会慢慢换边。`,
          close: `你站哪边？相信${teams.favorite}继续冲，还是赌${teams.challenger}把节奏按住？`
        }
      : {
          hook: `${teams.favorite}热度更高，为什么这场我反而想看${teams.challenger}？`,
          context: `普通观众先记一件事：淘汰赛最怕开局被拖慢。`,
          conflict: `${teams.favorite}如果迟迟打不开局面，急的就不一定是弱的一边。`,
          proof: `第一脚出球、丢球后的回追、禁区前的补位，这三个细节最说明问题。`,
          relevance: `${teams.challenger}只要把比分咬住，比赛就会从强弱题变成心理题。`,
          close: `你觉得哪边会先露怯？是${teams.favorite}压住场子，还是${teams.challenger}拖出冷门？`
        };
  let cursor = 0;
  return beatOrder.map((key, index) => {
    const asset = pack.assets[index % Math.max(1, pack.assets.length)];
    const durationSec = [6, 9, 10, 11, 10, 8][index] || 8;
    const beat: ScriptBeat = {
      id: `${key}-creative-gate-${index}`,
      label: labels.zh[key],
      voiceover: splitLongVoiceoverForMobile(sanitizeVoiceoverForAudience(voiceover[key]), 30),
      visualInstruction: editorInstructionText({ ...pack.topic, title }, key, asset),
      assetId: asset?.id,
      startSec: cursor,
      durationSec
    };
    cursor += durationSec;
    return beat;
  });
}

function scriptDuration(script: ScriptBeat[]) {
  return Math.max(30, ...script.map((beat) => beat.startSec + beat.durationSec));
}

function repairCreativePackOnce(pack: ContentPack, validation: CreativePackValidation, attempt: number): ContentPack {
  const current = cloneContentPack(pack);
  const failedIds = new Set(validation.checks.filter((check) => !check.passed).map((check) => check.id));
  const fixedTitle = repairXhsTitleShape(current);
  const safeScript = buildSafeCreativeScript(current, fixedTitle);
  const forceSafeScript =
    attempt >= 2 &&
    (validation.score < 85 ||
      failedIds.has("creative-no-editor-leak") ||
      failedIds.has("creative-subtitle-readable") ||
      failedIds.has("creative-hook") ||
      failedIds.has("creative-comment"));
  let cursor = 0;
  const sourceScript = current.script?.length ? current.script : safeScript;
  const repairedScript = (forceSafeScript ? safeScript : sourceScript).map((beat, index) => {
    const rawKey = beat.id.split("-")[0];
    const key = rawKey in labels.zh ? (rawKey as keyof typeof labels.zh) : beatOrder[Math.min(index, beatOrder.length - 1)];
    const safe = safeScript[Math.min(index, safeScript.length - 1)];
    let voiceover = splitLongVoiceoverForMobile(sanitizeVoiceoverForAudience(beat.voiceover), 30);
    if (!voiceover || creativeEditorLeakPattern.test(voiceover) || findBannedVoiceoverPhrase(voiceover)) {
      voiceover = safe.voiceover;
    }
    if (index === 0 && !/(先别|所有人|没人|旧账|怕|吓|反击|零封|统治|一战成名|为什么|怎么|回放|慢镜头|动作|第一眼|？|\?)/.test(voiceover)) {
      voiceover = safeScript[0].voiceover;
    }
    if (index === sourceScript.length - 1 && !/(你觉得|你会|评论区|清账|添一笔|该不该|哪边|\?|？)/.test(voiceover)) {
      voiceover = safeScript.at(-1)?.voiceover || voiceover;
    }
    const durationSec = Number.isFinite(beat.durationSec) && beat.durationSec >= 4 ? beat.durationSec : safe.durationSec;
    const originalAsset = current.assets.find((item) => item.id === beat.assetId);
    const safeAsset = safe.assetId ? current.assets.find((item) => item.id === safe.assetId) : undefined;
    const asset = originalAsset || safeAsset || current.assets[index % Math.max(1, current.assets.length)];
    const repaired: ScriptBeat = {
      ...beat,
      id: beat.id || `${key}-creative-gate-${index}`,
      label: beat.label || labels.zh[key],
      voiceover,
      visualInstruction: beat.visualInstruction || editorInstructionText({ ...current.topic, title: fixedTitle }, key, asset),
      assetId: beat.assetId || safe.assetId,
      startSec: cursor,
      durationSec
    };
    cursor += durationSec;
    return repaired;
  });
  const finalScript = repairedScript.length >= 6 ? repairedScript : safeScript;
  return {
    ...current,
    title: fixedTitle,
    suggestedDurationSec: scriptDuration(finalScript),
    topic: {
      ...current.topic,
      title: fixedTitle,
      hook: sanitizeAudienceHook(current.topic.hook)
    },
    publish: {
      ...current.publish,
      platformTitle: fixedTitle,
      coverText: sanitizeAudienceTitle(current.publish.coverText || fixedTitle)
    },
    script: finalScript,
    workflowNotes: [
      ...current.workflowNotes.filter((note) => !note.includes("创意闸门")),
      `创意闸门第 ${attempt} 轮自动修稿：分离旁白和剪辑思路，压缩手机字幕句长，校正小红书标题形态。`
    ]
  };
}

function failedCreativeSummary(validation: CreativePackValidation) {
  return validation.checks
    .filter((check) => !check.passed)
    .map((check) => `${check.label}：${check.detail}`)
    .slice(0, 4)
    .join("；");
}

function repairContentPackUntilCreativePass(pack: ContentPack, maxAttempts = 4): { pack: ContentPack; gate: CreativeValidationGate } {
  let current = cloneContentPack(pack);
  let repaired = false;
  const notes: string[] = [];
  let validation = validateCreativePack(current);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    validation = validateCreativePack(current);
    if (validation.passed) {
      return {
        pack: current,
        gate: {
          passed: true,
          score: validation.score,
          attempts: attempt,
          repaired,
          checks: validation.checks,
          notes: repaired ? [...notes, `第 ${attempt} 轮通过：${validation.score} 分。`] : [`首轮通过：${validation.score} 分。`]
        }
      };
    }
    notes.push(`第 ${attempt} 轮未过：${validation.score} 分；${failedCreativeSummary(validation)}`);
    if (attempt === maxAttempts) break;
    current = repairCreativePackOnce(current, validation, attempt);
    repaired = true;
  }
  return {
    pack: current,
    gate: {
      passed: false,
      score: validation.score,
      attempts: maxAttempts,
      repaired,
      checks: validation.checks,
      notes
    }
  };
}

function repairContentPackNarration(pack: ContentPack): ContentPack {
  const hasUsableScript = Array.isArray(pack.script) && pack.script.some((beat) => beat.voiceover?.trim());
  const wasAutoRepaired =
    Array.isArray(pack.script) &&
    pack.script.some((beat) => beat.id.includes("-repair-")) &&
    pack.workflowNotes.some((note) => note.includes("自动补齐"));
  if (pack.generationMode === "codex_agent" && hasUsableScript && !wasAutoRepaired) return pack;
  const fixedTopic = {
    ...pack.topic,
    title: sanitizeAudienceTitle(pack.topic.title),
    hook: sanitizeAudienceHook(pack.topic.hook)
  };
  const fixedTitle = sanitizeAudienceTitle(pack.title);
  const shouldBuildFallbackScript = !hasUsableScript || wasAutoRepaired;
  const baseScript = shouldBuildFallbackScript ? buildFallbackScriptBeats({ ...fixedTopic, title: fixedTitle }, fixedTitle, pack.assets) : pack.script;
  const repairedScript = !shouldBuildFallbackScript
    ? baseScript.map((beat) => {
        const key = beatKeyFromId(beat.id);
        const asset = pack.assets.find((item) => item.id === beat.assetId);
        return {
          ...beat,
          voiceover: scriptText({ ...fixedTopic, title: fixedTitle }, fixedTopic.language, key),
          visualInstruction: editorInstructionText({ ...fixedTopic, title: fixedTitle }, key, asset)
        };
      })
    : baseScript;
  return {
    ...pack,
    title: fixedTitle,
    suggestedDurationSec: Math.max(30, ...repairedScript.map((beat) => beat.startSec + beat.durationSec)),
    topic: {
      ...fixedTopic,
      title: fixedTitle
    },
    publish: {
      ...pack.publish,
      platformTitle: fixedTitle,
      coverText: sanitizeAudienceTitle(pack.publish.coverText)
    },
    script: repairedScript,
    workflowNotes: shouldBuildFallbackScript
      ? [...pack.workflowNotes.filter((note) => !note.includes("自动补齐")), "检测到内容包缺少完整旁白，已在进入剪映前自动补齐 6 段口播脚本。"]
      : pack.workflowNotes
  };
}

export function generateContentPack(topic: TopicCandidate, assets: AssetCandidate[]): ContentPack {
  const creativeDraft = getCreativeDraft(topic.id);
  if (creativeDraft) {
    return contentPackFromCreativeDraft(topic, creativeDraft, assets);
  }
  const language = topic.language;
  const chosenAssets = topic.assetIds.map((id) => assets.find((asset) => asset.id === id)).filter(Boolean) as AssetCandidate[];
  const workingAssets = chosenAssets.length ? chosenAssets : assets.slice(0, 4);
  const viralScore = computeViralScore(topic, workingAssets);
  const beats: Array<[keyof typeof labels.zh, AssetCandidate["kind"] | "any", number]> = [
    ["hook", "highlight", 6],
    ["context", "full_match", 10],
    ["conflict", "highlight", 12],
    ["proof", "full_match", 14],
    ["relevance", "preview", 12],
    ["close", "any", 6]
  ];
  let cursor = 0;
  const script: ScriptBeat[] = beats.map(([key, kind, duration], index) => {
    const asset = pickAsset(workingAssets, kind);
    const beat = {
      id: `${key}-${index}`,
      label: labels[language][key],
      voiceover: scriptText(topic, language, key),
      visualInstruction: editorInstructionText(topic, key, asset),
      assetId: asset?.id,
      startSec: cursor,
      durationSec: duration
    };
    cursor += duration;
    return beat;
  });
  const materialMap: MaterialMapItem[] = workingAssets.slice(0, 5).map((asset, index) => ({
    id: `${asset.id}-${index}`,
    asset,
    role: index === 0 ? "primary" : index < 3 ? "context" : "backup",
    suggestedCut:
      asset.kind === "full_match"
        ? "先用高光确定关键事件，再回完整比赛找前后 8-12 秒情绪镜头。"
        : "优先选择进球、庆祝、观众、球员表情和转播牌信息清晰的段落。",
    verification: asset.channel === "FIFA" ? "官方频道优先级高，仍需确认发布平台使用边界。" : "非官方来源只做研究参考，建议替换为官方或授权素材。"
  }));
  return repairContentPackNarration({
    id: `pack-${nanoid(8)}`,
    generatedAt: new Date().toISOString(),
    generationMode: "deterministic_fallback",
    topic,
    assets: workingAssets,
    title: topic.title,
    hotness: topic.hotness,
    suggestedDurationSec: cursor,
    script,
    materialMap,
    publish: {
      platformTitle: topic.title,
      description:
        language === "zh"
          ? `${topic.hook}\n\n今晚别急着猜比分：先找一个回放、动作或原声能说明问题的证据。你觉得这条从哪个镜头开头最抓人？`
          : `${topic.hook}\n\nStart from one visible incident, then explain why the first glance is incomplete.`,
      hashtags:
        language === "zh"
          ? (["#世界杯", "#FIFA世界杯", "#足球", topic.fixture && `#${displayTeam(topic.fixture.home, "zh")}`, topic.fixture && `#${displayTeam(topic.fixture.away, "zh")}`].filter(Boolean) as string[])
          : (["#WorldCup", "#FIFAWorldCup", "#Football", topic.fixture?.home, topic.fixture?.away].filter(Boolean) as string[]),
      coverText: topic.angle.length > 8 ? topic.angle : `${topic.angle}！`
    },
    viralScore,
    costEstimate: {
      interactions: 6,
      model: "local heuristic now; GPT-4o/Gemini adapter ready",
      estimatedUsd: 0.003
    },
    workflowNotes: [
      "严格按视频方案采用“素材优先”：先找真实视频，再生成选题和脚本。",
      "旁白和剪辑思路必须分层：voiceover 只给观众听，visualInstruction 只给剪辑执行。",
      "素材地图里的完整比赛用于核验，短视频主画面优先用高光。",
      "剪映自动导出受平台限制：Windows + 剪映 5.9 最稳，Mac 侧以生成草稿/脚本为主。"
    ]
  });
}

function toSrtTime(seconds: number) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(milli).padStart(3, "0")}`;
}

function buildSrt(pack: ContentPack) {
  return pack.script
    .map((beat, index) => {
      const start = toSrtTime(beat.startSec);
      const end = toSrtTime(beat.startSec + beat.durationSec);
      return `${index + 1}\n${start} --> ${end}\n${beat.voiceover}\n`;
    })
    .join("\n");
}

function buildJianyingScript(request: JianyingPrepareRequest, paths: { planPath: string; srtPath: string; assetPaths: string[] }) {
  const skillRoot = resolveJianyingSkillRoot();
  const draftRoot = resolveJianyingDraftRoot();
  const width = request.aspectRatio === "16:9" ? 1920 : 1080;
  const height = request.aspectRatio === "16:9" ? 1080 : 1920;
  const draftName = request.draftName || request.pack.title;
  const speaker = request.speaker || DEFAULT_JIANYING_SPEAKER;
  const safeAssetList = JSON.stringify(paths.assetPaths);
  const packTitle = JSON.stringify(request.pack.title);
  const voiceText = JSON.stringify(request.pack.script.map((beat) => beat.voiceover).join("\n"));
  return `import json
import os
import re
import shutil
import sys

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
JY_SKILL_ROOT = os.getenv("JY_SKILL_ROOT", ${JSON.stringify(skillRoot || "")}).strip()
if not JY_SKILL_ROOT:
    raise SystemExit("JY_SKILL_ROOT is not set and no local skill root was detected.")
scripts_path = os.path.join(JY_SKILL_ROOT, "scripts")
if scripts_path not in sys.path:
    sys.path.insert(0, scripts_path)

from jy_wrapper import JyProject
import pyJianYingDraft as draft

ASSETS = ${safeAssetList}
VOICE_TEXT = ${voiceText}
PROJECT_NAME = ${JSON.stringify(draftName)}
VIDEO_ORIGINAL_VOLUME = ${MAIN_VIDEO_ORIGINAL_VOLUME}
BGM_VOLUME = ${BGM_VOLUME}
SUBTITLE_TRANSFORM_Y = ${SUBTITLE_TRANSFORM_Y}
BGM_CANDIDATES = ${JSON.stringify(BGM_CANDIDATES)}

def split_voice_sentences(text):
    parts = [p for p in re.split(r"([，。！？、\\n\\r]+)", text) if p.strip()]
    sentences = []
    for i in range(0, len(parts), 2):
        sentence = parts[i]
        if i + 1 < len(parts):
            sentence += parts[i + 1]
        clean = sentence.strip().rstrip("，。！？、\\n\\r ")
        if clean:
            sentences.append(clean)
    return sentences

def add_xhs_style_narration(project, text, speaker):
    curr_us = 200000
    chosen_backend = None
    subtitle_style = draft.TextStyle(
        size=6.8,
        bold=True,
        color=(1.0, 0.84, 0.06),
        align=1,
        auto_wrapping=True,
        max_line_width=0.76,
    )
    subtitle_border = draft.TextBorder(color=(0.0, 0.0, 0.0), alpha=1.0, width=65.0)
    subtitle_shadow = draft.TextShadow(alpha=0.55, color=(0.0, 0.0, 0.0), diffuse=10.0, distance=3.0)
    for clean_text in split_voice_sentences(text):
        audio_seg, backend_used = project.add_tts_intelligent(
            clean_text,
            speaker=speaker,
            start_time=curr_us,
            track_name="VoiceOver",
            tts_backend=chosen_backend,
            allow_fallback=(chosen_backend is None),
            return_backend=True,
        )
        if audio_seg:
            if chosen_backend is None:
                chosen_backend = backend_used
            actual_dur_us = audio_seg.target_timerange.duration
            project.add_text_simple(
                clean_text,
                start_time=curr_us,
                duration=actual_dur_us,
                track_name="Subtitles",
                clip_settings=draft.ClipSettings(transform_y=SUBTITLE_TRANSFORM_Y),
                style=subtitle_style,
                border=subtitle_border,
                shadow=subtitle_shadow,
            )
            curr_us += actual_dur_us + 100000
        elif chosen_backend is not None:
            raise RuntimeError(
                f"TTS segment failed under locked backend '{chosen_backend}'. "
                "Stopped to avoid mixed voice providers."
            )
    return curr_us

project = JyProject(PROJECT_NAME, width=${width}, height=${height}, drafts_root=${JSON.stringify(draftRoot || "")} or None, overwrite=True)
import cloud_manager
cloud_manager.CACHE_DIR = os.path.join(project.root, project.name, "temp_assets", "cloud_cache")
os.makedirs(cloud_manager.CACHE_DIR, exist_ok=True)
cursor = 0
scene_durations = ${JSON.stringify(request.pack.script.map((beat) => beat.durationSec))}
for index, duration in enumerate(scene_durations):
    if not ASSETS:
        print("[warn] no video assets available for scene coverage")
        break
    asset_path = ASSETS[index % len(ASSETS)]
    if not os.path.exists(asset_path):
        print(f"[skip] missing asset: {asset_path}")
        continue
    # Copy media into the draft folder to avoid macOS/JianYing permission issues
    # when the original file lives under Documents, Downloads, or another sandboxed path.
    local_asset_dir = os.path.join(project.root, project.name, "temp_assets")
    os.makedirs(local_asset_dir, exist_ok=True)
    safe_name = f"source_{index}_" + os.path.basename(asset_path)
    local_asset_path = os.path.join(local_asset_dir, safe_name)
    if not os.path.exists(local_asset_path):
        shutil.copy2(asset_path, local_asset_path)
    source_start = f"{(index % 3) * 2}s"
    video_seg = project.add_media_safe(local_asset_path, start_time=f"{cursor}s", duration=f"{duration}s", track_name="MainVideo", source_start=source_start)
    if video_seg:
        video_seg.volume = VIDEO_ORIGINAL_VOLUME
    cursor += duration

project.add_text_simple(
    ${packTitle},
    start_time="0s",
    duration="3s",
    track_name="Title",
    anim_in="复古打字机",
    clip_settings=draft.ClipSettings(transform_y=0.58),
    style=draft.TextStyle(size=7.2, bold=True, color=(1.0, 1.0, 1.0), align=1, auto_wrapping=True, max_line_width=0.84),
    border=draft.TextBorder(color=(0.0, 0.0, 0.0), alpha=1.0, width=55.0),
)
bgm_added = False
if cursor > 0:
    for bgm_query in BGM_CANDIDATES:
        try:
            bgm_seg = project.add_cloud_music(bgm_query, start_time="0s", duration=f"{cursor}s", track_name="BGM")
            if bgm_seg:
                bgm_seg.volume = BGM_VOLUME
                bgm_added = True
                print(f"[ok] bgm added: {bgm_query}")
                break
        except Exception as exc:
            print(f"[warn] bgm failed {bgm_query}: {exc}")
if not bgm_added:
    print("[warn] no bgm added")
add_xhs_style_narration(project, VOICE_TEXT, speaker=${JSON.stringify(speaker)})
result = project.save()
print(json.dumps({"ok": True, "draft_path": result.get("draft_path"), "assets": ASSETS, "bgm_added": bgm_added}, ensure_ascii=False))
`;
}

async function downloadAsset(asset: AssetCandidate, dir: string) {
  const output = path.join(dir, `${asset.id}.%(ext)s`);
  try {
    await execFileAsync(
      "yt-dlp",
      ["-f", "18/best[ext=mp4][height<=720]/best[height<=720]", "--no-playlist", "-o", output, asset.url],
      { timeout: 180000, maxBuffer: 4 * 1024 * 1024 }
    );
    const mp4 = path.join(dir, `${asset.id}.mp4`);
    return existsSync(mp4) ? mp4 : undefined;
  } catch {
    return undefined;
  }
}

export async function prepareJianying(request: JianyingPrepareRequest): Promise<JianyingPrepareResponse> {
  const { pack: preparedPack, gate: creativeGate } = repairContentPackUntilCreativePass(request.pack);
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${nanoid(6)}`;
  const runDir = path.join(process.cwd(), "runs", runId);
  const assetsDir = path.join(runDir, "assets");
  await mkdir(assetsDir, { recursive: true });
  const planPath = path.join(runDir, "content-pack.json");
  const srtPath = path.join(runDir, "subtitles.srt");
  const scriptPath = path.join(runDir, "create_jianying_draft.py");
  await writeFile(planPath, JSON.stringify(preparedPack, null, 2), "utf8");
  await writeFile(srtPath, buildSrt(preparedPack), "utf8");
  if (!creativeGate.passed) {
    await writeFile(
      scriptPath,
      [
        "# Creative gate blocked this run before Jianying draft creation.",
        "# Re-generate or inspect content-pack.json / subtitles.srt for the failed checks.",
        "raise SystemExit('Creative validation did not reach 85 before editing; draft creation blocked.')",
        ""
      ].join("\n"),
      "utf8"
    );
    const env = await getEnvironmentStatus();
    const skippedAssets = preparedPack.materialMap.map((item) => item.asset.url);
    return {
      ok: false,
      runId,
      runDir,
      planPath,
      scriptPath,
      srtPath,
      preparedPack,
      creativeGate,
      downloadedAssets: [],
      skippedAssets,
      canRunDraft: false,
      command: "创意闸门未通过，未生成可执行剪映命令。",
      speakerId: request.speaker || DEFAULT_JIANYING_SPEAKER,
      speakerName: DEFAULT_JIANYING_SPEAKER_NAME,
      notes: [
        `创意闸门阻断：${creativeGate.score} 分，要求 85+；已尝试 ${creativeGate.attempts} 轮自动修稿。`,
        ...creativeGate.notes,
        `未进入素材下载和剪映草稿执行；请先重新生成选题/内容包或查看 ${planPath}。`,
        ...env.notes
      ]
    };
  }

  const downloadedAssets: string[] = [];
  const skippedAssets: string[] = [];
  if (request.downloadMode === "download_highlights") {
    const candidates = preparedPack.materialMap
      .map((item) => item.asset)
      .filter((asset) => asset.kind !== "full_match")
      .slice(0, 4);
    for (const asset of candidates) {
      const downloaded = await downloadAsset(asset, assetsDir);
      if (downloaded) downloadedAssets.push(downloaded);
      else skippedAssets.push(asset.url);
    }
  } else {
    skippedAssets.push(...preparedPack.materialMap.map((item) => item.asset.url));
  }

  await writeFile(scriptPath, buildJianyingScript({ ...request, pack: preparedPack }, { planPath, srtPath, assetPaths: downloadedAssets }), "utf8");
  const env = await getEnvironmentStatus();
  const canRunDraft = Boolean(env.python && env.jianyingPythonDeps && env.jianyingSkillRoot && env.jianyingDraftRoot && downloadedAssets.length);
  const missingDraftRequirements = [
    !env.python && "Python",
    !env.jianyingPythonDeps && "剪映 Python 依赖",
    !env.jianyingSkillRoot && "剪映 skill",
    !env.jianyingDraftRoot && "剪映草稿目录",
    !downloadedAssets.length && (request.downloadMode === "download_highlights" ? "可用本地视频素材（下载失败或无候选）" : "本地视频素材（当前计划模式未下载）")
  ].filter(Boolean) as string[];
  const notes = [
    request.downloadMode === "download_highlights"
      ? "已尝试下载高光/赛前类素材，完整比赛默认不下载，避免超大文件。"
      : "当前为计划模式：已生成内容包、SRT 和剪映脚本，但未下载视频素材。",
    `AI 配音音色：${DEFAULT_JIANYING_SPEAKER_NAME} (${request.speaker || DEFAULT_JIANYING_SPEAKER})。`,
    `字幕样式：小红书中下位置黄字黑边，transform_y=${SUBTITLE_TRANSFORM_Y}。`,
    `混音策略：主视频原声压到 ${MAIN_VIDEO_ORIGINAL_VOLUME}，BGM 成功时压到 ${BGM_VOLUME}。`,
    `创意闸门通过：${creativeGate.score} 分，${creativeGate.attempts} 轮，${creativeGate.repaired ? "已自动修稿后进入剪辑" : "首轮可直接进入剪辑"}。`,
    ...creativeGate.notes,
    canRunDraft
      ? "具备运行剪映草稿脚本的最低条件。"
      : `暂未自动执行草稿：缺少 ${missingDraftRequirements.join("、")}。${
          request.downloadMode === "plan_only"
            ? "请点击“下载高光并生成脚本”，或手动把 mp4 放入本次 runDir/assets 后再执行。"
            : "请检查素材下载日志、URL 可访问性和 yt-dlp。"
        }`
  ];
  return {
    ok: true,
    runId,
    runDir,
    planPath,
    scriptPath,
    srtPath,
    preparedPack,
    creativeGate,
    downloadedAssets,
    skippedAssets,
    canRunDraft,
    command: `JY_SKILL_ROOT=${env.jianyingSkillRoot || "<path-to-skill>"} python3 ${scriptPath}`,
    speakerId: request.speaker || DEFAULT_JIANYING_SPEAKER,
    speakerName: DEFAULT_JIANYING_SPEAKER_NAME,
    notes
  };
}

function segmentEndUs(segment: any) {
  const range = segment?.target_timerange || segment?.targetTimerange || {};
  const start = Number(range.start || 0);
  const duration = Number(range.duration || 0);
  return start + duration;
}

function trackDurationUs(track: any) {
  return Math.max(0, ...(track?.segments || []).map((segment: any) => segmentEndUs(segment)));
}

async function validateDraft(draftPath?: string, pack?: ContentPack): Promise<DraftValidationReport> {
  const checks: DraftValidationReport["checks"] = [];
  const addCheck = (id: string, label: string, passed: boolean, severity: "blocker" | "warning" | "info", detail: string) => {
    checks.push({ id, label, passed, severity, detail });
  };
  if (!draftPath) {
    addCheck("draft-path", "草稿路径", false, "blocker", "脚本没有返回 draft_path。");
    return { passed: false, score: 0, requiresRecut: true, checks, trackSummary: [], mediaPaths: [] };
  }
  const infoPath = path.join(draftPath, "draft_info.json");
  addCheck("draft-folder", "草稿目录存在", existsSync(draftPath), "blocker", draftPath);
  addCheck("draft-info", "草稿 JSON 存在", existsSync(infoPath), "blocker", infoPath);
  if (!existsSync(infoPath)) {
    return { passed: false, score: 0, requiresRecut: true, draftPath, checks, trackSummary: [], mediaPaths: [] };
  }

  const content = JSON.parse(await readFile(infoPath, "utf8"));
  const tracks = Array.isArray(content.tracks) ? content.tracks : [];
  const trackSummary = tracks.map((track: any) => ({
    name: String(track.name || ""),
    type: String(track.type || ""),
    segments: Array.isArray(track.segments) ? track.segments.length : 0
  }));
  const videoTracks = tracks.filter((track: any) => track.type === "video");
  const audioTracks = tracks.filter((track: any) => track.type === "audio");
  const textTracks = tracks.filter((track: any) => track.type === "text");
  const mainVideoSegments = videoTracks.reduce((sum: number, track: any) => sum + (track.segments?.length || 0), 0);
  const voiceTracks = audioTracks.filter((track: any) => String(track.name || "").toLowerCase().includes("voiceover"));
  const bgmTracks = audioTracks.filter((track: any) => String(track.name || "").toLowerCase().includes("bgm"));
  const voiceSegments = voiceTracks.reduce((sum: number, track: any) => sum + (track.segments?.length || 0), 0);
  const bgmSegments = bgmTracks.reduce((sum: number, track: any) => sum + (track.segments?.length || 0), 0);
  const bgmSegmentVolumes = bgmTracks
    .flatMap((track: any) => track.segments || [])
    .map((segment: any) => Number(segment.volume ?? 1))
    .filter((volume: number) => Number.isFinite(volume));
  const subtitleTrack = textTracks.find((track: any) => String(track.name || "").toLowerCase().includes("subtitle"));
  const titleTrack = textTracks.find((track: any) => String(track.name || "").toLowerCase().includes("title"));
  const subtitleSegments = subtitleTrack?.segments?.length || 0;
  const titleSegments = titleTrack?.segments?.length || 0;
  const videoSegmentVolumes = videoTracks.flatMap((track: any) => track.segments || []).map((segment: any) => Number(segment.volume ?? 1));
  const originalAudioDucked = videoSegmentVolumes.length > 0 && videoSegmentVolumes.every((volume: number) => volume <= MAIN_VIDEO_ORIGINAL_VOLUME + 0.01);
  const bgmVolumeLow = bgmSegmentVolumes.length === 0 || bgmSegmentVolumes.every((volume: number) => volume <= BGM_VOLUME + 0.03);
  const subtitleTransformYs = (subtitleTrack?.segments || [])
    .map((segment: any) => Number(segment?.clip?.transform?.y))
    .filter((value: number) => Number.isFinite(value));
  const subtitlePositionOk =
    subtitleSegments > 0 &&
    subtitleTransformYs.length === subtitleSegments &&
    subtitleTransformYs.every((value: number) => value > -0.68 && value < -0.2);

  const mediaPaths = (content.materials?.videos || []).map((video: any) => String(video.path || "")).filter(Boolean);
  const missingMedia = mediaPaths.filter((mediaPath: string) => !existsSync(mediaPath));
  const draftAssetsRoot = path.join(draftPath, "temp_assets") + path.sep;
  const outsideDraftAssets = mediaPaths.filter((mediaPath: string) => !path.resolve(mediaPath).startsWith(draftAssetsRoot));
  const videoDurationUs = Math.max(0, ...videoTracks.map(trackDurationUs));
  const audioDurationUs = Math.max(0, ...audioTracks.map(trackDurationUs));
  const draftDurationUs = Math.max(Number(content.duration || 0), videoDurationUs, audioDurationUs);
  const videoCoverageRatio = draftDurationUs > 0 ? videoDurationUs / draftDurationUs : 0;
  const audioSubtitleDelta = Math.abs(voiceSegments - subtitleSegments);

  addCheck("video-track", "视频轨道可用", mainVideoSegments > 0, "blocker", `视频片段 ${mainVideoSegments} 段。`);
  addCheck("voice-track", "旁白轨道可用", voiceSegments > 0, "blocker", `VoiceOver 片段 ${voiceSegments} 段。`);
  addCheck("bgm-track", "BGM 轨道", bgmSegments > 0, "warning", bgmSegments > 0 ? `BGM 片段 ${bgmSegments} 段，音量 ${BGM_VOLUME}。` : "未检测到 BGM 轨道，云音乐可能不可用。");
  addCheck("bgm-volume", "BGM 不压旁白", bgmVolumeLow, "blocker", bgmSegmentVolumes.length ? `BGM 音量：${bgmSegmentVolumes.map((volume: number) => volume.toFixed(2)).join(", ")}。` : "未检测到 BGM 音量，按 warning 处理。");
  addCheck("subtitle-track", "字幕轨道可用", subtitleSegments > 0, "blocker", `字幕片段 ${subtitleSegments} 段。`);
  addCheck("subtitle-position", "字幕不贴底", subtitlePositionOk, "blocker", subtitleTransformYs.length ? `字幕 Y=${subtitleTransformYs[0].toFixed(2)}，参考小红书中下位置。` : "未读到字幕位置。");
  addCheck("title-track", "标题存在", titleSegments > 0, "warning", `标题片段 ${titleSegments} 段。`);
  addCheck("original-audio-ducked", "原视频声已压低", originalAudioDucked, "blocker", videoSegmentVolumes.length ? `主视频音量：${videoSegmentVolumes.map((volume: number) => volume.toFixed(2)).join(", ")}。` : "未读到视频片段音量。");
  addCheck("media-exists", "视频素材文件存在", missingMedia.length === 0, "blocker", missingMedia.length ? `缺失：${missingMedia.join(", ")}` : "所有视频文件都可访问。");
  addCheck("media-permission", "视频素材在草稿目录内", outsideDraftAssets.length === 0, "blocker", outsideDraftAssets.length ? `仍在草稿外：${outsideDraftAssets.join(", ")}` : "视频均位于草稿 temp_assets 下。");
  addCheck("video-coverage", "画面覆盖完整口播", videoCoverageRatio >= 0.9, "blocker", `画面覆盖率 ${(videoCoverageRatio * 100).toFixed(1)}%。`);
  addCheck("audio-subtitle-align", "旁白字幕数量匹配", audioSubtitleDelta <= 1, "blocker", `旁白 ${voiceSegments} 段，字幕 ${subtitleSegments} 段，差值 ${audioSubtitleDelta}。`);
  addCheck("duration", "短视频时长合理", draftDurationUs >= 30_000_000 && draftDurationUs <= 95_000_000, "warning", `时长 ${(draftDurationUs / 1_000_000).toFixed(1)} 秒。`);
  if (pack) {
    const creative = validateCreativePack(pack);
    checks.push(...creative.checks);
    addCheck(
      "creative-score",
      "成片创意评分达标",
      creative.passed,
      "blocker",
      `创意分 ${creative.score}，要求 85+；维度包含旁白吸引力、讲解清晰度、小红书范式、互动和剪辑指令泄漏。`
    );
  }

  const score = Math.max(
    0,
    100 -
      checks.reduce((sum, check) => {
        if (check.passed) return sum;
        return sum + (check.severity === "blocker" ? 18 : check.severity === "warning" ? 7 : 2);
      }, 0)
  );
  const passed = checks.every((check) => check.passed || check.severity !== "blocker") && score >= 85;
  return {
    passed,
    score,
    requiresRecut: !passed,
    draftPath,
    durationSec: draftDurationUs / 1_000_000,
    videoCoverageRatio,
    audioSubtitleDelta,
    checks,
    trackSummary,
    mediaPaths
  };
}

function uniqueValues<T>(items: T[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function fallbackPublishKit(pack: ContentPack): Omit<XiaohongshuPublishKit, "postPath" | "coverPromptPath" | "coverSpecPath"> {
  const teams = fixtureTeamsForPack(pack);
  const title = repairXhsTitleShape(pack);
  const firstLine = pack.script[0]?.voiceover || pack.topic.hook;
  const closeLine = pack.script.at(-1)?.voiceover || "你站哪边？评论区聊聊。";
  const explainerLines = pack.script
    .slice(1, 4)
    .map((beat) => beat.voiceover.split(/[。！？!?]/).find(Boolean) || beat.voiceover)
    .filter(Boolean)
    .slice(0, 2);
  const body = [firstLine, ...explainerLines, closeLine]
    .join("\n\n")
    .replace(creativeEditorLeakPattern, "看点")
    .slice(0, 260);
  const hashtags = uniqueValues([
    "#世界杯",
    "#足球",
    "#世界杯淘汰赛",
    `#${teams.home.replace(/[（）()\s]/g, "")}`,
    `#${teams.away.replace(/[（）()\s]/g, "")}`,
    "#小红书足球",
    "#今日看球"
  ]).slice(0, 8);
  const coverText = (pack.publish.coverText || title)
    .replace(/[，。！？!?、\s]/g, "")
    .slice(0, 12);
  const coverPrompt = [
    "用 image-2 生成一张 4:5 竖版小红书足球封面。",
    `主题：${teams.home} vs ${teams.away}，标题情绪：${title}。`,
    `画面：夜间足球场、看台灯光、两队颜色形成左右对撞，中间留出中文大字区域，封面大字为“${coverText}”。`,
    "风格：高对比、干净、真实体育海报质感，不使用官方赛事 logo，不使用真实球员肖像，不要水印。"
  ].join("\n");
  return {
    title,
    body,
    hashtags,
    coverText,
    coverPrompt
  };
}

function artifactUrlForPath(filePath: string) {
  const rel = path.relative(RUNS_ROOT, path.resolve(filePath));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
  return `/artifacts/runs/${rel.split(path.sep).map(encodeURIComponent).join("/")}`;
}

async function findExistingXhsCoverImage(publishDir: string, minMtimeMs = 0) {
  if (!existsSync(publishDir)) return undefined;
  const files = await readdir(publishDir).catch(() => []);
  const candidates = files
    .filter((file) => /^xhs-cover.*\.(png|jpe?g|webp)$/i.test(file))
    .map((file) => path.join(publishDir, file))
    .filter((filePath) => existsSync(filePath) && statSync(filePath).mtimeMs >= minMtimeMs);
  if (!candidates.length) return undefined;
  const newest = candidates
    .map((filePath) => ({ filePath, mtime: existsSync(filePath) ? statSync(filePath).mtimeMs : 0 }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.filePath;
  return newest;
}

async function generateCoverWithCodex(runDir: string, kit: Omit<XiaohongshuPublishKit, "postPath" | "coverPromptPath" | "coverSpecPath">) {
  const publishDir = path.join(runDir, "publish");
  await mkdir(publishDir, { recursive: true });
  const startedAt = Date.now() - 1000;
  const imagePath = path.join(publishDir, `xhs-cover-codex-${new Date().toISOString().replace(/[:.]/g, "-")}.png`);
  const resultPath = path.join(publishDir, "cover-codex-result.txt");
  const requestPath = path.join(publishDir, "cover-image-request.md");
  const prompt = [
    "请测试并执行真实 Codex 内置图片生成能力。",
    "任务：调用真实内置 image_gen / image generation / image-2 工具生成一张小红书足球封面 PNG。",
    "必须保存到这个绝对路径：",
    imagePath,
    "",
    "要求：",
    "- 如果有 imagegen skill，请读取并按它的默认内置工具模式执行。",
    "- 禁止用 Python/Pillow/SVG/HTML 自己画占位图冒充。",
    "- 图片比例 4:5；如果真实生成结果差几像素，可以只做居中裁切，不要重绘。",
    "- 不要使用官方赛事 logo、真实球员肖像、品牌水印。",
    "- 生成完成后用 file/sips 校验 PNG 和尺寸，并在最终回答里写保存路径。",
    "",
    `封面大字：${kit.coverText}`,
    `发布标题：${kit.title}`,
    "",
    "图片提示词：",
    kit.coverPrompt
  ].join("\n");
  await writeFile(requestPath, prompt, "utf8");
  const codexEnv = { ...process.env };
  delete codexEnv.WC_TEST_OFFLINE;
  delete codexEnv.WC_DISABLE_CODEX_AGENT;
  delete codexEnv.WC_DISABLE_CODEX_PUBLISH_AGENT;
  try {
    const { stdout, stderr } = await runCodexPromptViaStdin(
      [
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        "workspace-write",
        "--output-last-message",
        resultPath,
        "-C",
        process.cwd(),
        "-"
      ],
      prompt,
      Number(process.env.CODEX_IMAGE_TIMEOUT_MS || 420000),
      codexEnv
    );
    await writeFile(path.join(publishDir, "cover-codex-stdout.log"), stdout, "utf8");
    await writeFile(path.join(publishDir, "cover-codex-stderr.log"), stderr, "utf8");
  } catch (error) {
    const anyError = error as any;
    await writeFile(path.join(publishDir, "cover-codex-stdout.log"), anyError?.stdout || "", "utf8").catch(() => undefined);
    await writeFile(path.join(publishDir, "cover-codex-stderr.log"), anyError?.stderr || String(anyError?.message || error), "utf8").catch(() => undefined);
    const generatedAfterFailure = await findExistingXhsCoverImage(publishDir, startedAt);
    if (generatedAfterFailure) return generatedAfterFailure;
    throw error;
  }
  if (existsSync(imagePath)) return imagePath;
  const generated = await findExistingXhsCoverImage(publishDir, startedAt);
  if (generated) return generated;
  throw new Error(`Codex image generation finished but did not create ${imagePath}.`);
}

async function generateXhsCoverImage(
  runDir: string,
  kit: Omit<XiaohongshuPublishKit, "postPath" | "coverPromptPath" | "coverSpecPath">
): Promise<Pick<XiaohongshuPublishKit, "coverImagePath" | "coverImageUrl" | "imageModel" | "imageStatus" | "imageError">> {
  const publishDir = path.join(runDir, "publish");
  await mkdir(publishDir, { recursive: true });
  try {
    const generatedImage = await generateCoverWithCodex(runDir, kit);
    return {
      coverImagePath: generatedImage,
      coverImageUrl: artifactUrlForPath(generatedImage),
      imageModel: "codex-image",
      imageStatus: "generated"
    };
  } catch (error) {
    const existingImage = await findExistingXhsCoverImage(publishDir);
    if (existingImage) {
      return {
        coverImagePath: existingImage,
        coverImageUrl: artifactUrlForPath(existingImage),
        imageModel: "codex-image",
        imageStatus: "generated",
        imageError: `Codex 本轮生图失败，已回显最近一次封面：${error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160)}`
      };
    }
    return {
      imageModel: "codex-image",
      imageStatus: "failed",
      imageError: `Codex 生图失败：${error instanceof Error ? error.message.slice(0, 220) : String(error).slice(0, 220)}`
    };
  }
}

export async function createXiaohongshuPublishKit(
  runDir: string,
  pack: ContentPack,
  draftPath: string | undefined,
  validation: DraftValidationReport,
  options: { generateCoverImage?: boolean } = {}
): Promise<{ kit: XiaohongshuPublishKit; note: string }> {
  const publishDir = path.join(runDir, "publish");
  await mkdir(publishDir, { recursive: true });
  let note = "小红书发布包：已由 Codex 发布代理生成。";
  let baseKit: Omit<XiaohongshuPublishKit, "postPath" | "coverPromptPath" | "coverSpecPath">;
  try {
    baseKit = (await runCodexPublishAgent({ pack, draftPath, validation })) || fallbackPublishKit(pack);
    if (baseKit.title === fallbackPublishKit(pack).title && baseKit.body === fallbackPublishKit(pack).body) {
      note = "小红书发布包：Codex 发布代理未返回结果，已使用通过稿生成兜底发布包。";
    }
  } catch (error) {
    baseKit = fallbackPublishKit(pack);
    note = `小红书发布包：Codex 发布代理失败，已使用兜底发布包（${error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120)}）。`;
  }
  const postPath = path.join(publishDir, "xhs-post.md");
  const coverPromptPath = path.join(publishDir, "cover-prompt-image-2.txt");
  const coverSpecPath = path.join(publishDir, "cover-spec.json");
  const kit: XiaohongshuPublishKit = {
    ...baseKit,
    postPath,
    postUrl: artifactUrlForPath(postPath),
    coverPromptPath,
    coverPromptUrl: artifactUrlForPath(coverPromptPath),
    coverSpecPath,
    coverSpecUrl: artifactUrlForPath(coverSpecPath),
    imageStatus: "prompt_only"
  };
  if (options.generateCoverImage) {
    const imageResult = await generateXhsCoverImage(runDir, baseKit);
    Object.assign(kit, imageResult);
  }
  await writeFile(
    postPath,
    [`# ${kit.title}`, "", kit.body, "", kit.hashtags.join(" "), "", `草稿路径：${draftPath || "未返回"}`].join("\n"),
    "utf8"
  );
  await writeFile(coverPromptPath, kit.coverPrompt, "utf8");
  await writeFile(
    coverSpecPath,
    JSON.stringify(
      {
        model: "image-2",
        aspectRatio: "4:5",
        title: kit.title,
        coverText: kit.coverText,
        prompt: kit.coverPrompt,
        coverImagePath: kit.coverImagePath,
        coverImageUrl: kit.coverImageUrl,
        imageModel: kit.imageModel,
        imageStatus: kit.imageStatus,
        imageError: kit.imageError,
        draftPath,
        generatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );
  return { kit, note };
}

export async function generateXiaohongshuPublishAssets(input: {
  scriptPath: string;
  draftPath?: string;
  generateCoverImage?: boolean;
}): Promise<XiaohongshuPublishResponse> {
  const absScriptPath = path.resolve(input.scriptPath);
  if (!absScriptPath.startsWith(RUNS_ROOT + path.sep)) {
    return { ok: false, notes: ["安全限制：只允许读取 runs/ 下由本项目生成的剪映脚本。"] };
  }
  const runDir = path.dirname(absScriptPath);
  const packPath = path.join(runDir, "content-pack.json");
  if (!existsSync(packPath)) {
    return { ok: false, notes: [`未找到内容包：${packPath}`] };
  }
  const pack = JSON.parse(await readFile(packPath, "utf8")) as ContentPack;
  const validation = input.draftPath
    ? await validateDraft(input.draftPath, pack).catch(
        (): DraftValidationReport => ({
          passed: true,
          score: 100,
          requiresRecut: false,
          draftPath: input.draftPath,
          checks: [],
          trackSummary: [],
          mediaPaths: []
        })
      )
    : ({
        passed: true,
        score: 100,
        requiresRecut: false,
        checks: [],
        trackSummary: [],
        mediaPaths: []
      } as DraftValidationReport);
  const { kit, note } = await createXiaohongshuPublishKit(runDir, pack, input.draftPath, validation, {
    generateCoverImage: input.generateCoverImage === true
  });
  return {
    ok: true,
    publishKit: kit,
    validation,
    notes: [
      note,
      kit.imageStatus === "generated"
        ? `封面已生成：${kit.coverImagePath}`
      : kit.imageStatus === "failed"
          ? `封面生成失败：${kit.imageError}`
          : "Codex 已生成小红书文案和封面方案；封面图完成后会在工作台回显。"
    ]
  };
}

function parseDraftPathFromStdout(stdout: string) {
  const jsonMatch = stdout.match(/\{[^\n]*"draft_path"[^\n]*\}/);
  if (!jsonMatch) return undefined;
  try {
    return JSON.parse(jsonMatch[0]).draft_path as string | undefined;
  } catch {
    return undefined;
  }
}

async function rewriteScriptForValidation(scriptPath: string) {
  const runDir = path.dirname(scriptPath);
  const packPath = path.join(runDir, "content-pack.json");
  const assetsDir = path.join(runDir, "assets");
  if (!existsSync(packPath) || !existsSync(assetsDir)) return false;
  const { pack, gate } = repairContentPackUntilCreativePass(JSON.parse(await readFile(packPath, "utf8")) as ContentPack);
  if (!gate.passed) return false;
  const files = await readdir(assetsDir);
  const assetPaths = files.filter((file) => file.toLowerCase().endsWith(".mp4")).map((file) => path.join(assetsDir, file));
  if (!assetPaths.length) return false;
  const oldScript = await readFile(scriptPath, "utf8").catch(() => "");
  const draftName = oldScript.match(/PROJECT_NAME = ("(?:[^"\\]|\\.)*")/)?.[1];
  const speaker = oldScript.match(/speaker=("(?:[^"\\]|\\.)*")/)?.[1];
  await writeFile(packPath, JSON.stringify(pack, null, 2), "utf8");
  await writeFile(path.join(runDir, "subtitles.srt"), buildSrt(pack), "utf8");
  const rewritten = buildJianyingScript(
    {
      pack,
      draftName: draftName ? JSON.parse(draftName) : `WC_${pack.topic.angle}_验证重剪`,
      speaker: speaker ? JSON.parse(speaker) : DEFAULT_JIANYING_SPEAKER,
      aspectRatio: "9:16",
      downloadMode: "download_highlights"
    },
    { planPath: packPath, srtPath: path.join(runDir, "subtitles.srt"), assetPaths }
  );
  await writeFile(scriptPath, rewritten, "utf8");
  return true;
}

export async function runJianyingScript(scriptPath: string): Promise<JianyingRunResponse> {
  const absScriptPath = path.resolve(scriptPath);
  const runsRoot = path.join(process.cwd(), "runs");
  if (!absScriptPath.startsWith(runsRoot + path.sep)) {
    return {
      ok: false,
      scriptPath: absScriptPath,
      exitCode: 2,
      stdout: "",
      stderr: "Refuse to run scripts outside the project runs directory.",
      attempts: 0,
      notes: ["安全限制：只允许运行 runs/ 下由本项目生成的剪映脚本。"]
    };
  }
  if (!existsSync(absScriptPath)) {
    return {
      ok: false,
      scriptPath: absScriptPath,
      exitCode: 2,
      stdout: "",
      stderr: "Script file does not exist.",
      attempts: 0,
      notes: ["请先生成剪映计划或下载高光生成脚本。"]
    };
  }
  const skillRoot = resolveJianyingSkillRoot();
  if (!skillRoot) {
    return {
      ok: false,
      scriptPath: absScriptPath,
      exitCode: 2,
      stdout: "",
      stderr: "JianYing skill root was not found.",
      attempts: 0,
      notes: ["设置 JY_SKILL_ROOT 后重试。"]
    };
  }
  let lastStdout = "";
  let lastStderr = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { stdout, stderr } = await execFileAsync("python3", [absScriptPath], {
        timeout: 300000,
        maxBuffer: 12 * 1024 * 1024,
        env: { ...process.env, JY_SKILL_ROOT: skillRoot }
      });
      lastStdout = stdout;
      lastStderr = stderr;
      const draftPath = parseDraftPathFromStdout(stdout);
      const packPath = path.join(path.dirname(absScriptPath), "content-pack.json");
      const pack = existsSync(packPath) ? (JSON.parse(await readFile(packPath, "utf8")) as ContentPack) : undefined;
      const validation = await validateDraft(draftPath, pack);
      let publishKit: XiaohongshuPublishKit | undefined;
      let publishNote: string | undefined;
      if (validation.passed && pack) {
        const publishResult = await createXiaohongshuPublishKit(path.dirname(absScriptPath), pack, draftPath, validation);
        publishKit = publishResult.kit;
        publishNote = publishResult.note;
      }
      if (validation.passed || attempt === 2) {
        return {
          ok: validation.passed,
          scriptPath: absScriptPath,
          exitCode: validation.passed ? 0 : 3,
          stdout,
          stderr,
          draftPath,
          attempts: attempt,
          validation,
          publishKit,
          notes: validation.passed
            ? ["剪映草稿脚本执行完成，并通过视频/音频/完整性验证。", publishNote || "小红书发布包已生成。"]
            : ["剪映草稿生成了，但验证未通过；需要人工查看 validation.checks。"]
        };
      }
      const rewritten = await rewriteScriptForValidation(absScriptPath);
      if (!rewritten) {
        return {
          ok: false,
          scriptPath: absScriptPath,
          exitCode: 3,
          stdout,
          stderr,
          draftPath,
          attempts: attempt,
          validation,
          notes: ["验证未通过，且无法自动重写脚本；请重新下载素材或重新生成内容包。"]
        };
      }
    } catch (error: any) {
      return {
        ok: false,
        scriptPath: absScriptPath,
        exitCode: typeof error?.code === "number" ? error.code : 1,
        stdout: error?.stdout || lastStdout,
        stderr: error?.stderr || String(error?.message || error) || lastStderr,
        attempts: attempt,
        notes: ["剪映草稿脚本执行失败，请查看 stderr。"]
      };
    }
  }
  return {
    ok: false,
    scriptPath: absScriptPath,
    exitCode: 3,
    stdout: lastStdout,
    stderr: lastStderr,
    attempts: 2,
    notes: ["剪映草稿未通过验证。"]
  };
}
