# Codex 创作代理架构

## 问题

旧链路的问题不是某个模板写得差，而是 TypeScript 代码在承担创作。

之前的路径大致是：

`赛程 -> 主题模板 -> 规则打分 -> 固定 6 段旁白 -> 内容包`

这会导致所有输出都长得像同一个模子：标题结构相似、旁白节奏相似、转折相似，越优化越像“高级模板”。

## 新原则

代码不再写内容。

代码只负责：

- 读取未来赛程。
- 搜索素材和热点信号。
- 提供完整旁白风格画像。
- 调用 Codex 创作代理。
- 校验结构、风险、旁白泄漏、剪映可用性。
- 在 Codex 不可用时提供明确标记的紧急降级。

Codex 负责：

- 从素材和热点信号中提取真正话题。
- 判断观众为什么会停下。
- 选择叙事引擎。
- 写选题、口播、剪辑节奏、发布文案。
- 自己评分、隐藏低分项。

## 运行链路

```mermaid
flowchart LR
  A["用户选择未来赛程/主题"] --> B["后端搜索 YouTube/FIFA/新闻热点"]
  B --> C["读取完整旁白风格画像"]
  C --> D["Benchmark RAG: 检索相似完整旁白样本"]
  D --> E["Codex 创作代理"]
  E --> F["结构化 JSON: 选题 + 完整脚本 + 评分"]
  F --> G["缓存创作草稿"]
  G --> H["UI 展示选题"]
  H --> I["生成内容包"]
  I --> J["剪映计划/下载/验证"]
```

## 关键文件

- `server/creative-agent.ts`：Codex 创作代理调用、缓存、内容包转换。
- `server/schemas/codex-creative.schema.json`：Codex 输出 JSON Schema。
- `server/pipeline.ts`：保留调度、素材、热点、校验和紧急降级。
- `/Users/airhua/.codex/skills/football-creative-director`：足球创作操刀手 skill。
- `/Users/airhua/.codex/skills/football-creative-director/scripts/retrieve_benchmark_examples.py`：按当前话题检索相似完整旁白样本。
- `data/benchmark/football-creators/voiceover-style-profile.json`：完整旁白风格画像。
- `scripts/codex-agent-smoke.ts`：真实 Codex 代理 smoke。

## Codex 输出契约

每个 topic 必须返回：

- 标题、hook、reason。
- `styleEngineLabel`、`evidenceType`、`narrationMode`、`editDifficulty`。
- `hotspotSignalIds`、`riskFlags`。
- 完整 `script`：每段有 `voiceover` 和 `visualInstruction`。
- `publish`：封面、标题、描述、话题标签。
- `viralScore` 和 `preflight`。

## Benchmark RAG

当前 Codex prompt 不再只拿全局风格画像。

`server/creative-agent.ts` 会在每次创作前调用 `football-creative-director` 的检索脚本，按赛程、主题、素材标题和热点信号检索相似样本，并把 `benchmarkReferences` 一起交给 Codex。

这一步解决的问题是：让 Codex 学当前话题附近的完整旁白结构，而不是只照着抽象规则写。

## 降级策略

`deterministic_fallback` 只用于保证产品不空白。

触发条件：

- `WC_TEST_OFFLINE=1`
- `WC_DISABLE_CODEX_AGENT=1`
- Codex CLI 不可用
- Codex 超时或未返回合法 JSON

降级结果会在 `warnings` 和 `trace` 中明确标记，不应被当作目标创作效果。

## 验证

- `npm run test:quality`：离线质量回归，验证降级可用、字段完整、旁白/剪辑分离。
- `npm run test:codex-agent`：真实 Codex 创作代理 smoke，会实际调用 Codex CLI。
- `npm run build`：类型和前端构建。

## 下一步

- 给 UI 增加“重新创作”按钮，直接重新调用 Codex，不走旧模板修复。
- 给失败项增加“为什么隐藏”的抽屉。
- 将剪映验证失败后的“重剪”也改成 Codex 代理回路，而不是程序重写旁白。
