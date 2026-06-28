# Benchmark Voiceover Learning

这套文档用于学习对标账号的旁白文案，不是简单抄录。

生成结果：

- [@這就是足球 YouTube Shorts 99 条旁白学习卡片](youtube-this-is-football-99-learning.md)
- [小红书 16 条旁白学习卡片](xiaohongshu-16-learning.md)
- [机器可读学习卡片 JSON](voiceover-learning-cards.json)

样本数量：

- YouTube：99
- 小红书：16
- 总计：115

每条卡片包含：

- 视频标题与本地 ASR 全文路径
- 旁白类型：问题解释、反转揭示、情绪时间线、球星微动作等
- 开头/中段/结尾的整片处理
- 节奏指标：字数、字幕段数、平均段长、时长
- 可迁移文案模板

## 全量逐段处理

这部分不是摘录卡片，而是把每条视频的每个 ASR 字幕段都处理成学习行。

- [@這就是足球 99 条逐段处理](youtube-this-is-football-99-segments.md)：5936 段
- [小红书 16 条逐段处理](xiaohongshu-16-segments.md)：1577 段
- [机器可读逐段数据](voiceover-segment-learning.json)

逐段表包含：时间戳、所在阶段、段落功能、使用技法、迁移写法、字数。
