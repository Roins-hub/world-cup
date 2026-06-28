# JianYing Style Validation

Use this reference when converting a football content pack into a JianYing draft or judging whether a generated draft is publishable.

## Creative Separation

Voiceover and editing plan are different artifacts.

- `voiceover`: what the audience hears.
- `visualInstruction`: what the editor or automation does.
- `caption`: short on-screen emphasis, not the full production note.

Block when voiceover contains:

`素材`, `剪辑`, `画面怎么放`, `先放`, `切到`, `字幕`, `封面`, `发布平台`, `这条视频`, `对标账号`, `旁白`, `脚本`

## Audio Direction

Default Chinese voice:

- `解说小帅`
- speaker id: `BV411_streaming`

Mix:

- main video original audio: background level by default
- BGM: low bed only
- narrator must remain dominant
- commentary-assisted mode may keep original audio more present around the emotional peak
- subtitle-first mode may use almost no voiceover

Validation checks:

- `VoiceOver` track exists and is not confused with BGM
- BGM exists when cloud music is available
- BGM volume is below narration and does not exceed the configured low-bed threshold
- original video volume is ducked unless the selected mode explicitly preserves original audio

## Subtitle Direction

Benchmark-aligned Xiaohongshu football subtitles:

- large yellow text
- black border
- strong shadow
- lower-middle position
- not stuck at the default bottom
- one short spoken clause per subtitle

Validation checks:

- subtitle track exists
- subtitle segment count roughly matches voiceover segment count
- subtitle transform y is in the lower-middle range
- no individual subtitle line is too long to read on mobile

## Edit Rhythm

Default 60-second narrative:

- 0-3s: face, score, mistake, old clip, or question card
- 3-12s: proof shot plus one hard fact
- 12-30s: fast cuts led by narration
- 30-50s: slow down for the key proof
- 50-65s: replay/freeze/comment choice

Mode adjustments:

- `commentary_assisted`: fewer narrator lines, more original sound, subtitles clarify.
- `subtitle_first`: strong cover/subtitle, minimal narration, longer pauses.
- `fact_list`: more cuts, one fact per item, never keep one generic clip under a list.

## Draft Validation Gate

A generated JianYing draft is not publishable until these pass:

- draft folder and `draft_info.json` exist
- media paths exist
- media is copied into the draft `temp_assets` folder to avoid Mac permission failures
- video track covers at least 90% of the draft duration
- `VoiceOver` exists
- subtitles exist and sit in lower-middle position
- original audio is ducked
- BGM is low or missing only as a warning
- voiceover/subtitle segment delta is no more than 1
- duration is roughly 30-95 seconds
- creative score is 85+

If a check fails, recut or rewrite. Do not accept "plan looks fine" as completion.
