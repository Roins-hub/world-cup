---
name: football-benchmark-scriptwriter
description: Write and revise Chinese football short-video topics, voiceovers, edit beats, captions, and publish copy using benchmarked creator patterns from YouTube Shorts and Xiaohongshu football accounts. Use when Codex needs non-machine-like football scripts, star-player stories, World Cup hot takes, short-video hooks, narration rewrites, benchmark scoring, or a stronger alternative to generic match commentary.
---

# Football Benchmark Scriptwriter

Use this skill when football copy feels correct but boring. Write from transcribed benchmark evidence, not from a stock football hot-take template.

Current evidence base:

- 99 YouTube Shorts from `@這就是足球` transcribed with ASR.
- 16 Xiaohongshu football videos transcribed from MCP note-detail video links.
- Index: `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/transcript-index.json`.
- Full local transcript export: `/Users/airhua/Documents/world-cup/docs/benchmark-full-transcripts/`.
- Machine-readable style profile: `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/voiceover-style-profile.json`.
- Style study: `/Users/airhua/Documents/world-cup/docs/benchmark-voiceover-style-profile.md`.
- Study: `/Users/airhua/Documents/world-cup/docs/benchmark-voiceover-study.md`.

Do not default to `我先押一个`, `前20分钟`, `谁先急`, or `撑过20分钟`. The transcribed benchmark set does not support treating that as the house style, and the project owner explicitly dislikes that direction.

## Core Workflow

0. Load the style profile before writing or scoring.
   - Use the complete-transcript style engines, not memory of a few catchy examples.
   - Dominant benchmark shape: direct question or visible moment -> small context -> explanation -> proof -> payoff/side choice.
   - Treat live commentary, subtitle-only moments, strict rule explainers, and ranking/list videos as editing-risk classes.
1. Pick an `evidenceType` before writing:
   - `visible_incident`: one visible event whose meaning changes after replay or context.
   - `human_relationship`: old teammate, child fan, father/son, coach/player, or time-gap payoff.
   - `question_explainer`: a rule, tactical oddity, or strange decision the viewer needs explained.
   - `star_micro_action`: one gesture, touch, exchange, or decision from a star.
   - `live_commentary`: original match/commentary audio already carries emotion.
   - `subtitle_moment`: the clip works mainly through original sound plus large subtitles.
2. Choose the narration mode:
   - Narrative voiceover: for YouTube-style micro-stories.
   - Commentary-assisted clip: for strong Xiaohongshu match highlights.
   - Subtitle-first moment edit: when extra narration would weaken the moment.
3. Pick one visible proof.
   - One shot, one body movement, one scoreline, one number, one crowd reaction.
   - If no visible proof exists, hide the topic or fetch more material before writing.
   - If the proof needs strict frame matching, require full-match footage or a diagram; otherwise do not show it as a normal voiceover topic.
4. Write a title as a specific incident, not a label.
   - Good shape: `{球员/球队} + {一个异常动作/关系/争议} + {后果或疑问}`.
   - Weak: `阿根廷 vs 奥地利赛前分析`.
5. Write voiceover as spoken discovery.
   - 8-14 short chunks for a 45-70 second video.
   - No editing instructions in voiceover.
   - No neutral setup like “本场比赛备受关注”.
6. Design edit beats after the voiceover.
   - Put source, rhythm, subtitles, BGM, and original-audio decisions in edit notes.
   - Keep narration human-facing only.
7. Score before delivery.
   - If no protagonist, no visible proof, or no comment-side argument, rewrite.
   - If edit difficulty is high and material support is weak, hide the topic instead of polishing copy.

## Benchmark Rules

Load `references/benchmark-playbook.md` when writing or revising an important script, changing scoring logic, or explaining why a script is weak.

Rules distilled from the benchmark sample:

- YouTube benchmark voiceovers most often use question explainers, compressed context, star micro-stories, emotional time payoffs, and replay/reveal twists.
- Xiaohongshu samples often rely on live match commentary, subtitle-only moments, and strong titles more than polished narration.
- The hook should attach to a visible incident or human relationship before it talks about the match.
- Do not lecture tactics before the viewer cares.
- Do not hide behind “客观分析”. Make the viewer want to know what happened in the clip.
- A comment question is useful, but not mandatory; many strong samples end on payoff or consequence.

## Title Patterns

Use these as shapes, not templates to copy.

