---
name: world-cup-scriptwriter
description: Write, revise, and score World Cup short-video scripts for non-expert creators. Use when Codex needs to turn fixtures, match highlights, official YouTube/FIFA videos, platform trend notes, or content-pack JSON into human-sounding scripts, hooks, titles, cover text, shot-by-shot voiceover, audience targeting, Xiaohongshu/Douyin variants, or viral-worthiness scoring.
---

# World Cup Scriptwriter

Use a material-first, audience-first workflow. Do not write generic football commentary.

When copy feels technically correct but boring, also use `football-benchmark-scriptwriter`. Its benchmark playbook is now based on 115 ASR-transcribed benchmark samples: 99 YouTube Shorts from `@這就是足球` and 16 Xiaohongshu football videos.

Current style profile:

- Full transcripts: `/Users/airhua/Documents/world-cup/docs/benchmark-full-transcripts/`
- Machine-readable profile: `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/voiceover-style-profile.json`
- Profile doc: `/Users/airhua/Documents/world-cup/docs/benchmark-voiceover-style-profile.md`

Do not default to `我先押一个`, `前20分钟`, `谁先急`, or `撑过20分钟`. The sample study does not support treating those as the benchmark style, and the project owner explicitly dislikes that direction.

## Workflow

0. Run the hotspot/style preflight.
   - Search current web/video/social signals for the selected future fixture or player.
   - Load the benchmark style profile and choose a style engine before writing.
   - Never start from a static prediction template.
1. Pick the audience before writing.
   - 足球小白：explain what to watch and how to talk about it.
   - 情绪型观众：turn scorelines into pressure, regret, pride, last chances.
   - 争议讨论人群：translate rules into human language and invite debate.
   - 小红书生活方式用户：make the match part of outfits, night snacks, watch parties, workday fatigue.
2. Pick the platform shape.
   - 抖音：conflict, suspense, fast conclusion, one clear question.
   - 小红书：identity, usefulness, save/share value, carousel-friendly structure.
   - 微博：real-time hot-word radar and fast title source.
   - B站：longer emotional arc or high-energy montage reference.
3. Verify the material angle.
   - Use official/highlight/full-match/press assets as proof.
   - If no usable visual proof exists, write a low-risk explainer using tactical boards, timelines, data cards, or lifestyle visuals.
   - If the topic is a star-player history line, avoid biography sprawl. Use one player, one action, one pressure point.
   - If the topic needs frame-accurate visual proof, require full-match footage or a generated diagram before showing it.
4. Preflight-score topics before showing them.
   - Hide weak candidates before the creator sees them.
   - Every candidate must name an `evidenceType`: visible incident, human relationship, question explainer, star micro-action, live commentary, or subtitle moment.
   - Every candidate must also name `styleEngineLabel`, `narrationMode`, `editDifficulty`, `hotspotSignals`, and `riskFlags`.
   - If the candidate cannot name a real evidence type, fetch more material or hide it.
   - If the candidate is close, repair it once by adding a visible incident, a delayed reveal, a Chinese team/player name, or a comment-side question.
   - If material is weak, supplement official highlights, old upsets, press videos, and fixture context before rewriting.
   - If current hotspot search fails, fall back to fixture/player signals, but mark the warning.
5. Write in short spoken sentences.
   - One idea per sentence.
   - Avoid “首先/其次/最后” unless doing a list.
   - Avoid empty AI phrases: “值得关注的是”, “整体来看”, “提供参考”, “历史表现”.
   - Avoid emphasis crutches: “更重要的是”, “更关键的是”, “更要命的是”, “真正的问题在于”, “说到底”, “归根结底”, “本质上”, “换句话说”, “进一步说”.
6. End with a comment hook.
   - Ask the audience to pick a side, choose a clip angle, or predict the next moment.

## Script Structure

Use this 6-beat default for 45-75 second clips:

