# Football Creator Benchmark Research

Date: 2026-06-22

## Scope

This benchmark pass collected:

- 99 YouTube Shorts from `@這就是足球`.
- 42 Xiaohongshu football/World Cup notes via logged-in `mcporter` + `xiaohongshu` MCP search.
- 18 top Xiaohongshu samples with detail reads, including video/image availability.

Raw and structured data:

- `data/benchmark/football-creators/youtube/this-is-football-samples.json`
- `data/benchmark/football-creators/youtube/this-is-football-stats.json`
- `data/benchmark/football-creators/xhs/xhs-search-samples.json`
- `data/benchmark/football-creators/benchmark-analysis.json`

## Tooling Status

`agent-reach` Xiaohongshu MCP is now configured through `mcporter`:

```bash
mcporter call 'xiaohongshu.search_notes' keywords='足球 世界杯' limit=5
mcporter call 'xiaohongshu.get_note_content' url='...'
```

Working:

- Search notes.
- Read note content.
- Read video and image links from accessible notes.
- Preserve logged-in cookie.

Known limitations:

- The MCP has no user-profile post-list tool, so the supplied Xiaohongshu profile cannot be exhaustively crawled yet.
- Comment reads can timeout on some notes because the dialog list selector does not appear reliably.
- YouTube Shorts in this sample have no available subtitles or auto-captions. Full voiceover transcription requires adding ffmpeg + ASR.
- Full benchmark transcripts should not be reproduced verbatim in project docs; convert them into structures, labels, and short examples.

## Findings

The successful samples do not behave like neutral football commentary. They use one of four entry points:

1. Star under pressure.
2. Underdog refusing the expected script.
3. One mistake becoming the whole story.
4. Prediction card with a concrete first-20-minute watch point.

YouTube title mechanisms in the original 80-sample title pass:

- Question: 47.
- Star/person: 30.
- Number/fact: 32.
- Shock/mistake: 11.
- World Cup-related: 24.

Xiaohongshu mechanisms in 42 samples:

- Star/person: 27.
- Number/fact: 26.
- Shock/mistake/upset: 14.
- Question: 9.
- Prediction/analysis: 10.

## Practical Rules For Our Pipeline

- Generate a protagonist before generating a script.
- Generate a watch point before generating a title.
- Use one number as an anchor: minute, score, ranking, save count, market-value gap.
- Avoid “客观分析” as the voice. Make a defensible bet.
- Do not put edit instructions in narration.
- If there is no visible proof, use a prediction/data-card format instead of pretending we have footage.
- If the first line does not make the viewer pick a side, rewrite.

## New Skill

Created:

- `/Users/airhua/.codex/skills/football-benchmark-scriptwriter/SKILL.md`
- `/Users/airhua/.codex/skills/football-benchmark-scriptwriter/references/benchmark-playbook.md`

Validated with:

```bash
python3 /Users/airhua/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/airhua/.codex/skills/football-benchmark-scriptwriter
```