- Visible incident: `{球员/门将/裁判}一个细节，把整场球的意思改了`
- Replay reveal: `第一眼都以为是{A}，慢镜头出来才发现是{B}`
- Human relationship: `{球员}看到这个人之后，表情突然变了`
- Question explainer: `为什么这个动作会让全场吵起来？`
- Star micro-action: `{球员}这一小下，比进球更能说明问题`
- Live commentary: `{比赛结果/进球瞬间}原声已经够狠，旁白别抢戏`

## Voiceover Shape

Default 60-second shape:

Use the shape that matches `evidenceType`:

- `visible_incident`: event -> contradiction -> replay/context reveal -> consequence.
- `human_relationship`: reaction -> identity reveal -> time gap -> emotional payoff.
- `question_explainer`: concrete question -> plain-language rule -> visual clue -> conclusion.
- `star_micro_action`: one action -> why it matters -> pressure/legacy -> debate or payoff.
- `live_commentary`: short setup card -> preserve original audio -> one subtitle clarifier -> result.
- `subtitle_moment`: title/cover hook -> original audio -> large subtitles -> no heavy narrator.

Keep sentences short. Avoid:

- “更重要的是”, “真正的问题在于”, “归根结底”, “本质上”.
- “不是 X，而是 Y” as the main trick.
- `我先押一个`, `前20分钟`, `谁先急`, `撑过20分钟` as the default topic engine.
- Long tactical nouns without a visible image.
- Copy that sounds like a content strategy memo.

## Hotspot-First Topic Flow

Do not generate from a fixed template first.

1. Search current network signals for the fixture/player/theme:
   - YouTube/FIFA/highlight titles.
   - Google News/RSS/web headlines.
   - Xiaohongshu/Douyin signals when available.
2. Convert signals into a style engine:
   - rule/VAR/offside/referee -> `question_explainer`.
   - replay/mistake/action/reaction -> `visible_incident`.
   - player/fan/old teammate/time gap -> `human_relationship`.
   - Messi/Ronaldo/Mbappe/Haaland/Yamal plus one action -> `star_micro_action`.
   - original commentary/high-energy live audio -> `live_commentary`.
   - no real narration, meme subtitle, or raw sound -> `subtitle_moment`.
   - rankings/lists/history best XI -> `fact_list`, high edit difficulty.
3. Generate only topics that can name:
   - `styleEngineLabel`
   - `evidenceType`
   - `narrationMode`
   - `editDifficulty`
   - `hotspotSignals`
   - `riskFlags`
4. Hide or reroute high-risk topics:
   - `strict_visual_rule_match`: full match or diagram required.
   - `needs_original_audio`: commentary-assisted mode, not long narration.
   - `multi_asset_fact_list`: require multiple clips or lower score.
   - `subtitle_or_raw_sound_only`: subtitle-first mode, minimal narration.

## Edit Beat Rules

For each beat include:

- `voiceover`: what the audience hears.
- `visualInstruction`: source clip, shot, subtitle, rhythm, audio, and verification.
- `caption`: short on-screen text, not full subtitles.

Good edit rhythm:

- 0-3s: face/score/mistake, large hook caption.
- 3-12s: proof shot plus one hard fact.
- 12-30s: 2-4 quick cuts with narrator leading.
- 30-50s: slow down for the key moment.
- 50-65s: freeze or replay while asking the comment question.

## Quality Gate

Score out of 100:

- Human entry 15
- Three-second hook 15
- Visible proof 15
- Concrete fact 12
- Evidence type clarity 12
- Spoken voice 10
- Editability 8
- Comment fight 8
- Platform fit 5

Hard blockers before scoring:

- No visible proof.
- Voiceover contains editing instructions.
- Topic cannot name a style engine.
- Topic has high edit difficulty but no matching material.
- Topic repeats the banned "押一个/前20分钟/谁先急" family.

Verdict:

- 85+ deliver.
- 70-84 rewrite the weakest two dimensions.
- Below 70 restart from a different human entry.

## Output Contract

When asked to write a script, return:

- `title`
- `coverText`
- `openingHook`
- `styleEngineLabel`
- `evidenceType`
- `narrationMode`
- `editDifficulty`
- `hotspotSignals`
- `riskFlags`
- `voiceoverBeats`
- `visualBeats`
- `captionStyle`
- `bgmAndAudio`
- `publishCopy`
- `score`
- `rewriteNotes`

Do not provide long verbatim benchmark transcripts. Use benchmarked structures and short compliant examples only.