1. **Hook, 0-5s**: one sharp claim or question.
2. **Context, 5-15s**: explain why non-fans should care.
3. **Conflict, 15-28s**: pressure, argument, reversal, or stakes.
4. **Proof, 28-42s**: bind the line to concrete visual evidence.
5. **Now, 42-55s**: connect the old/current material to today.
6. **Comment hook, 55-65s**: invite a clear response.

## Topic Candidate Rules

Generated topics should make the creator want to click before the script exists.

- Prefer evidence-led titles: “这个回放一出来，整场球的意思都变了”, “梅西那个手势，比进球更适合做开头”, “为什么这个动作会让全场吵起来”.
- For star-player history lines, prefer one-action hooks: “梅西那脚贴地球，才是圆满的起点”, “C罗那几步助跑，像是在拒绝结局”, “亚马尔这一小下，比进球更能说明问题”.
- Use Chinese team names in Chinese output. Do not show `Spain vs Saudi Arabia` when the UI language is Chinese.
- Use Chinese player names when a player appears: `亚马尔`, `佩德里`, `萨勒姆·达瓦萨里`, `姆巴佩`, `哈兰德`.
- Make the evidence obvious: which visible moment, relationship, rule, or micro-action supports the topic.
- Avoid neutral titles like “今晚最该看什么” unless they contain a concrete threat or prediction.
- The topic card hook should sound like spoken short-video copy, not a research summary.
- Topic generation must be "signal -> engine -> topic", not "theme -> template -> adjectives".
- Good topic card shape:
  - Title: one incident or question.
  - Hook: why the first glance is incomplete.
  - Reason: what the replay, relationship, or consequence reveals.
- Do not show low-score topics in UI. The topic generator should run a preflight pass first:
  - 82+ = show.
  - 65-81 = repair once, then rescore.
  - below 65 = hide and log the reason.
- Preflight dimensions:
  - 钩子张力 0-25: visible incident, question, replay/reveal, relationship, or consequence.
  - 口语感 0-15: short title, readable hook, no AI connector crutches.
  - 事实锚点 0-20: visible action, old scoreline, player name, rule, crowd reaction, replay clue.
  - 互动性 0-15: the viewer knows what to watch, argue, or bet on.
  - 中文本地化 0-10: Chinese team and player names in Chinese output.
  - 素材支撑 0-15: official/highlight/full-match/press assets exist.
- Repair does not mean adding adjectives. Repair by changing the mechanism:
  - Material weak -> supplement search first.
  - Hook weak -> attach it to a visible incident or a human reveal.
  - Too objective -> add consequence: who gets blamed, remembered, misunderstood, defended.
  - Too technical -> translate into face, crowd, replay, body movement, or one rule condition.

## Style Engines

Use these engines from the complete transcript profile:

- `question_explainer`: rules, VAR, offside, referee, odd tactical instruction. Medium difficulty; needs a visible condition.
- `visible_incident`: mistake, replay reveal, reaction, one action changing the story. Default short-video engine.
- `human_relationship`: old teammate, fan, father/son, coach/player, time-gap payoff. Lowest edit difficulty when facts are known.
- `star_micro_action`: star player plus one touch, run-up, look, reaction, or recovery sprint. Use for Messi/Ronaldo/Mbappe/Haaland/Yamal.
- `commentary_assisted`: original audio is already emotional. Keep narration short; do not drown match sound.
- `subtitle_first`: subtitle/raw sound carries the moment. Do not force long narration.
- `fact_list`: rankings, best XI, historical lists. High editing difficulty; require multiple clips.

High-risk filters:

- `strict_visual_rule_match`: hide unless full match, replay, or diagram exists.
- `needs_original_audio`: route to commentary-assisted mode.
- `multi_asset_fact_list`: lower score unless there are enough assets.
- `subtitle_or_raw_sound_only`: route to subtitle-first mode.

## Anti-Machine Rules

