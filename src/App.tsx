import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Captions,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Clock3,
  Download,
  Film,
  Languages,
  Layers3,
  ListChecks,
  Loader2,
  Map,
  Mic2,
  Play,
  Search,
  Sparkles,
  Trophy,
  Volume2,
  Wand2,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AssetCandidate,
  ContentPack,
  EnvironmentStatus,
  Fixture,
  GenerateTopicsResponse,
  JianyingPrepareResponse,
  JianyingRunResponse,
  OutputLanguage,
  ScoreDimension,
  ThemeOption,
  TopicCandidate,
  XiaohongshuPublishKit,
  XiaohongshuPublishResponse
} from "../shared/types";

const languages: Array<{ value: OutputLanguage; label: string }> = [
  { value: "zh", label: "中文" },
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
  { value: "fr", label: "FR" }
];

const JIANYING_NARRATOR_SPEAKER = "BV411_streaming";

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
  Czechia: "捷克",
  Portugal: "葡萄牙",
  Uzbekistan: "乌兹别克斯坦",
  Panama: "巴拿马",
  Croatia: "克罗地亚",
  Colombia: "哥伦比亚",
  "Congo DR": "刚果（金）",
  Switzerland: "瑞士",
  Morocco: "摩洛哥",
  Haiti: "海地",
  "South Africa": "南非",
  "South Korea": "韩国",
  Ecuador: "厄瓜多尔",
  Germany: "德国",
  Sweden: "瑞典",
  Turkiye: "土耳其",
  Netherlands: "荷兰",
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

type StageStatus = "done" | "active" | "pending" | "warn";

type ExecutionStage = {
  id: string;
  label: string;
  detail: string;
  status: StageStatus;
};

function teamLabel(team: string, outputLanguage: OutputLanguage) {
  return outputLanguage === "zh" ? teamNameZh[team] || team : team;
}

function fixtureLabel(fixture: Fixture, outputLanguage: OutputLanguage) {
  return `${teamLabel(fixture.home, outputLanguage)} vs ${teamLabel(fixture.away, outputLanguage)}`;
}

