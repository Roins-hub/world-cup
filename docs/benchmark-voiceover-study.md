# Benchmark Voiceover Study

Last updated: 2026-06-22

## What Was Actually Collected

This pass uses real downloaded audio/video plus ASR, not only titles.

- YouTube benchmark account: 99 Shorts transcribed from `@這就是足球`.
- Xiaohongshu benchmark/search samples: 16 videos transcribed from logged-in MCP detail reads.
- Index file: `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/transcript-index.json`
- Full transcript files:
  - `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/youtube/transcripts/`
  - `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/xhs/transcripts/`
- ASR script: `/Users/airhua/Documents/world-cup/scripts/benchmark_asr.py`
- Index script: `/Users/airhua/Documents/world-cup/scripts/build_transcript_index.py`

Important correction: earlier topic/script edits were premature because they used titles and partial metadata, not full voiceover transcripts. Those edits were rolled back before this study.

Collection note: the YouTube channel Shorts page yielded 8043 entries via yt-dlp. The project raw sample now contains 100 selected `@這就是足球` Shorts; 99 were downloaded/transcribed successfully and 1 failed with a YouTube 403 download error.

## Sample Mix

YouTube, 99 samples:

- question explainer: 54
- twist story: 17
- emotional time story: 11
- general narrative: 10
- clip commentary: 4
- star micro story: 2
- silent/subtitle-only or ASR-empty: 1
- median length: 403 Chinese characters
- detected star/name tag: 49
- detected question-hook tag: 56
- detected time-payoff tag: 71
- detected data/ranking tag: 78
- detected replay/reveal tag: 21
- detected mistake/conflict tag: 38

Xiaohongshu, 16 samples:

- silent or subtitle-only: 3
- live match commentary: 5
- twist story: 5
- general narrative: 1
- emotional time story: 1
- question explainer: 1
- median length: 312 Chinese characters
- detected star/name tag: 13
- detected live-energy tag: 11
- detected data/ranking tag: 11
- detected replay/reveal tag: 6

This means the two benchmark surfaces are not the same. YouTube Shorts leans toward compressed narrated stories. Xiaohongshu football samples contain more raw match commentary, subtitle-only moment edits, and highlight clips.

## YouTube Benchmark Findings

The strongest YouTube Shorts are usually not prediction cards. They are micro-stories around one visible incident.

Common entry points:

- A visible oddity: a save, a replay, a sideline exchange, a player refusing a substitution.
- A human relationship: former teammate, father and son, player and child fan.
- A delayed reveal: the audience first sees the incident, then learns why it matters.
- A star filtered through one small action, not through career biography.

Common structure:

1. Start at the moment of tension or with a short question.
2. Give one concrete image the viewer can picture.
3. Reveal the hidden reason or consequence.
4. Add one background fact only after the viewer cares.
5. End on payoff, not a generic slogan.

What is not dominant in the 99 transcribed YouTube voiceovers:

- Repeated “I bet…” phrasing.
- Generic match previews.
- Long tactical explanation before the visual incident.
- Always ending with “what do you think?”.

## Xiaohongshu Findings

The high-interaction Xiaohongshu samples show a broader mix:

- Some high-like clips have almost no voiceover and rely on original sound, subtitles, or an iconic moment.
- Real-time commentary can work when the match moment itself has enough energy.
- Narrated analysis appears, but it is usually shorter and more attached to a clip than a full essay.
- Titles often carry more of the platform hook than the spoken narration.

For this project, that implies:

- If we generate narrated clips, do not copy live-commentary pacing blindly.
- If the source clip is already dramatic, narration should be lighter.
- If there is no dramatic source clip, we need a YouTube-style micro-story, not a generic Xiaohongshu caption.

## Working Content Engines From Real Samples

These are patterns observed from transcripts, expressed as reusable engines rather than copied lines.

### 1. Visible Incident First

Use when a clip has an obvious moment.

Shape:

- Start with the visible action.
- Say why it looks normal or heroic at first.
- Reveal why the replay changes the meaning.
- End with the consequence.

Good for:

- Goal-line incidents.
- Keeper errors.
- Referee/VAR moments.
- Missed chances.

### 2. Human Relationship Reveal

Use when the story has an emotional link.

Shape:

- Start from the moment two people meet or react.
- Delay the identity/background reveal.
- Add the time gap or old relationship.
- End with emotional payoff.

Good for:

- Messi/Cristiano stories.
- Former teammates.
- player and fan stories.
- father/son or coach/player tension.

### 3. Question Explainer

Use when the audience might not understand the clip.

Shape:

- Open with a concrete question.
- Explain the rule or situation in plain language.
- Show the visual clue.
- Close with what the audience should conclude.

Good for:

- Offside.
- goal-line technology.
- tactical board/coach instruction.
- controversial decisions.

### 4. Star Micro-Action

Use when a star is the traffic source.

Shape:

- Do not list trophies.
- Pick one gesture, pass, touch, exchange, or decision.
- Explain what that action says about pressure, leadership, or decline.
- Keep the whole script tied to that one moment.

Good for:

- Messi, Cristiano, Mbappe, Haaland, Neymar.
- “last dance” or legacy pieces.
- responsibility debates.

### 5. Raw Commentary Clip

Use when the original commentary already has emotion.

Shape:

- Keep narrator light or skip narrator.
- Preserve original commentary at audible level.
- Use subtitles to clarify names, score, and turning point.
- Add only short context cards.

Good for:

- Fresh match highlights.
- high-energy goals.
- iconic saves.
- live reactions.

## Immediate Implications For Our Workflow

Topic generation should not start from a stock prediction sentence. It should first ask:

- What is the visible incident?
- What does the viewer misunderstand at first glance?
- Who is the human protagonist?
- What is the delayed reveal?
- Is the original audio strong enough to carry the clip?

Script generation should separate three modes:

- Narrative voiceover: for YouTube-style micro-stories.
- Commentary-assisted clip: for Xiaohongshu match highlights with strong original audio.
- Subtitle-first moment edit: for clips where voiceover would make the moment heavier, not better.

Scoring should add a new preflight field:

- `evidenceType`: visible incident, human relationship, rule explainer, star micro-action, live commentary, or subtitle-only moment.

If a topic cannot name an `evidenceType`, it should not be shown.

## What Still Needs More Data

- The exact Xiaohongshu profile URL cannot be exhaustively paged by the current MCP; current samples come from search and note-detail reads.
- More Xiaohongshu account-specific samples are needed once a profile post-list route is available.
- YouTube has 99 Shorts transcribed in this pass.
- ASR has minor Chinese name and football-term errors, but narrative structure is readable.
