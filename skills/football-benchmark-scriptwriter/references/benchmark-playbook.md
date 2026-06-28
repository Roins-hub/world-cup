# Benchmark Playbook

This reference comes from a June 2026 benchmark pass over:

- 99 YouTube Shorts from `@這就是足球`.
- 42 Xiaohongshu football/World Cup notes discovered through logged-in MCP search.
- 18 Xiaohongshu top samples with note detail reads, including video/image presence.

The sample data lives in `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/`.

Full transcript exports and style profile:

- Complete local voiceover/subtitle files: `/Users/airhua/Documents/world-cup/docs/benchmark-full-transcripts/`.
- Machine-readable style profile: `/Users/airhua/Documents/world-cup/data/benchmark/football-creators/voiceover-style-profile.json`.
- Human-readable profile doc: `/Users/airhua/Documents/world-cup/docs/benchmark-voiceover-style-profile.md`.

## Data Summary

YouTube:

- 99 Shorts transcribed from a 100-item raw sample. One additional raw item failed with YouTube 403 during download.
- Median duration: 65 seconds.
- Total visible views in sample: about 4.56M.
- Title mechanisms:
  - question: 47
  - star/person: 30
  - number/fact: 32
  - shock/mistake: 11
  - World Cup-related: 24

Xiaohongshu:

- 42 unique notes collected.
- Top detail pass: 18 notes, 16 with video links.
- Title/content mechanisms:
  - star/person: 27
  - number/fact: 26
  - shock/mistake/cold upset: 14
  - question: 9
  - prediction/analysis: 10

## What Actually Works

The complete transcript pass changed the operating model. The benchmark house style is not a single catchphrase. It is a set of engines:

- question explainer: 55 samples.
- visible incident / twist story: 33 samples.
- human relationship / emotional time payoff: 12 samples.
- live or clip commentary: 9 samples.
- subtitle/raw-sound moments: 4 samples.
- fact/list videos: high edit cost, useful but not the default.

### 1. Human First

The strongest samples rarely start with “this match”. They start with:

- a star being doubted,
- a small team refusing to disappear,
- a keeper making or almost making a fatal mistake,
- a commentator/fan reaction,
- a player gesture that explains pressure.

For World Cup automation, map every fixture to a protagonist before writing.

### 2. One Number Is Enough

Good football shorts use numbers as anchors, not reports:

- seconds: 16 minutes, 97 seconds, stoppage time, a first touch, or a single replayed moment.
- scoreline: 3-0, 1-1, 2-2.
- count: sixth World Cup, hat trick, four predictions.
- ratio: market value gap, world ranking gap.

Do not pile up five stats. One number plus one feeling is stronger.

### 3. The Hook Is A Side Choice

A useful hook makes the viewer answer internally:

- “which replay or reaction changes your read of the match?”
- “is this player still carrying the team?”
- “was it luck or strength?”
- “is this upset real?”

Weak hooks merely announce the subject.

### 4. Xiaohongshu Likes Social Utility

Xiaohongshu samples often spread through:

- prediction cards,
- saveable schedules,
- watch points for non-fans,
- comments about announcers or public figures,
- fan identity and “I was there” experience.

The script can be less technical if it gives the viewer a phrase they can repeat.

### 5. YouTube Shorts Likes Curiosity Mechanics

The benchmark YouTube account leans heavily on:

- question titles,
- absurd incidents,
- star-player stories,
- warm or ironic human moments,
- short durations around 30-70 seconds.

The copy often hides the full answer until the end. Build suspense before explaining.

### 6. Editability Is Part Of The Idea

Do not treat every strong narration as equally easy to reproduce.

- Rule/VAR/offside/tactical-board videos need strict frame matching or a diagram.
- Live commentary videos need original sound space and should not become long narrator videos.
- Subtitle-first moments need large mid-lower subtitles, not paragraph voiceover.
- Ranking/list videos need multiple clips; hide or lower score if those clips are not available.

The generator should filter these before the creator sees them.

## Script Archetypes

### Star Under Pressure

Use when a fixture includes Messi, Ronaldo, Mbappe, Haaland, Neymar, Yamal, or a similar draw.

Shape:

1. Start with a pressure bet.
2. Name the visible action.
3. Explain why non-fans can read it.
4. Show the old/current proof.
5. Ask whether the player still decides games.

### Underdog Refuses The Script

Use when a weaker team can defend, counter, or survive.

Shape:

1. Start with “everyone thinks this is a walkover”.
2. Give one gap: ranking, value, history, first World Cup.
3. Show one survival image: keeper, crowd, blocked shot.
4. Say which visible clue makes the favorite look less comfortable.
5. Ask if the upset is real.

### Mistake Becomes Story

Use when there is a keeper error, missed chance, substitution conflict, referee decision, or defensive lapse.

Shape:

1. Start with the cost of one detail.
2. Replay the action in plain language.
3. Name who carries the blame or survives it.
4. Explain the match consequence.
5. Ask if the audience forgives the player.

### Prediction Card

Use for upcoming fixtures or no-match-footage situations.

Shape:

1. Lead with the boldest defensible prediction.
2. Give one reason for each side.
3. Give one watch point tied to a visible clue, replay, face, crowd, or first counterattack.
4. Name the upset path.
5. End with a side choice.

## Rewrite Checklist

Before approving a script, scan:

- Did current hotspot/search signals feed the angle?
- Which style engine is being used?
- Is the edit difficulty low, medium, or high?
- Does the first sentence contain a bet, fear, or question?
- Can a non-fan repeat the watch point?
- Is there one named protagonist?
- Is there one visible proof?
- Are editing instructions absent from voiceover?
- Are AI connector crutches removed?
- Does the ending ask a real side-choice question?

If the answer is no, rewrite from the hook, not from adjectives.