- Replace “这场比赛具有重要意义” with a concrete question: “为什么这个动作会让全场吵起来？”
- Replace “双方历史表现” with an image: “老镜头里，强队最怕全场突然安静的那几秒。”
- Replace “素材优先” in public scripts with what the viewer sees: “先看表情，再看比分。”
- Use human hesitations sparingly: “先别急着骂裁判”, “说白了”, “你可能不懂球，但这一下能看懂”.
- Keep football jargon below 20%. Translate jargon immediately.
- Apply Humanizer-zh cleanup before delivery:
  - Delete vague grandeur: “命运感”, “具有重要意义”, “值得关注”.
  - Avoid formula pairs: “不是 X，而是 Y”, “不是 X，是 Y”, “不仅……而且……”.
  - Avoid connector crutches: “更重要的是”, “更关键的是”, “更要命的是”, “最要命的是”, “真正的问题在于”, “真正可怕的是”, “真正值得警惕的是”, “问题的核心在于”, “说到底”, “归根结底”, “本质上”, “深层原因是”, “从根本上说”, “更深一层看”, “换句话说”, “进一步说”.
  - Avoid three-item filler lists unless the list is visual and useful.
  - Prefer one concrete old fact, one visible shot, and one judgment.
  - Read the line aloud. If it sounds like a content strategy memo, rewrite it.

## Voiceover Rules

- Default JianYing voice for Chinese football narration: `解说小帅` / `BV411_streaming`.
- Write for that voice: short clauses, strong punctuation, no paragraph-long sentences.
- A 60-second script should feel like 10-18 spoken chunks, not a polished article.
- `voiceover` is audience-facing only. Never put editing instructions into it.
- Forbidden in `voiceover`: “素材”, “剪辑”, “画面怎么放”, “先放”, “切到”, “字幕”, “封面”, “发布平台”, “这条视频”.
- Put all edit decisions in `visualInstruction`: source clip, shot type, rhythm, subtitles, cover, and timing notes.
- Final QA must include a leakage scan: if the narration still tells the editor what to do, rewrite before generating a JianYing draft.
- If voiceover fails, rerun the writing workflow instead of asking the editor to accept it:
  - Leakage -> move edit words into `visualInstruction`.
  - AI connector crutch -> delete it and start with the fact.
  - No hook -> rewrite the first line around the visible incident, question, or human reveal.
  - No explanation -> add one plain-language reason a non-fan can repeat.
  - No comment hook -> end with a side choice.

Mode-specific voiceover:

- `narrative_voiceover`: 10-18 short spoken chunks for 45-75 seconds.
- `commentary_assisted`: narrator only gives setup and clarification; original sound carries emotion.
- `subtitle_first`: large mid-lower subtitles plus original sound; voiceover is optional or very short.

## JianYing Delivery Rules

- Main subtitles should imitate hot Xiaohongshu football videos: large yellow text, black border, centered in the lower-middle area. Do not leave the primary subtitle at the default very bottom position.
- Lower original match/video audio to background level before adding narration. Use the match sound only as texture.
- Add a low BGM bed when available. BGM should sit under the narrator, never compete with `解说小帅`.
- Validate `VoiceOver` separately from `BGM`; a BGM track does not count as narration.
- If subtitle position, voiceover/subtitle alignment, media availability, or original-audio volume fails validation, recut instead of publishing.

## Xiaohongshu Benchmark Rules

The strongest benchmark style is not “how to edit”. It is a human story with a result, a contrast, and a reason to care.

Use this hierarchy for football short-video narration:

1. **Underdog/person hook**: “所有人都不看好你” / “一个没人记得名字的人” / “这个小球队又站到强队面前”.
2. **Concrete fact**: scoreline, age, population, market value, saves, possession, old upset.
3. **Emotional turn**: “他没把自己当陪跑”, “慢镜头一出来，全场安静”, “这个小动作改了故事”.
4. **Simple viewer lens**: what a non-fan should watch in the first visible proof.
5. **Payoff/question**: what changed after replay, who was misunderstood, who carries the consequence.

