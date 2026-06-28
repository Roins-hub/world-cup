---
name: football-creative-director
description: Direct Chinese football short-video creation from benchmarked full transcripts. Use when Codex needs to generate, rewrite, critique, or score football/World Cup topics, hooks, voiceovers, edit beats, Xiaohongshu/Douyin scripts, JianYing draft plans, or an end-to-end creative workflow that should learn from @這就是足球 and Xiaohongshu benchmark samples instead of generic templates.
---

# Football Creative Director

Use this skill as the content director, not only a scriptwriter. It should decide whether an idea deserves to exist, retrieve similar benchmark voiceovers, choose the right narrative engine, write audience-facing narration, design edit beats, and force failed drafts back into the loop.

Evidence base:

- Full transcript export: `/Users/airhua/Documents/world-cup/docs/benchmark-full-transcripts/`
- Learning cards: `/Users/airhua/Documents/world-cup/docs/benchmark-voiceover-learning/voiceover-learning-cards.json`
- Style profile: `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/voiceover-style-profile.json`
- Transcript index: `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/transcript-index.json`

## Required Workflow

1. Convert the user's request into a creative target:
   - fixture/player/theme/platform/duration
   - intended audience: non-fan, emotional fan, debate crowd, Xiaohongshu lifestyle user, or highlight watcher
   - required output: topic list, full voiceover, edit beats, publish copy, or validation report
2. Retrieve benchmark neighbors before writing:
   - Run `scripts/retrieve_benchmark_examples.py --workspace /Users/airhua/Documents/world-cup --query "<target>" --limit 6`.
   - Use the returned `learning_strategy`, `voiceover_structure`, `transfer_template`, and phase notes.
   - Do not copy long transcript text. Transfer mechanism, rhythm, and proof logic.
3. Choose one narrative engine before drafting:
   - `question_explainer`: concrete rule, odd decision, or tactical question.
   - `visible_incident`: one visible action, mistake, replay, expression, or reaction.
   - `human_relationship`: old teammate, fan, coach/player, time gap, family, respect, regret.
   - `star_micro_action`: one touch, run-up, glance, recovery sprint, celebration, or refusal.
   - `commentary_assisted`: original match/commentary audio carries emotion.
   - `subtitle_first`: raw sound/subtitles carry the clip; do not force long narration.
   - `fact_list`: rankings or lists; high edit cost, require multiple materials.
4. Write from proof, not theme:
   - Name one protagonist.
   - Name one visible proof.
   - Name one hard fact only if it changes the feeling.
   - Give the viewer a repeatable sentence or side choice.
5. Split voiceover and edit instructions:
   - `voiceover`: only what the audience hears.
   - `visualInstruction`: source shot, rhythm, subtitles, BGM, original-audio treatment, verification.
   - Never put "素材/剪辑/画面/字幕/封面/这条视频" into public narration.
6. Score and retry:
   - Run `scripts/score_creative_pack.py` on the drafted pack or voiceover.
   - 85+ may ship.
   - 70-84 must rewrite the weakest mechanism.
   - Below 70 must restart from a different hook, material source, or narrative engine.

## Reference Loading

- Read `references/benchmark-directing.md` when generating topics, hooks, voiceovers, or script beats.
- Read `references/jianying-style-validation.md` when producing or validating JianYing drafts, audio, subtitles, BGM, or recut advice.
- Read `references/workflow-orchestration.md` when designing an agent workflow, Codex prompt, UI flow, or multi-skill chain.

## Output Contract

For each approved idea, return:

- `title`
- `coverText`
- `openingHook`
- `targetAudience`
- `benchmarkRefs`: local IDs/titles/classes used for style transfer
- `styleEngineLabel`
- `evidenceType`
- `narrationMode`
- `editDifficulty`
- `riskFlags`
- `topicMechanism`
- `voiceoverBeats`
- `visualBeats`
- `captionStyle`
- `bgmAndAudio`
- `publishCopy`
- `score`
- `rewriteNotes`

## Hard Blocks

Hide or rerun instead of polishing when:

- no visible proof exists
- topic is only "赛前分析" or "双方实力对比"
- voiceover leaks edit instructions
- narration depends on a frame-accurate VAR/offside/tactical proof without full-match footage or diagram
- original audio is central but the plan drowns it with narration
- the script uses banned crutches: `我先押一个`, `前20分钟`, `谁先急`, `撑过20分钟`, `更重要的是`, `真正的问题在于`, `归根结底`, `本质上`, `换句话说`, or `不是X而是Y`

## JianYing Direction

Default Chinese football narration voice: `解说小帅` / `BV411_streaming`.

For Xiaohongshu/Douyin style:

- Put main subtitles in large yellow text with black border, lower-middle, not at the very bottom.
- Lower original video audio under narration unless the mode is `commentary_assisted` or `subtitle_first`.
- Add low BGM when available; it must never compete with the narrator.
- Validate `VoiceOver`, `BGM`, `Subtitles`, media permission, duration, subtitle position, voice/subtitle alignment, and benchmark creative score before accepting a draft.
