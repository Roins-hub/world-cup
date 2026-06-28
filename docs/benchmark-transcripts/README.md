# Benchmark Transcript Docs

这里落地的是已采集足球短视频样本的字幕/旁白文案目录。

完整文案不靠口头总结，全部以本地 ASR JSON 为准：

- `data/benchmark/football-creators/youtube/transcripts/`：YouTube 对标账号逐条转写。
- `data/benchmark/football-creators/xhs/transcripts/`：小红书样本逐条转写。
- `text` 字段：整条合并文案。
- `segments` 字段：带 `start/end/text` 的字幕分段。

已生成文档：

- [@這就是足球 YouTube Shorts 99 条](youtube-this-is-football-99.md)
- [小红书足球样本 16 条](xiaohongshu-16.md)
- [机器可读 manifest](transcript-manifest.json)

当前统计：

## youtube

- 样本数：99
- 中位字数：403
- 分类分布：{"emotional_time_story": 11, "twist_story": 17, "star_micro_story": 2, "question_explainer": 54, "clip_commentary": 4, "general_narrative": 10, "silent_or_subtitle_only": 1}
- 开头分布：{"compressed_context_entry": 10, "start_from_visible_moment": 18, "direct_question": 59, "live_action_entry": 7, "value_or_attitude_claim": 4, "no_spoken_hook": 1}
- 结尾分布：{"fact_payoff": 34, "question_or_debate": 12, "open_loop_or_summary": 29, "emotional_payoff": 23, "none": 1}

## xhs

- 样本数：16
- 中位字数：312.0
- 分类分布：{"silent_or_subtitle_only": 3, "twist_story": 5, "live_match_commentary": 5, "general_narrative": 1, "emotional_time_story": 1, "question_explainer": 1}
- 开头分布：{"no_spoken_hook": 3, "live_action_entry": 4, "start_from_visible_moment": 6, "value_or_attitude_claim": 1, "direct_question": 2}
- 结尾分布：{"none": 3, "emotional_payoff": 2, "fact_payoff": 6, "open_loop_or_summary": 5}
