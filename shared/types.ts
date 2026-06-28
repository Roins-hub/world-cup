export type OutputLanguage = "zh" | "en" | "es" | "fr";

export type Fixture = {
  id: string;
  date: string;
  localTime: string;
  startsAt: string;
  group: string;
  home: string;
  away: string;
  venue: string;
  status: "upcoming" | "live" | "completed";
  source: string;
  result?: string;
};

export type ThemeOption = {
  id: string;
  label: string;
  angle: string;
  description: string;
  searchHint: string;
  whyForNonFans: string;
};

export type AssetCandidate = {
  id: string;
  title: string;
  url: string;
  channel?: string;
  durationSec?: number;
  thumbnail?: string;
  kind: "full_match" | "highlight" | "preview" | "press" | "supplement";
  confidence: number;
  query: string;
  usageHint: string;
  rightsNote: string;
};

export type EvidenceType =
  | "question_explainer"
  | "visible_incident"
  | "human_relationship"
  | "star_micro_action"
  | "live_commentary"
  | "subtitle_moment"
  | "fact_list";

export type NarrationMode = "narrative_voiceover" | "commentary_assisted" | "subtitle_first";

export type EditDifficulty = "low" | "medium" | "high";

export type HotspotSignal = {
  id: string;
  source: "youtube" | "web" | "xhs" | "fallback";
  query: string;
  title: string;
  url?: string;
  snippet?: string;
  weight: number;
  matchedTeams: string[];
  matchedPlayers: string[];
  keywords: string[];
};

export type TopicPreflightDimension = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  reason: string;
};

export type TopicPreflightScore = {
  total: number;
  verdict: "pass" | "repair" | "hide";
  dimensions: TopicPreflightDimension[];
  repairActions: string[];
};

export type TopicCandidate = {
  id: string;
  title: string;
  angle: string;
  hook: string;
  evidenceType: EvidenceType;
  narrationMode: NarrationMode;
  editDifficulty: EditDifficulty;
  styleEngineId: string;
  styleEngineLabel: string;
  topicMechanism: string;
  hotspotSignals: HotspotSignal[];
  riskFlags: string[];
  hotness: number;
  suggestedDurationSec: number;
  language: OutputLanguage;
  fixture?: Fixture;
  assetIds: string[];
  reason: string;
  preflight: TopicPreflightScore;
};

export type RejectedTopic = {
  title: string;
  reason: string;
  score: number;
  repaired: boolean;
};

export type ScriptBeat = {
  id: string;
  label: string;
  voiceover: string;
  visualInstruction: string;
  assetId?: string;
  startSec: number;
  durationSec: number;
};

export type MaterialMapItem = {
  id: string;
  asset: AssetCandidate;
  role: "primary" | "context" | "backup";
  suggestedCut: string;
  verification: string;
};

export type PublishPack = {
  platformTitle: string;
  description: string;
  hashtags: string[];
  coverText: string;
};

export type AudienceProfile = {
  id: string;
  label: string;
  platforms: string[];
  painPoint: string;
  contentPromise: string;
};

export type ScoreDimension = {
  id: string;
  label: string;
  score: number;
  reason: string;
};

export type ViralScore = {
  total: number;
  verdict: "go" | "revise" | "skip";
  targetAudience: AudienceProfile;
  recommendedPlatforms: string[];
  dimensions: ScoreDimension[];
  retryAdvice: string[];
};

export type ContentPack = {
  id: string;
  generatedAt: string;
  generationMode?: "codex_agent" | "deterministic_fallback";
  topic: TopicCandidate;
  assets: AssetCandidate[];
  title: string;
  hotness: number;
  suggestedDurationSec: number;
  script: ScriptBeat[];
  materialMap: MaterialMapItem[];
  publish: PublishPack;
  viralScore: ViralScore;
  costEstimate: {
    interactions: number;
    model: string;
    estimatedUsd: number;
  };
  workflowNotes: string[];
};

export type DraftValidationCheck = {
  id: string;
  label: string;
  passed: boolean;
  severity: "blocker" | "warning" | "info";
  detail: string;
};

export type DraftValidationReport = {
  passed: boolean;
  score: number;
  requiresRecut: boolean;
  draftPath?: string;
  durationSec?: number;
  videoCoverageRatio?: number;
  audioSubtitleDelta?: number;
  checks: DraftValidationCheck[];
  trackSummary: Array<{ name: string; type: string; segments: number }>;
  mediaPaths: string[];
};

export type CreativeValidationGate = {
  passed: boolean;
  score: number;
  attempts: number;
  repaired: boolean;
  checks: DraftValidationCheck[];
  notes: string[];
};

export type XiaohongshuPublishKit = {
  title: string;
  body: string;
  hashtags: string[];
  coverText: string;
  coverPrompt: string;
  postPath?: string;
  postUrl?: string;
  coverPromptPath?: string;
  coverPromptUrl?: string;
  coverSpecPath?: string;
  coverSpecUrl?: string;
  coverImagePath?: string;
  coverImageUrl?: string;
  imageModel?: string;
  imageStatus?: "generated" | "prompt_only" | "requested" | "failed";
  imageError?: string;
};

export type XiaohongshuPublishRequest = {
  scriptPath: string;
  draftPath?: string;
  generateCoverImage?: boolean;
};

export type XiaohongshuPublishResponse = {
  ok: boolean;
  publishKit?: XiaohongshuPublishKit;
  validation?: DraftValidationReport;
  notes: string[];
};

export type GenerateTopicsRequest = {
  language: OutputLanguage;
  topicText?: string;
  fixtureId?: string;
  themeId?: string;
  count: number;
};

export type GenerateTopicsResponse = {
  fixtures: Fixture[];
  themes: ThemeOption[];
  assets: AssetCandidate[];
  hotspotSignals: HotspotSignal[];
  topics: TopicCandidate[];
  rejectedTopics: RejectedTopic[];
  warnings: string[];
  trace: string[];
};

export type ContentPackRequest = {
  topicId: string;
  topic: TopicCandidate;
  assets: AssetCandidate[];
};

export type EnvironmentStatus = {
  ytDlp: boolean;
  python: boolean;
  jianyingPythonDeps: boolean;
  ffmpeg: boolean;
  jianyingSkillRoot?: string;
  jianyingDraftRoot?: string;
  platform: string;
  notes: string[];
};

export type JianyingPrepareRequest = {
  pack: ContentPack;
  draftName?: string;
  speaker?: string;
  aspectRatio?: "9:16" | "16:9";
  downloadMode?: "plan_only" | "download_highlights";
};

export type JianyingPrepareResponse = {
  ok: boolean;
  runId: string;
  runDir: string;
  planPath: string;
  scriptPath: string;
  srtPath: string;
  preparedPack?: ContentPack;
  creativeGate?: CreativeValidationGate;
  downloadedAssets: string[];
  skippedAssets: string[];
  canRunDraft: boolean;
  command: string;
  speakerId: string;
  speakerName: string;
  stdout?: string;
  stderr?: string;
  notes: string[];
};

export type JianyingRunRequest = {
  scriptPath: string;
};

export type JianyingRunResponse = {
  ok: boolean;
  scriptPath: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  draftPath?: string;
  attempts: number;
  validation?: DraftValidationReport;
  publishKit?: XiaohongshuPublishKit;
  notes: string[];
};
