# World Cup Creator Pack

世界杯热点批量制造台。它复刻视频里的核心思路：不是先让 AI 写稿，而是先从 YouTube/FIFA 等真实视频素材出发，再生成选题、脚本、素材地图、发布文案，并继续向剪映自动化草稿流转。

## 快速开始

```bash
npm run dev
```

打开 `http://localhost:5173`。

Codex/命令行直接生成内容包：

```bash
npm run codex:pack -- --topic "France vs Senegal 2002 World Cup shock" --language zh --count 5
```

## 当前闭环

- 赛程/主题输入：前台以“近期赛程下拉 + AI 主题方向下拉”为主，适合不懂球但要批量生产内容的使用者；命令行仍兼容自由主题。
- YouTube 素材搜索：通过 `yt-dlp` 查询真实视频，按完整比赛、高光、前瞻、发布会分类。
- 选题发散：根据素材支撑度生成 3-10 个短视频题材。
- 内容包：输出标题、热度、1 分钟脚本、素材地图、发布文案和成本估算。
- 剪映准备：生成 `content-pack.json`、`subtitles.srt`、`create_jianying_draft.py`。
- 下载模式：默认不下载完整比赛；可下载高光/前瞻类素材后生成剪映草稿脚本。

## 剪映 skill 接入

安装或指定剪映 skill：

```bash
git clone https://github.com/luoluoluo22/jianying-editor-skill.git skills/jianying-editor
```

或者：

```bash
export JY_SKILL_ROOT=/absolute/path/to/jianying-editor-skill
```

Python 3.9 环境下至少需要：

```bash
python3 -m pip install --user pymediainfo==7.0.1 edge-tts==7.2.3 websockets==15.0.1
```

生成剪映计划后，页面会显示可执行命令：

```bash
JY_SKILL_ROOT=/absolute/path/to/skill python3 runs/<run-id>/create_jianying_draft.py
```

也可以直接在页面点击“执行剪映草稿”。后端会只允许运行 `runs/` 目录下由本项目生成的脚本。

注意：该 skill 的自动导出主要支持 Windows + 剪映专业版 5.9 或更低版本。macOS 目前更适合作为草稿生成和手动导出的实验环境。

## 已验证

- `npm run build`：通过。
- `npm run codex:pack -- --topic "France vs Senegal 2002 World Cup shock" --language zh --count 3`：生成内容包，抓到 FIFA 高光/完整比赛素材。
- `npm run verify:ui`：Playwright 桌面/移动截图通过，覆盖生成选题和内容包。
- 剪映链路：下载 3 条高光 MP4，执行 `create_jianying_draft.py` 成功生成草稿 `WC_下载验证`。
- 草稿验收：`MainVideo` 3 段、`VoiceOver` 19 段、`Title` 1 段、`Subtitles` 19 段。
- 权限修复验证：新草稿 `WC_权限验证` 的视频素材已复制到草稿目录 `temp_assets` 后再导入，避免剪映无权读取 `Documents/runs`。
- 热点评分与验证 agent：`WC_评分验证` 一次通过，验证分 100，视频覆盖率 95.97%，旁白/字幕差值 0。
- `WC_宿命重逢_06-21` 已按小红书参考视频重制：默认配音 `解说小帅` / `BV411_streaming`，标题为 `沙特还能再吓强队一次吗？西班牙最怕开局打不开`，旁白走“弱者反差/小球队留门缝”路线，草稿验证分 100，创意分 100，视频覆盖率 100%，旁白/字幕差值 0。
- 已修复旁白/剪辑思路混淆：`voiceover` 只给观众听，`visualInstruction` 才写剪辑动作；创意评分未达 85 会触发重写和重剪。

## 进一步文档

- [YouTube 方案功能对照](docs/youtube-feature-parity.md)
- [中文平台世界杯热点剪辑调研](docs/platform-research.md)
- [小红书足球热点对标拆解](docs/xiaohongshu-benchmark.md)
- [世界杯脚本 Skill 与验证闭环](docs/script-skill-and-validation-loop.md)

## 资料来源

- YouTube 方案视频：https://www.youtube.com/watch?v=NYnMhGVte80
- 剪映 skill：https://github.com/luoluoluo22/jianying-editor-skill
- FIFA 赛程：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
- ESPN 赛程快照：https://www.espn.com/soccer/story/_/id/48939282/2026-fifa-world-cup-fixtures-results-match-schedule-group-stage-knockout-rounds-bracket
