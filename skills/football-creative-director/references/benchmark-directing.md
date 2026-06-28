# Benchmark Directing

This reference condenses the full transcript pass in `/Users/airhua/Documents/world-cup/docs/benchmark-full-transcripts/` into transferable creative rules.

The sample is not a set of catchphrases. It is a set of repeatable choices:

- 115 videos total.
- 110 usable narrated videos.
- 99 YouTube Shorts from `@這就是足球`.
- 16 Xiaohongshu football videos.
- 7513 subtitle segments.
- Dominant openings: direct question, visible moment, live action.
- Dominant endings: fact payoff, open-loop summary, emotional payoff.

## Director Rule

Start from a viewer question, not from a match label.

Weak:

- `葡萄牙对乌兹别克斯坦赛前分析`
- `今晚世界杯值得关注`
- `C罗能否延续状态`

Usable:

- one action the viewer can see
- one person under pressure
- one replay that changes the read
- one rule or decision that non-fans want explained
- one original-audio moment that already has emotion

## Narrative Engines

### Question Explainer

Use for rules, VAR, offside, referee, odd coaching decisions, or a "why did he do that" moment.

Shape:

`question -> plain-language condition -> visible clue -> answer -> side choice`

Requirements:

- one concrete question
- one rule or reason
- one visible action, stand, replay, or pauseable frame

Avoid when the proof needs frame matching but you only have generic highlight clips.

### Visible Incident

Use for mistakes, saves, missed chances, arguments, reactions, replay reveals, or one action that changes the story.

Shape:

`visible event -> first read -> replay/context reveal -> consequence`

Requirements:

- one action or reaction
- one before/after meaning change
- who gets blamed, defended, remembered, or misunderstood

### Human Relationship

Use for old teammates, fans, coach/player, family, respect, time gaps, and warm or painful reunions.

Shape:

`reaction -> identity reveal -> time gap -> payoff`

Requirements:

- one person
- one reaction, embrace, stare, shirt, gesture, or old fact
- a time gap or relationship reveal

### Star Micro Action

Use for Ronaldo, Messi, Mbappe, Haaland, Neymar, Yamal, or the match's featured player.

Shape:

`one star action -> pressure -> why non-fans can read it -> debate`

Requirements:

- one touch, run-up, glance, recovery sprint, celebration, refusal, or bench reaction
- not a biography
- not a trophy list

### Commentary Assisted

Use when live audio or original commentary carries the emotion.

Shape:

`short setup -> original sound -> one clarifier -> result`

Requirements:

- keep narration short
- subtitles explain names, score, and turning point
- do not cover the original emotional peak

### Subtitle First

Use when the clip works through raw sound, meme text, or a self-evident moment.

Shape:

`cover hook -> original sound/subtitle -> one-line explanation -> pause`

Requirements:

- large mid-lower subtitle
- minimal or no voiceover
- strong visible moment

### Fact List

Use for rankings, best XI, historical lists, and "top N" formats.

Treat as high edit difficulty. Require multiple materials, one fact per item, and fast visual changes. Hide if material support is weak.

## Voiceover Moves

Use short spoken chunks. A 45-75 second narrative voiceover usually needs 10-18 chunks. A beat can contain one or two short sentences.

Prefer:

- concrete person before abstract team
- visible action before tactical noun
- one number, not five
- one consequence
- plain-language explanation a non-fan can repeat
- comment choice only when it feels earned

Avoid:

- neutral setup: `本场比赛备受关注`
- report language: `双方历史表现`
- vague importance: `具有重要意义`
- AI connectors: `更重要的是`, `真正的问题在于`, `本质上`
- formula twist: `不是X而是Y`
- editor words in narration

## Topic Preflight

Score before showing the idea:

- Hook tension 0-20: question, visible incident, replay, relation, pressure.
- Protagonist 0-15: named player/team/referee/fan/keeper.
- Visible proof 0-15: action, reaction, score bug, replay, crowd, old clip.
- Fact anchor 0-12: one scoreline, age, minute, ranking, record, or old event.
- Spoken human voice 0-12: short, oral, no AI connectors.
- Editability 0-10: required footage exists and difficulty is honest.
- Platform fit 0-8: Xiaohongshu/Douyin title and subtitle rhythm.
- Interaction/remix 0-8: side choice, repeatable phrase, debate angle.

85+ can ship. 70-84 rewrite by changing mechanism, not adjectives. Below 70 restart.

## Benchmark Retrieval Use

Use `scripts/retrieve_benchmark_examples.py` before writing.

Recommended queries:

- fixture: `葡萄牙 乌兹别克斯坦 C罗 爆冷`
- star: `C罗 最后一舞 压力 微动作`
- rule: `越位 裁判 VAR 为什么`
- upset: `弱队 门将 零封 爆冷`
- original audio: `原声 解说 进球 高能`

The retrieval output gives local file paths. Open the full transcript only when you need to inspect rhythm or the first/middle/end structure. Do not paste long benchmark text into deliverables.