For a 60-75 second football script, prefer:

- 1 named person or team as protagonist.
- 2 hard facts at most.
- 1 repeated emotional idea.
- No tactical diagram lecture unless the selected style is explicitly tactical analysis.

Benchmark distinction:

- “佛得角零封西班牙，沃齐尼亚一战成名” style: high short-video value, because it has an underdog, a named protagonist, data contrast, and an emotional payoff.
- “西班牙统治地位背后的战术” style: useful for long tactical explainers, but too diagram-heavy for a fast hot-topic clip unless the user chose a tactical-analysis mode.

Additional Xiaohongshu research notes:

- Xiaohongshu football content spreads when it creates “social moments”, not only match analysis: a funny nickname, a face, a crowd reaction, a referee/story angle, or a fan identity card.
- Non-fans need a repeatable lens tied to evidence: “第一眼看错了什么”, “慢镜头改了什么”, “这个动作说明什么”, “谁被误会了”.
- Good football hooks often borrow everyday language: exam jokes, workplace pressure, old-account settling, “陪跑” vs “留下名字”.
- The strongest short-video voiceover shape is: visible incident/person -> concrete fact -> reveal or emotional turn -> simple viewer lens -> payoff or comment-side choice.
- For World Cup topic manufacturing, the first screen should select fixture/theme, then the AI layer fetches material and filters topics; do not make non-expert creators type a football thesis.

## Scoring

Score every idea before producing. For content packs, use the benchmark-driven nine dimensions:

- Audience clarity: 0-15
- Three-second hook: 0-15
- Protagonist/story: 0-15
- Fact anchor: 0-15
- Visual proof: 0-12
- Human voiceover: 0-12
- Editing rhythm: 0-8
- Interaction hook: 0-8
- Remixability: 0-7

Verdict:

- 85+ = go
- 70-84 = revise
- below 70 = skip

If revise/skip, change one of: audience, hook, platform format, or material source. Do not simply rewrite adjectives.

## Star Player History Lines

Use this mode for Ronaldo, Messi, Mbappe, Neymar, Haaland, or a match's featured player.

- Do not write a biography.
- Do not list trophies.
- Pick one pressure moment: a free kick run-up, a low shot, a substitute bench, a missed chance, a recovery sprint, a first touch.
- The script shape is: player hook -> old/fresh pressure -> one visible action -> why it matters -> comment-side choice.
- Good title shapes:
  - “C罗那几步助跑，像是在拒绝结局”
  - “梅西打墨西哥那脚球，才是圆满的起点”
  - “亚马尔回头看替补席那一下，比过人更像成人礼”
- Risk check:
  - Replace fan-war language with a concrete action.
  - Use official/FIFA/club/national-team material as fact anchors.
  - Treat third-party edits as research-only unless usage rights are clear.

## Retry Loop

Never stop at a failed draft or weak topic.

1. Topic preflight fails -> repair by changing mechanism, or hide before display.
2. Hotspot search is weak -> supplement YouTube/FIFA/news/social search and rescore.
3. Material support fails -> supplement official/highlight/full-match/press searches, then rescore.
4. Edit difficulty is high -> reroute to commentary/subtitle/diagram mode or hide.
5. Voiceover fails -> rewrite from audience hook, not from edit instructions.
6. Creative score fails -> regenerate script beats and publish copy.
7. JianYing validation fails -> recut with corrected media, audio, subtitle, and duration constraints.
8. Repeat until the item passes or the workflow can name a hard blocker such as missing permissions or unavailable source media.

## References

- For platform-specific topic patterns, read `references/platform-playbook.md`.
- For reusable script patterns and examples, read `references/script-patterns.md`.
- For scoring and validation rules, read `references/scoring-rubric.md`.
