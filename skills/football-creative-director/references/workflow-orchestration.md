# Workflow Orchestration

Use this reference when wiring Codex, benchmark learning, topic generation, content packs, and JianYing validation.

## Natural-Language First

The creator should be able to say:

`我要拉一个 C 罗世界杯最后一舞话题，做小红书 60 秒视频。`

The workflow should infer or ask only for missing essentials:

- target platform
- fixture/player/theme
- duration
- whether to download footage or generate a plan only

Do not require the creator to type a football thesis or manually fill a template.

## Agent Chain

Recommended chain:

1. Intent parser
   - Extract fixture/player/team/theme/platform/duration.
   - If fixture is missing, search current schedules and propose options.
2. Hotspot/material search
   - Search YouTube/FIFA/highlights/press/news/social signals.
   - Keep source titles, URLs, confidence, and rights notes.
3. Benchmark retrieval
   - Run `football-creative-director/scripts/retrieve_benchmark_examples.py`.
   - Pass top matches into the Codex creative prompt as `benchmarkReferences`.
4. Creative director
   - Choose narrative engine.
   - Generate multiple candidate topics.
   - Hide weak topics before display.
5. Copy chief / critic
   - Run `score_creative_pack.py` or equivalent checks.
   - If score is below 85, rewrite by changing mechanism.
6. Content pack builder
   - Preserve Codex voiceover and visual beats.
   - Do not rewrite Codex drafts through old deterministic templates.
7. JianYing builder
   - Prepare content pack, SRT, script, and optional downloaded assets.
   - Use `解说小帅`.
8. Draft validator
   - Validate video/audio/subtitle/media/creative score.
   - Recut once automatically when possible.

## Prompt Inputs

The Codex creative agent should receive:

- user intent
- selected fixture or free topic
- assets
- hotspot signals
- machine-readable style profile
- benchmark references retrieved for this exact topic
- hard voiceover leak rules
- output JSON schema

Do not only pass a style summary. Style summaries prevent the worst generic output, but benchmark retrieval is what gives the agent concrete rhythm and mechanism.

## Trace Requirements

The API response should expose enough trace for debugging:

- selected fixture/theme
- search queries
- asset count and source mix
- hotspot signal sources
- benchmark reference IDs/titles/classes
- Codex mode vs deterministic fallback
- rejected topic reasons
- validation failures and retry actions

If the response came from deterministic fallback, mark it clearly. It is operational fallback, not target creative quality.

## Failure Loop

Failure means reroute, not polish:

- weak hook -> retrieve a different benchmark class and regenerate
- no visible proof -> search more material or change engine
- too objective -> add protagonist and consequence
- too technical -> turn rule/tactic into a visible condition
- high edit difficulty -> require full match/diagram, route to commentary/subtitle mode, or hide
- voiceover leaks editing instructions -> move them to `visualInstruction`
- BGM/subtitle/audio fails -> recut, not publish