function durationLabel(seconds?: number) {
  if (!seconds) return "未知时长";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fixtureTimeLabel(fixture?: Fixture) {
  if (!fixture) return "等待赛程";
  return `${fixture.date.slice(5)} · ${fixture.localTime}`;
}

function verdictLabel(verdict?: ContentPack["viralScore"]["verdict"]) {
  if (verdict === "go") return "可执行";
  if (verdict === "revise") return "需增强";
  if (verdict === "skip") return "不建议";
  return "未生成";
}

function assetKindLabel(kind: AssetCandidate["kind"]) {
  const labels: Record<AssetCandidate["kind"], string> = {
    full_match: "完整比赛",
    highlight: "高光",
    preview: "前瞻",
    press: "发布会",
    supplement: "补充"
  };
  return labels[kind];
}

function narrationModeLabel(mode?: TopicCandidate["narrationMode"]) {
  if (mode === "commentary_assisted") return "原声辅助";
  if (mode === "subtitle_first") return "字幕主导";
  return "叙事旁白";
}

function editDifficultyLabel(difficulty?: TopicCandidate["editDifficulty"]) {
  if (difficulty === "high") return "高难";
  if (difficulty === "low") return "低难";
  return "中等";
}

function loadingLabel(mode: string | null) {
  const labels: Record<string, string> = {
    topics: "Codex 正在生成选题",
    pack: "正在重组内容包",
    plan_only: "正在生成剪映计划",
    download_highlights: "正在下载素材并生成脚本",
    run_draft: "正在执行剪映草稿",
    xhs_publish: "正在生成小红书文案",
    xhs_cover: "正在生成小红书封面"
  };
  return mode ? labels[mode] || "正在执行" : "待命";
}

function formatElapsed(seconds: number) {
  const minute = Math.floor(seconds / 60);
  const second = seconds % 60;
  return minute ? `${minute}m ${String(second).padStart(2, "0")}s` : `${second}s`;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(async (response) => {
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  });
}

function hasTrace(response: GenerateTopicsResponse | null, matcher: RegExp) {
  return Boolean(response?.trace.some((line) => matcher.test(line)));
}

function buildExecutionStages({
  loading,
  elapsedSec,
  topicsResponse,
  contentPack,
  jianyingResult,
  jianyingRun,
  xhsPublishKit
}: {
  loading: string | null;
  elapsedSec: number;
  topicsResponse: GenerateTopicsResponse | null;
  contentPack: ContentPack | null;
  jianyingResult: JianyingPrepareResponse | null;
  jianyingRun: JianyingRunResponse | null;
  xhsPublishKit: XiaohongshuPublishKit | null;
}): ExecutionStage[] {
  const activeTopics = loading === "topics";
  const fallback = hasTrace(topicsResponse, /deterministic_fallback|紧急降级/) || Boolean(topicsResponse?.warnings.some((item) => /降级/.test(item)));
  const benchmarkMiss = hasTrace(topicsResponse, /未检索到相似旁白样本/);
  const codexDone = hasTrace(topicsResponse, /Codex 创作代理：已接管/);
  const benchmarkDone = hasTrace(topicsResponse, /Benchmark RAG/);
  const assetsDone = Boolean(topicsResponse?.assets.length);
  const hotspotDone = Boolean(topicsResponse?.hotspotSignals.length);

  return [
    {
      id: "brief",
      label: "创作目标",
      detail: "赛程、主题、语言已进入后端请求",
      status: activeTopics || topicsResponse ? "done" : "pending"
    },
    {
      id: "assets",
      label: "素材搜索",
      detail: assetsDone ? `${topicsResponse?.assets.length || 0} 条候选素材` : "YouTube / 官方高光 / 发布会",
      status: assetsDone ? "done" : activeTopics && elapsedSec >= 3 ? "active" : "pending"
    },
    {
      id: "hotspot",
      label: "热点雷达",
      detail: hotspotDone ? `${topicsResponse?.hotspotSignals.length || 0} 条热点信号` : "结合赛程、球星、平台关键词",
      status: hotspotDone ? "done" : activeTopics && elapsedSec >= 7 ? "active" : "pending"
    },
    {
      id: "benchmark",
      label: "样本学习",
      detail: benchmarkDone ? "检索对标账号完整旁白样本" : "等待 football creative benchmark",
      status: benchmarkMiss ? "warn" : benchmarkDone ? "done" : activeTopics && elapsedSec >= 12 ? "active" : "pending"
    },
    {
      id: "codex",
      label: "Codex 创作",
      detail: fallback ? "已降级，结果仅作保底" : codexDone ? "选题、旁白、剪辑、评分由 Codex 接管" : "等待代理返回 JSON",
      status: fallback ? "warn" : codexDone ? "done" : activeTopics && elapsedSec >= 18 ? "active" : "pending"
    },
    {
      id: "pack",
      label: "内容包",
      detail: contentPack ? "脚本、发布文案、素材映射已生成" : "等待首个通过评分的选题",
      status: contentPack ? "done" : loading === "pack" || (activeTopics && elapsedSec >= 24) ? "active" : "pending"
    },
    {
      id: "jianying",
      label: "剪映草稿",
      detail: jianyingRun?.ok
        ? "草稿已通过验证"
        : jianyingResult?.creativeGate && !jianyingResult.creativeGate.passed
          ? `创意闸门未过：${jianyingResult.creativeGate.score} 分`
          : jianyingResult
            ? "计划已生成，等待执行草稿"
            : "可在生产台执行",
      status: jianyingRun?.ok
        ? "done"
        : jianyingResult?.creativeGate && !jianyingResult.creativeGate.passed
          ? "warn"
          : loading === "plan_only" || loading === "download_highlights" || loading === "run_draft"
            ? "active"
            : "pending"
    },
    {
      id: "xhs",
      label: "发布资产",
      detail: xhsPublishKit?.coverImageUrl
        ? "小红书文案与封面已生成"
        : xhsPublishKit
          ? "文案已生成，等待封面回显"
          : jianyingRun?.ok
            ? "可生成小红书文案和封面"
            : "剪辑通过后可生成",
      status: xhsPublishKit?.coverImageUrl ? "done" : xhsPublishKit ? "warn" : loading === "xhs_publish" || loading === "xhs_cover" ? "active" : "pending"
    }
  ];
}

export function App() {
  const [language, setLanguage] = useState<OutputLanguage>("zh");
  const [count, setCount] = useState(5);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [creativeBrief, setCreativeBrief] = useState("不懂球也能看懂，优先找有争议、有情绪、有强对比的短视频角度。");
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>("");
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [activeProductionTab, setActiveProductionTab] = useState<"script" | "publish" | "jianying" | "xhs">("script");
  const [topicsResponse, setTopicsResponse] = useState<GenerateTopicsResponse | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicCandidate | null>(null);
  const [contentPack, setContentPack] = useState<ContentPack | null>(null);
  const [env, setEnv] = useState<EnvironmentStatus | null>(null);
  const [jianyingResult, setJianyingResult] = useState<JianyingPrepareResponse | null>(null);
  const [jianyingRun, setJianyingRun] = useState<JianyingRunResponse | null>(null);
  const [xhsPublishKit, setXhsPublishKit] = useState<XiaohongshuPublishKit | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    Promise.all([fetch("/api/fixtures").then((r) => r.json()), fetch("/api/health").then((r) => r.json())])
      .then(([fixtureData, healthData]) => {
        setFixtures(fixtureData.fixtures);
        setSelectedFixtureId(fixtureData.fixtures[0]?.id || "");
        setEnv(healthData);
      })
      .catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (!selectedFixtureId) return;
    fetch(`/api/themes?fixtureId=${encodeURIComponent(selectedFixtureId)}`)
      .then((r) => r.json())
      .then((data) => {
        setThemes(data.themes || []);
        setSelectedThemeId((current) => {
          const exists = (data.themes || []).some((theme: ThemeOption) => theme.id === current);
          return exists ? current : data.themes?.[0]?.id || "";
        });
      })
      .catch((err) => setError(String(err)));
  }, [selectedFixtureId]);

  useEffect(() => {
    if (!loading) return undefined;
    setElapsedSec(0);
    const timer = window.setInterval(() => setElapsedSec((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const selectedFixture = useMemo(
    () => fixtures.find((fixture) => fixture.id === selectedFixtureId),
    [fixtures, selectedFixtureId]
  );

  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.id === selectedThemeId),
    [selectedThemeId, themes]
  );

  const selectedAsset = useMemo(() => {
    const allAssets = contentPack?.assets.length ? contentPack.assets : topicsResponse?.assets;
    return allAssets?.find((asset) => asset.id === selectedAssetId) ?? allAssets?.[0] ?? null;
  }, [contentPack?.assets, selectedAssetId, topicsResponse?.assets]);

  const selectedMaterial = useMemo(
    () => contentPack?.materialMap.find((item) => item.asset.id === selectedAsset?.id) ?? null,
    [contentPack?.materialMap, selectedAsset?.id]
  );

  const stages = useMemo(
    () => buildExecutionStages({ loading, elapsedSec, topicsResponse, contentPack, jianyingResult, jianyingRun, xhsPublishKit }),
    [contentPack, elapsedSec, jianyingResult, jianyingRun, loading, topicsResponse, xhsPublishKit]
  );

  const workflowState = contentPack ? "脚本已生成" : topicsResponse ? "选题已生成" : loading ? "执行中" : "待生成";
  const traceLines = topicsResponse?.trace || [];
  const warningLines = topicsResponse?.warnings || [];
  const fallbackActive = hasTrace(topicsResponse, /deterministic_fallback|紧急降级/);
  const benchmarkActive = hasTrace(topicsResponse, /Benchmark RAG：已检索/);
  const codexActive = hasTrace(topicsResponse, /Codex 创作代理：已接管/);
  const visibleAssets = (contentPack?.assets.length ? contentPack.assets : topicsResponse?.assets || []).slice(0, 7);

  async function createPack(topic = selectedTopic, assets = topicsResponse?.assets) {
    if (!topic || !assets) return;
    setError("");
    setLoading("pack");
    try {
      const pack = await postJson<ContentPack>("/api/content-pack", {
        topicId: topic.id,
        topic,
        assets
      });
      setSelectedTopic(topic);
      setContentPack(pack);
      setSelectedAssetId(pack.assets[0]?.id || "");
      setJianyingResult(null);
      setJianyingRun(null);
      setXhsPublishKit(null);
      setActiveProductionTab("script");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function generateTopics() {
    setError("");
    setContentPack(null);
    setJianyingResult(null);
    setJianyingRun(null);
    setXhsPublishKit(null);
    setLoading("topics");
    try {
      const response = await postJson<GenerateTopicsResponse>("/api/topics", {
        language,
        topicText: creativeBrief.trim() || undefined,
        fixtureId: selectedFixtureId || undefined,
        themeId: selectedThemeId || undefined,
        count
      });
      const firstTopic = response.topics[0] ?? null;
      setTopicsResponse(response);
      setSelectedTopic(firstTopic);
      setSelectedAssetId(response.assets[0]?.id || "");
      if (firstTopic) {
        const pack = await postJson<ContentPack>("/api/content-pack", {
          topicId: firstTopic.id,
          topic: firstTopic,
          assets: response.assets
        });
        setContentPack(pack);
        setSelectedAssetId(pack.assets[0]?.id || response.assets[0]?.id || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function prepareJianying(downloadMode: "plan_only" | "download_highlights") {
    if (!contentPack) return;
    setError("");
    setLoading(downloadMode);
    try {
      const result = await postJson<JianyingPrepareResponse>("/api/jianying/prepare", {
        pack: contentPack,
        draftName: `WC_${contentPack.topic.angle}_${new Date().toISOString().slice(5, 10)}`,
        speaker: JIANYING_NARRATOR_SPEAKER,
        aspectRatio: "9:16",
        downloadMode
      });
      setJianyingResult(result);
      if (result.preparedPack) setContentPack(result.preparedPack);
      setJianyingRun(null);
      setXhsPublishKit(null);
      setActiveProductionTab("jianying");
      const freshEnv = await fetch("/api/health").then((r) => r.json());
      setEnv(freshEnv);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function runJianyingDraft() {
    if (!jianyingResult?.scriptPath) return;
    setError("");
    setLoading("run_draft");
    try {
      const result = await postJson<JianyingRunResponse>("/api/jianying/run", {
        scriptPath: jianyingResult.scriptPath
      });
      setJianyingRun(result);
      if (result.publishKit) setXhsPublishKit(result.publishKit);
      if (result.ok) setActiveProductionTab("xhs");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function generateXhsPublish() {
    if (!jianyingResult?.scriptPath) return;
    setError("");
    setLoading("xhs_publish");
    try {
      const result = await postJson<XiaohongshuPublishResponse>("/api/xhs/publish", {
        scriptPath: jianyingResult.scriptPath,
        draftPath: jianyingRun?.draftPath,
        generateCoverImage: false
      });
      if (!result.ok || !result.publishKit) {
        throw new Error(result.notes.join("\n") || "小红书发布包生成失败");
      }
      setXhsPublishKit(result.publishKit);
      setActiveProductionTab("xhs");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function generateXhsCoverImage() {
    if (!jianyingResult?.scriptPath) return;
    setError("");
    setLoading("xhs_cover");
    try {
      const result = await postJson<XiaohongshuPublishResponse>("/api/xhs/publish", {
        scriptPath: jianyingResult.scriptPath,
        draftPath: jianyingRun?.draftPath,
        generateCoverImage: true
      });
      if (!result.ok || !result.publishKit) {
        throw new Error(result.notes.join("\n") || "小红书封面生成失败");
      }
      setXhsPublishKit(result.publishKit);
      setActiveProductionTab("xhs");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="top-chrome">
        <div className="brand-lockup">
          <span className="app-icon">
            <Trophy size={18} />
          </span>
          <div>
            <p>World Cup Studio</p>
            <h1>热点内容工作台</h1>
          </div>
        </div>
        <div className="top-status">
          <StatusPill icon={<CheckCircle2 size={15} />} label={workflowState} ok={Boolean(contentPack)} />
          <StatusPill icon={<Mic2 size={15} />} label="解说小帅" ok />
          <StatusPill icon={<Search size={15} />} label={benchmarkActive ? "样本已接入" : "样本待验证"} ok={benchmarkActive} />
        </div>
      </header>

      {error ? (
        <div className="error-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="workbench" aria-label="世界杯短视频工作台">
        <aside className="command-rail">
          <div className="rail-section fixture-brief">
            <p className="eyebrow">
              <CalendarDays size={14} />
              Next match
            </p>
            <strong>{selectedFixture ? fixtureLabel(selectedFixture, language) : "选择一场比赛"}</strong>
            <span>
              {selectedFixture
                ? `${fixtureTimeLabel(selectedFixture)} · ${selectedFixture.group} · ${selectedFixture.venue}`
                : "只显示当前时间之后的比赛"}
            </span>
          </div>

          <div className="rail-section control-stack">
            <label className="field-line">
              <span>赛程</span>
              <select value={selectedFixtureId} onChange={(event) => setSelectedFixtureId(event.target.value)}>
                {fixtures.map((fixture) => (
                  <option key={fixture.id} value={fixture.id}>
                    {fixtureTimeLabel(fixture)} · {fixtureLabel(fixture, language)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-line">
              <span>方向</span>
              <select value={selectedThemeId} onChange={(event) => setSelectedThemeId(event.target.value)}>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label} · {theme.angle}
                  </option>
                ))}
              </select>
            </label>

            <label className="brief-field">
              <span>操刀要求</span>
              <textarea
                value={creativeBrief}
                onChange={(event) => setCreativeBrief(event.target.value)}
                rows={5}
                placeholder="例如：先给不懂球的人一个看点，标题要有冲突，旁白不要机器味。"
              />
            </label>
          </div>

          <div className="rail-section compact-controls">
            <SegmentedControl label="语言">
              {languages.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={language === item.value ? "active" : ""}
                  onClick={() => setLanguage(item.value)}
                >
                  <Languages size={14} />
                  {item.label}
                </button>
              ))}
            </SegmentedControl>

            <label className="count-stepper">
              <span>选题数</span>
              <input
                type="range"
                min={3}
                max={10}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
              <strong>{count}</strong>
            </label>
          </div>

          <button className="primary-action generate-button" type="button" onClick={generateTopics} disabled={loading === "topics"}>
            {loading === "topics" ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
            {loading === "topics" ? `${formatElapsed(elapsedSec)} · 创作中` : "生成选题"}
          </button>
        </aside>

        <section className="main-deck">
          <ExecutionRail
            stages={stages}
            loading={loading}
            elapsedSec={elapsedSec}
            traceLines={traceLines}
            warningLines={warningLines}
            codexActive={codexActive}
            benchmarkActive={benchmarkActive}
            fallbackActive={fallbackActive}
          />

          <section className="topic-stage">
            <div className="panel-heading-row">
              <PanelTitle icon={<Zap />} title="爆点" />
              {selectedTheme ? <span className="subtle-pill">{selectedTheme.label}</span> : null}
            </div>

            {selectedTopic ? (
              <div className="topic-hero">
                <div className="topic-score-card">
                  <span>{selectedTopic.preflight?.total ?? selectedTopic.hotness}</span>
                  <small>选题分</small>
                </div>
                <div className="topic-main-copy">
                  <p className="eyebrow">
                    <Trophy size={14} />
                    {selectedTopic.angle}
                  </p>
                  <h2>{selectedTopic.title}</h2>
                  <p>{selectedTopic.hook}</p>
                  <div className="proof-row">
                    <span>{selectedTopic.reason}</span>
                    <span>隐藏低分 {topicsResponse?.rejectedTopics.length ?? 0}</span>
                    {selectedTopic.hotspotSignals[0] ? <span>{selectedTopic.hotspotSignals[0].source} 热点</span> : null}
                  </div>
                  <div className="topic-action-grid">
                    <Metric label="建议时长" value={`${selectedTopic.suggestedDurationSec}s`} />
                    <Metric label="文案引擎" value={selectedTopic.styleEngineLabel} />
                    <Metric label="旁白模式" value={narrationModeLabel(selectedTopic.narrationMode)} />
                    <Metric label="剪辑难度" value={editDifficultyLabel(selectedTopic.editDifficulty)} />
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="等你生成爆点" text="选择未来比赛和操刀要求，系统会先过滤低分选题。" />
            )}

            <div className="topic-list horizontal">
              {topicsResponse?.topics.length ? (
                topicsResponse.topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className={`topic-card ${selectedTopic?.id === topic.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedTopic(topic);
                      void createPack(topic);
                    }}
                  >
                    <span className="score">{topic.preflight?.total ?? topic.hotness}</span>
                    <div>
                      <strong>{topic.title}</strong>
                      <small>
                        {topic.styleEngineLabel} · {editDifficultyLabel(topic.editDifficulty)} · {topic.suggestedDurationSec}s
                      </small>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))
              ) : (
                <div className="topic-hints">
                  <span>低分选题直接隐藏</span>
                  <span>素材不足自动补搜</span>
                  <span>旁白和剪辑分层</span>
                </div>
              )}
            </div>
          </section>

          <ProductionDesk
            contentPack={contentPack}
            activeProductionTab={activeProductionTab}
            setActiveProductionTab={setActiveProductionTab}
            env={env}
            jianyingResult={jianyingResult}
            jianyingRun={jianyingRun}
            xhsPublishKit={xhsPublishKit}
            loading={loading}
            onPrepare={prepareJianying}
            onRun={runJianyingDraft}
            onGenerateXhsPublish={generateXhsPublish}
            onGenerateXhsCover={generateXhsCoverImage}
          />
        </section>

        <aside className="material-rail">
          <div className="panel-heading-row">
            <PanelTitle icon={<Map />} title="素材" />
            {selectedAsset ? (
              <a className="text-link" href={selectedAsset.url} target="_blank" rel="noreferrer">
                打开源视频
              </a>
            ) : null}
          </div>

          {selectedAsset ? (
            <div className="asset-feature">
              <div className="media-preview">
                <AssetImage asset={selectedAsset} large />
                <div className="play-mark">
                  <Play size={18} />
                </div>
                <span>{assetKindLabel(selectedAsset.kind)}</span>
              </div>
              <div className="asset-copy">
                <strong>{selectedAsset.title}</strong>
                <p>{selectedAsset.usageHint}</p>
                <div className="asset-meta">
                  <span>{selectedAsset.channel || "YouTube"}</span>
                  <span>{durationLabel(selectedAsset.durationSec)}</span>
                  <span>可信度 {selectedAsset.confidence}</span>
                </div>
                <small>{selectedAsset.rightsNote}</small>
                {selectedMaterial ? (
                  <div className="material-insight">
                    <div>
                      <strong>建议切点</strong>
                      <p>{selectedMaterial.suggestedCut}</p>
                    </div>
                    <div>
                      <strong>校验重点</strong>
                      <p>{selectedMaterial.verification}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState title="等待素材" text="生成后这里会出现最适合剪的主素材。" />
          )}

          <div className="asset-rail" aria-label="素材候选">
            {visibleAssets.length ? (
              visibleAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`asset-thumb ${selectedAsset?.id === asset.id ? "selected" : ""}`}
                  onClick={() => setSelectedAssetId(asset.id)}
                >
                  <AssetImage asset={asset} />
                  <span>{assetKindLabel(asset.kind)}</span>
                </button>
              ))
            ) : (
              <div className="asset-placeholder">
                <Film size={18} />
                <span>暂无素材候选</span>
              </div>
            )}
          </div>

          <div className="signal-panel">
            <PanelTitle icon={<Sparkles />} title="热点信号" compact />
            {(topicsResponse?.hotspotSignals || []).slice(0, 5).map((signal) => (
              <div className="signal-row" key={signal.id}>
                <strong>{signal.title}</strong>
                <span>{signal.source}</span>
              </div>
            ))}
            {!topicsResponse?.hotspotSignals.length ? <EmptyState title="等待雷达" text="生成后展示平台热点和素材证据。" compact /> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}

function ExecutionRail({
  stages,
  loading,
  elapsedSec,
  traceLines,
  warningLines,
  codexActive,
  benchmarkActive,
  fallbackActive
}: {
  stages: ExecutionStage[];
  loading: string | null;
  elapsedSec: number;
  traceLines: string[];
  warningLines: string[];
  codexActive: boolean;
  benchmarkActive: boolean;
  fallbackActive: boolean;
}) {
  return (
    <section className={`execution-rail ${loading ? "running" : ""}`}>
      <div className="execution-head">
        <PanelTitle icon={<ListChecks />} title="执行台账" />
        <div className="run-clock">
          {loading ? <Loader2 className="spin" size={15} /> : <Clock3 size={15} />}
          <span>{loading ? `${loadingLabel(loading)} · ${formatElapsed(elapsedSec)}` : "等待下一次执行"}</span>
        </div>
      </div>

      <div className="stage-strip">
        {stages.map((stage) => (
          <div className={`stage-item ${stage.status}`} key={stage.id}>
            <i />
            <strong>{stage.label}</strong>
            <span>{stage.detail}</span>
          </div>
        ))}
      </div>

      <div className="proof-grid">
        <StatusTile label="Benchmark RAG" value={benchmarkActive ? "已检索旁白样本" : "等待返回"} ok={benchmarkActive} warn={!benchmarkActive && traceLines.length > 0} />
        <StatusTile label="Codex Agent" value={codexActive ? "已接管创作" : "等待代理"} ok={codexActive} warn={fallbackActive} />
        <StatusTile label="Fallback" value={fallbackActive ? "已触发降级" : "未触发"} ok={!fallbackActive} warn={fallbackActive} />
      </div>

      {warningLines.length ? (
        <div className="warning-stack">
          {warningLines.slice(0, 3).map((line) => (
            <p key={line}>
              <AlertTriangle size={14} />
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <div className="trace-log">
        {(traceLines.length ? traceLines : ["点击生成后，这里会展示素材搜索、热点雷达、样本学习和 Codex 接管情况。"]).slice(-6).map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
      </div>
    </section>
  );
}

function ProductionDesk({
  contentPack,
  activeProductionTab,
  setActiveProductionTab,
  env,
  jianyingResult,
  jianyingRun,
  xhsPublishKit,
  loading,
  onPrepare,
  onRun,
  onGenerateXhsPublish,
  onGenerateXhsCover
}: {
  contentPack: ContentPack | null;
  activeProductionTab: "script" | "publish" | "jianying" | "xhs";
  setActiveProductionTab: (tab: "script" | "publish" | "jianying" | "xhs") => void;
  env: EnvironmentStatus | null;
  jianyingResult: JianyingPrepareResponse | null;
  jianyingRun: JianyingRunResponse | null;
  xhsPublishKit: XiaohongshuPublishKit | null;
  loading: string | null;
  onPrepare: (downloadMode: "plan_only" | "download_highlights") => void;
  onRun: () => void;
  onGenerateXhsPublish: () => void;
  onGenerateXhsCover: () => void;
}) {
  const currentPublishKit = xhsPublishKit || jianyingRun?.publishKit || null;
  return (
    <section className="production-panel">
      <div className="production-head">
        <div>
          <p className="eyebrow">
            <Layers3 size={14} />
            Production
          </p>
          <h3>{contentPack?.title || "内容包"}</h3>
        </div>
        <div className="production-tabs" role="tablist" aria-label="生产内容">
          <button
            type="button"
            className={activeProductionTab === "script" ? "active" : ""}
            onClick={() => setActiveProductionTab("script")}
          >
            <Mic2 size={15} />
            旁白
          </button>
          <button
            type="button"
            className={activeProductionTab === "publish" ? "active" : ""}
            onClick={() => setActiveProductionTab("publish")}
          >
            <Captions size={15} />
            发布
          </button>
          <button
            type="button"
            className={activeProductionTab === "jianying" ? "active" : ""}
            onClick={() => setActiveProductionTab("jianying")}
          >
            <Clapperboard size={15} />
            剪映
          </button>
          <button
            type="button"
            className={activeProductionTab === "xhs" ? "active" : ""}
            onClick={() => setActiveProductionTab("xhs")}
          >
            <Sparkles size={15} />
            小红书
          </button>
        </div>
      </div>

      {contentPack ? (
        <>
          <div className="score-strip">
            <Metric label="Hotness" value={String(contentPack.hotness)} />
            <Metric label="Viral" value={String(contentPack.viralScore.total)} />
            <Metric label="状态" value={verdictLabel(contentPack.viralScore.verdict)} />
            <div className="audience-note">
              <strong>{contentPack.viralScore.targetAudience.label}</strong>
              <span>{contentPack.viralScore.targetAudience.contentPromise}</span>
            </div>
          </div>

          {activeProductionTab === "script" ? (
            <div className="script-layout">
              <div className="score-dimensions">
                {contentPack.viralScore.dimensions.map((dimension) => (
                  <ScoreBar key={dimension.id} dimension={dimension} />
                ))}
              </div>
              <div className="script-list">
                {contentPack.script.map((beat) => (
                  <div className="script-row" key={beat.id}>
                    <span>{beat.startSec}s</span>
                    <div>
                      <strong>{beat.label}</strong>
                      <p>{beat.voiceover}</p>
                      <small>剪辑动作：{beat.visualInstruction}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeProductionTab === "publish" ? (
            <div className="publish-card">
              <div>
                <Captions size={18} />
                <strong>{contentPack.publish.coverText}</strong>
              </div>
              <p>{contentPack.publish.description}</p>
              <div className="hash-row">
                {contentPack.publish.hashtags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              {contentPack.viralScore.retryAdvice.length ? (
                <p className="advice-line">{contentPack.viralScore.retryAdvice[0]}</p>
              ) : null}
            </div>
          ) : null}

          {activeProductionTab === "jianying" ? (
            <JianyingPanel
              env={env}
              contentPack={contentPack}
              contentPackReady={Boolean(contentPack)}
              jianyingResult={jianyingResult}
              jianyingRun={jianyingRun}
              loading={loading}
              onPrepare={onPrepare}
              onRun={onRun}
            />
          ) : null}

          {activeProductionTab === "xhs" ? (
            <XiaohongshuPanel
              contentPack={contentPack}
              jianyingResult={jianyingResult}
              jianyingRun={jianyingRun}
              publishKit={currentPublishKit}
              loading={loading}
              onGeneratePublish={onGenerateXhsPublish}
              onGenerateCover={onGenerateXhsCover}
            />
          ) : null}
        </>
      ) : (
        <EmptyState title="内容包待生成" text="生成选题后会自动产出脚本、字幕文案和剪映计划入口。" />
      )}
    </section>
  );
}

function SegmentedControl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="segmented-control">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function PanelTitle({ icon, title, compact = false }: { icon: React.ReactNode; title: string; compact?: boolean }) {
  return (
    <div className={`panel-title ${compact ? "compact" : ""}`}>
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function StatusPill({ icon, label, ok }: { icon?: React.ReactNode; label: string; ok: boolean }) {
  return (
    <span className={`status-pill ${ok ? "ok" : "warn"}`}>
      {icon || (ok ? <BadgeCheck size={15} /> : <AlertTriangle size={15} />)}
      {label}
    </span>
  );
}

function StatusTile({ label, value, ok, warn = false }: { label: string; value: string; ok: boolean; warn?: boolean }) {
  return (
    <div className={`status-tile ${ok ? "ok" : ""} ${warn ? "warn" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScoreBar({ dimension }: { dimension: ScoreDimension }) {
  const width = `${Math.min(100, Math.max(8, Math.round((dimension.score / 15) * 100)))}%`;
  return (
    <div className="score-bar" title={dimension.reason}>
      <div>
        <span>{dimension.label}</span>
        <strong>{dimension.score}</strong>
      </div>
      <i style={{ width }} />
    </div>
  );
}

function XiaohongshuPanel({
  contentPack,
  jianyingResult,
  jianyingRun,
  publishKit,
  loading,
  onGeneratePublish,
  onGenerateCover
}: {
  contentPack: ContentPack;
  jianyingResult: JianyingPrepareResponse | null;
  jianyingRun: JianyingRunResponse | null;
  publishKit: XiaohongshuPublishKit | null;
  loading: string | null;
  onGeneratePublish: () => void;
  onGenerateCover: () => void;
}) {
  const ready = Boolean(jianyingRun?.ok && jianyingResult?.scriptPath);
  const generatingPublish = loading === "xhs_publish";
  const generatingCover = loading === "xhs_cover";
  return (
    <div className="xhs-panel">
      <div className="xhs-action-bar">
        <div>
          <strong>{ready ? "当前视频发布资产" : "先完成剪映草稿"}</strong>
          <span>{ready ? jianyingRun?.draftPath || "草稿已验证" : "草稿通过视频、音频、字幕验证后再生成最终发布包。"}</span>
        </div>
        <div className="xhs-action-buttons">
          <button className="secondary-action" type="button" disabled={!ready || generatingPublish || generatingCover} onClick={onGeneratePublish}>
            {generatingPublish ? <Loader2 className="spin" size={16} /> : <Captions size={16} />}
            {publishKit ? "刷新文案" : "生成发布文案"}
          </button>
          <button className="primary-action" type="button" disabled={!ready || generatingPublish || generatingCover} onClick={onGenerateCover}>
            {generatingCover ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            {publishKit?.coverImageUrl ? "重新回显封面" : "生成封面图"}
          </button>
        </div>
      </div>

      {publishKit ? (
        <div className="xhs-publish-grid">
          <div className="cover-preview-card">
            {publishKit.coverImageUrl ? (
              <img src={publishKit.coverImageUrl} alt={publishKit.coverText || publishKit.title} />
            ) : (
              <div className="cover-placeholder">
                <Sparkles size={24} />
                <strong>
                  {publishKit.imageStatus === "failed"
                    ? "封面生成失败"
                    : publishKit.imageStatus === "requested"
                      ? "封面生成已发起"
                      : "等待封面图"}
                </strong>
                <span>{publishKit.imageError || "已生成文案和封面方案。"}</span>
              </div>
            )}
            <div className="download-row">
              {publishKit.coverImageUrl ? (
                <a className="primary-action" href={publishKit.coverImageUrl} download>
                  <Download size={15} />
                  下载封面
                </a>
              ) : null}
              {publishKit.postUrl ? (
                <a className="secondary-action" href={publishKit.postUrl} download>
                  下载文案
                </a>
              ) : null}
              {publishKit.coverPromptUrl ? (
                <a className="secondary-action" href={publishKit.coverPromptUrl} download>
                  下载 prompt
                </a>
              ) : null}
            </div>
          </div>

          <div className="xhs-copy-card">
            <span className="subtle-pill">{publishKit.coverImageUrl ? "Codex 封面已回显" : "Codex 发布方案"}</span>
            <h4>{publishKit.title}</h4>
            <p>{publishKit.body}</p>
            <div className="hash-row">
              {publishKit.hashtags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="cover-prompt-box">
              <strong>封面大字</strong>
              <code>{publishKit.coverText}</code>
              <strong>封面生成方案</strong>
              <p>{publishKit.coverPrompt}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="xhs-empty">
          <Captions size={22} />
          <strong>{contentPack.publish.platformTitle || contentPack.title}</strong>
          <span>剪辑完成后，这里会生成针对当前成片的小红书文案、封面图和下载入口。</span>
        </div>
      )}
    </div>
  );
}

function JianyingPanel({
  env,
  contentPack,
  contentPackReady,
  jianyingResult,
  jianyingRun,
  loading,
  onPrepare,
  onRun
}: {
  env: EnvironmentStatus | null;
  contentPack: ContentPack | null;
  contentPackReady: boolean;
  jianyingResult: JianyingPrepareResponse | null;
  jianyingRun: JianyingRunResponse | null;
  loading: string | null;
  onPrepare: (downloadMode: "plan_only" | "download_highlights") => void;
  onRun: () => void;
}) {
  const displayPack = jianyingResult?.preparedPack || contentPack;
  return (
    <div className="jianying-card">
      <div className="env-grid">
        <StatusPill label="yt-dlp" ok={Boolean(env?.ytDlp)} />
        <StatusPill label="Python" ok={Boolean(env?.python)} />
        <StatusPill label="Py deps" ok={Boolean(env?.jianyingPythonDeps)} />
        <StatusPill label="FFmpeg" ok={Boolean(env?.ffmpeg)} />
        <StatusPill label="Skill" ok={Boolean(env?.jianyingSkillRoot)} />
      </div>

      <div className="pipeline-actions">
        <button
          className="secondary-action"
          type="button"
          disabled={!contentPackReady || loading === "plan_only"}
          onClick={() => onPrepare("plan_only")}
        >
          {loading === "plan_only" ? <Loader2 className="spin" size={16} /> : <Clapperboard size={16} />}
          生成剪映计划
        </button>
        <button
          className="primary-action"
          type="button"
          disabled={!contentPackReady || loading === "download_highlights"}
          onClick={() => onPrepare("download_highlights")}
        >
          {loading === "download_highlights" ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
          下载高光并生成脚本
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={!jianyingResult?.canRunDraft || loading === "run_draft"}
          onClick={onRun}
        >
          {loading === "run_draft" ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
          执行剪映草稿
        </button>
      </div>

      {jianyingResult ? (
        <div className="result-box">
          <div className="artifact-grid">
            <ArtifactItem label="运行目录" value={jianyingResult.runDir} />
            <ArtifactItem label="内容包 JSON" value={jianyingResult.planPath} />
            <ArtifactItem label="字幕 SRT" value={jianyingResult.srtPath} />
            <ArtifactItem label="剪映脚本" value={jianyingResult.scriptPath} />
            <ArtifactItem label="可执行" value={jianyingResult.canRunDraft ? "是" : "否"} tone={jianyingResult.canRunDraft ? "ok" : "warn"} />
            <ArtifactItem label="已下载素材" value={`${jianyingResult.downloadedAssets.length} 个`} tone={jianyingResult.downloadedAssets.length ? "ok" : "warn"} />
          </div>
          {jianyingResult.creativeGate ? (
            <div className="validation-list">
              <span>
                创意闸门 {jianyingResult.creativeGate.score} 分 · {jianyingResult.creativeGate.attempts} 轮 ·{" "}
                {jianyingResult.creativeGate.passed ? "通过" : "阻断"}
              </span>
              {jianyingResult.creativeGate.checks.map((check) => (
                <p key={check.id} className={check.passed ? "pass" : "fail"}>
                  {check.passed ? "通过" : "未过"} · {check.label}：{check.detail}
                </p>
              ))}
            </div>
          ) : null}
          {displayPack ? (
            <div className="voiceover-preview">
              <strong>
                脚本数据 · {displayPack.script.length} 段 · {displayPack.suggestedDurationSec}s
              </strong>
              {displayPack.script.map((beat, index) => (
                <p key={beat.id}>
                  <span>{index + 1}</span>
                  {beat.voiceover}
                </p>
              ))}
            </div>
          ) : null}
          <strong>执行命令</strong>
          <code>{jianyingResult.command}</code>
          <strong>配音音色</strong>
          <code>
            {jianyingResult.speakerName} · {jianyingResult.speakerId}
          </code>
          {jianyingResult.downloadedAssets.length ? (
            <>
              <strong>本地视频素材</strong>
              {jianyingResult.downloadedAssets.map((assetPath) => (
                <code key={assetPath}>{assetPath}</code>
              ))}
            </>
          ) : null}
          {jianyingResult.skippedAssets.length ? (
            <>
              <strong>未下载/计划素材</strong>
              {jianyingResult.skippedAssets.slice(0, 4).map((assetUrl) => (
                <code key={assetUrl}>{assetUrl}</code>
              ))}
            </>
          ) : null}
          {jianyingResult.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {jianyingRun ? (
            <>
              <strong>{jianyingRun.ok ? "草稿已生成并通过验证" : "验证未通过"}</strong>
              {jianyingRun.draftPath ? <code>{jianyingRun.draftPath}</code> : null}
              {jianyingRun.validation ? (
                <div className="validation-list">
                  <span>验证分 {jianyingRun.validation.score} · 尝试 {jianyingRun.attempts} 次</span>
                  {jianyingRun.validation.checks.map((check) => (
                    <p key={check.id} className={check.passed ? "pass" : "fail"}>
                      {check.passed ? "通过" : "未过"} · {check.label}：{check.detail}
                    </p>
                  ))}
                </div>
              ) : null}
              {jianyingRun.publishKit ? (
                <div className="publish-kit">
                  <strong>小红书发布包</strong>
                  <code>{jianyingRun.publishKit.postPath}</code>
                  <code>{jianyingRun.publishKit.coverPromptPath}</code>
                  <p>{jianyingRun.publishKit.title}</p>
                  <p>{jianyingRun.publishKit.body}</p>
                  <p>{jianyingRun.publishKit.hashtags.join(" ")}</p>
                  <code>{jianyingRun.publishKit.coverText}</code>
                </div>
              ) : null}
              <code>{jianyingRun.stdout || jianyingRun.stderr}</code>
            </>
          ) : null}
        </div>
      ) : (
        <div className="notes-list">
          {(env?.notes.length ? env.notes : ["环境检查完成。生成内容包后可创建剪映脚本。"]).map((note) => (
            <p key={note}>{note}</p>
          ))}
          <div className="sound-mix">
            <Volume2 size={16} />
            <span>解说小帅 · 9:16 · 字幕安全区</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ArtifactItem({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`artifact-item ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AssetImage({ asset, large = false }: { asset: AssetCandidate; large?: boolean }) {
  const [failed, setFailed] = useState(false);

  if (asset.thumbnail && !failed) {
    return <img src={asset.thumbnail} alt={large ? asset.title : ""} onError={() => setFailed(true)} />;
  }

  return (
    <div className={`asset-fallback ${large ? "large" : ""}`}>
      <Film size={large ? 32 : 18} />
      {large ? (
        <div>
          <strong>{assetKindLabel(asset.kind)}</strong>
          <span>
            {asset.channel || "YouTube"} · {durationLabel(asset.durationSec)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <Film size={compact ? 18 : 24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
