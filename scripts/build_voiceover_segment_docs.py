#!/usr/bin/env python3
"""Export every benchmark ASR segment as a processed learning row.

This does not republish the full transcript text. Each ASR segment is processed
into a learning row with timestamp, phase, function, technique, and reuse note.
The local ASR JSON remains the source of exact transcript text.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "data/benchmark/football-creators/transcript-index.json"
OUT_DIR = ROOT / "docs/benchmark-voiceover-learning"
YT_DOC = OUT_DIR / "youtube-this-is-football-99-segments.md"
XHS_DOC = OUT_DIR / "xiaohongshu-16-segments.md"
JSON_DOC = OUT_DIR / "voiceover-segment-learning.json"
README = OUT_DIR / "README.md"


STAR_RE = re.compile(r"梅西|C罗|C羅|姆巴佩|哈兰德|哈蘭德|内马尔|內馬爾|亚马尔|亞馬爾|马内|馬內|Cristiano|Ronaldo|Messi|Mbappe|Haaland", re.I)
QUESTION_RE = re.compile(r"为什么|為什麼|怎么|怎麼|到底|吗|嗎|？|\?")
DATA_RE = re.compile(r"\d|第[一二三四五六七八九十]|排名|身价|身價|纪录|紀錄|分钟|分鐘|岁|歲|万|萬|亿|億|比")
REPLAY_RE = re.compile(r"回放|慢镜|慢鏡|慢動作|镜头|鏡頭|第一眼|看错|看錯|才发现|才發現|原来|原來")
CONFLICT_RE = re.compile(r"失误|失誤|离谱|離譜|红牌|紅牌|点球|點球|VAR|犯规|犯規|争议|爭議|爆冷|翻车|翻車|输|輸|怕|急|崩")
ACTION_RE = re.compile(r"进球|進球|射门|射門|扑救|撲救|传球|傳球|助攻|反击|反擊|跑|冲|衝|抢|搶|防守|庆祝|慶祝")
EMOTION_RE = re.compile(r"哭|笑|泪|淚|温暖|溫暖|心酸|遗憾|遺憾|梦想|夢想|告别|告別|青春|爱|愛|感动|感動")
CTA_RE = re.compile(r"你觉得|你覺得|评论区|評論區|你会|你會|谁|誰|哪|吗|嗎|？|\?")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def timecode(seconds: float) -> str:
    seconds = max(0, seconds)
    return f"{int(seconds // 60):02d}:{int(seconds % 60):02d}"


def source_url(payload: dict[str, Any]) -> str:
    metadata = payload.get("metadata") or {}
    return metadata.get("url") or metadata.get("video_url") or "-"


def phase_for(position: float) -> str:
    if position <= 0.12:
        return "开头钩子"
    if position <= 0.32:
        return "背景铺垫"
    if position <= 0.62:
        return "冲突/解释"
    if position <= 0.82:
        return "证据/反转"
    return "结尾回收"


def segment_function(text: str, position: float) -> tuple[str, str, str]:
    """Return function, technique, reuse note for a segment."""
    if QUESTION_RE.search(text):
        return ("抛问题", "用疑问制造信息缺口", "适合改写成选题开头，让观众先想答案。")
    if REPLAY_RE.search(text):
        return ("揭示细节", "用回放/镜头改变第一印象", "适合迁移成“第一眼看错，回放才懂”的结构。")
    if CONFLICT_RE.search(text):
        return ("制造冲突", "把失误、争议或压力具体化", "适合放在开头 3-12 秒，快速制造停留理由。")
    if STAR_RE.search(text):
        return ("建立人物", "用球星或人物名把信息聚焦", "适合从履历改成一个动作或一个反应。")
    if DATA_RE.search(text):
        return ("补事实锚点", "用数字、比分、年份或排名支撑判断", "适合只保留一个关键数字，避免资料堆叠。")
    if ACTION_RE.search(text):
        return ("描述动作", "把比赛变化落到可见动作", "适合指导旁白绑定镜头，而不是空泛评价。")
    if EMOTION_RE.search(text):
        return ("情绪回收", "用人物情绪把事实变成故事", "适合结尾做记忆点或共情收束。")
    if CTA_RE.search(text):
        return ("引导互动", "给观众一个可回答的问题", "适合结尾变成评论区站队。")
    phase = phase_for(position)
    if phase == "开头钩子":
        return ("压缩入场", "不铺长背景，直接给观众进入点", "适合做短视频第一句的背景压缩。")
    if phase == "背景铺垫":
        return ("交代背景", "用少量上下文让事件成立", "适合保留一个最必要背景，其余删掉。")
    if phase == "冲突/解释":
        return ("推进解释", "承接前句继续解释原因", "适合拆成短句，避免论文腔。")
    if phase == "证据/反转":
        return ("补证据", "把前面的判断落到证据", "适合绑定表情、动作、回放或原声。")
    return ("收束观点", "把信息回收到结论或余味", "适合结尾留一句能被复述的话。")


def detected_signals(text: str) -> list[str]:
    signals: list[str] = []
    checks = [
        ("人物", STAR_RE),
        ("问题", QUESTION_RE),
        ("数字", DATA_RE),
        ("回放/镜头", REPLAY_RE),
        ("冲突", CONFLICT_RE),
        ("动作", ACTION_RE),
        ("情绪", EMOTION_RE),
        ("互动", CTA_RE),
    ]
    for label, pattern in checks:
        if pattern.search(text):
            signals.append(label)
    return signals or ["承接"]


def processing_note(phase: str, function: str, technique: str, signals: list[str], char_count: int) -> str:
    signal_text = "、".join(signals)
    if char_count <= 4:
        return f"短促过渡段，主要用来接住上一句；信号是{signal_text}。"
    if function == "抛问题":
        return f"这一段用问题制造缺口，信号是{signal_text}；学习它先让观众想答案。"
    if function == "揭示细节":
        return f"这一段把注意力拉到镜头/回放，信号是{signal_text}；学习它改变第一眼判断。"
    if function == "制造冲突":
        return f"这一段把矛盾说具体，信号是{signal_text}；学习它给评论区一个争点。"
    if function == "建立人物":
        return f"这一段把叙事收束到人，信号是{signal_text}；学习它用人名代替泛泛球队分析。"
    if function == "补事实锚点":
        return f"这一段补硬信息，信号是{signal_text}；学习它只用一个事实支撑判断。"
    if function == "描述动作":
        return f"这一段落到可见动作，信号是{signal_text}；学习它让旁白能对应画面。"
    if function == "情绪回收":
        return f"这一段负责情绪，信号是{signal_text}；学习它把事实变成人的感受。"
    if function == "引导互动":
        return f"这一段转向观众，信号是{signal_text}；学习它把结尾变成可回复问题。"
    return f"这一段处在{phase}，功能是{function}；{technique}，识别信号是{signal_text}。"


def source_samples(source: str) -> list[dict[str, Any]]:
    index = read_json(INDEX_PATH)
    return [sample for sample in index["samples"] if sample["source"] == source]


def build_video_rows(sample: dict[str, Any], source_no: int) -> dict[str, Any]:
    transcript_path = ROOT / sample["transcript_file"]
    payload = read_json(transcript_path)
    segments = [
        {
            "start": float(segment.get("start") or 0),
            "end": float(segment.get("end") or 0),
            "text": compact(segment.get("text") or ""),
        }
        for segment in payload.get("segments") or []
        if compact(segment.get("text") or "")
    ]
    duration = max([segment["end"] for segment in segments], default=float((payload.get("asr") or {}).get("duration") or 0))
    processed_segments: list[dict[str, Any]] = []
    for idx, segment in enumerate(segments, start=1):
        position = (segment["start"] / duration) if duration else 0
        function, technique, reuse = segment_function(segment["text"], position)
        phase = phase_for(position)
        signals = detected_signals(segment["text"])
        processed_segments.append(
            {
                "index": idx,
                "time": f"{timecode(segment['start'])}-{timecode(segment['end'])}",
                "phase": phase,
                "function": function,
                "technique": technique,
                "signals": signals,
                "processing_note": processing_note(phase, function, technique, signals, len(segment["text"])),
                "reuse_note": reuse,
                "char_count": len(segment["text"]),
            }
        )
    return {
        "number": source_no,
        "id": sample["id"],
        "source": sample["source"],
        "title": sample["title"],
        "url": source_url(payload),
        "author_or_channel": sample.get("author_or_channel"),
        "class": sample["class"],
        "opening_shape": sample["opening_shape"],
        "ending_shape": sample["ending_shape"],
        "tags": sample.get("tags") or [],
        "char_count": sample["char_count"],
        "segment_count": len(processed_segments),
        "duration_sec": round(duration, 1),
        "transcript_file": sample["transcript_file"],
        "processed_segments": processed_segments,
    }


def md_table(rows: list[dict[str, Any]]) -> list[str]:
    lines = [
        "| # | 时间 | 阶段 | 功能 | 识别信号 | 本段处理说明 | 学习用法 | 字数 |",
        "|---:|---|---|---|---|---|---|---:|",
    ]
    for row in rows:
        lines.append(
            "| {index} | {time} | {phase} | {function} | {signals} | {processing_note} | {reuse_note} | {char_count} |".format(
                **{**row, "signals": "、".join(row["signals"])}
            )
        )
    return lines


def write_source_doc(path: Path, title: str, videos: list[dict[str, Any]]) -> None:
    total_segments = sum(video["segment_count"] for video in videos)
    lines = [
        f"# {title}",
        "",
        "说明：这是全量逐段处理文档。每一个 ASR 字幕段都被处理成学习行；完整逐字旁白在每条视频的本地 ASR JSON 里。",
        "",
        f"- 视频数：{len(videos)}",
        f"- 已处理字幕段：{total_segments}",
        "",
    ]
    for video in videos:
        abs_path = ROOT / video["transcript_file"]
        lines.extend(
            [
                f"## {video['number']:03d}. {video['title'] or '无标题'}",
                "",
                f"- 来源：{video['source']} / {video.get('author_or_channel') or '-'}",
                f"- URL：{video['url']}",
                f"- 本地完整 ASR：[{video['transcript_file']}](<{abs_path}>)",
                f"- 类型：`{video['class']}`；开头：`{video['opening_shape']}`；结尾：`{video['ending_shape']}`",
                f"- 字数/段数/时长：{video['char_count']} 字 / {video['segment_count']} 段 / {video['duration_sec']} 秒",
                "",
                "逐段处理：",
                "",
            ]
        )
        if video["processed_segments"]:
            lines.extend(md_table(video["processed_segments"]))
        else:
            lines.append("> 该样本 ASR 无可用字幕段；完整情况见本地 ASR JSON。")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_readme_patch(youtube_segments: int, xhs_segments: int) -> None:
    existing = README.read_text(encoding="utf-8") if README.exists() else "# Benchmark Voiceover Learning\n"
    block = "\n".join(
        [
            "",
            "## 全量逐段处理",
            "",
            "这部分不是摘录卡片，而是把每条视频的每个 ASR 字幕段都处理成学习行。",
            "",
            f"- [@這就是足球 99 条逐段处理](youtube-this-is-football-99-segments.md)：{youtube_segments} 段",
            f"- [小红书 16 条逐段处理](xiaohongshu-16-segments.md)：{xhs_segments} 段",
            "- [机器可读逐段数据](voiceover-segment-learning.json)",
            "",
            "逐段表包含：时间戳、所在阶段、段落功能、使用技法、迁移写法、字数。",
            "",
        ]
    )
    if "## 全量逐段处理" in existing:
        existing = existing.split("## 全量逐段处理", 1)[0].rstrip()
    README.write_text(existing.rstrip() + "\n" + block, encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_videos: list[dict[str, Any]] = []
    for source in ("youtube", "xhs"):
        samples = source_samples(source)
        all_videos.extend(build_video_rows(sample, idx) for idx, sample in enumerate(samples, start=1))
    youtube_videos = [video for video in all_videos if video["source"] == "youtube"]
    xhs_videos = [video for video in all_videos if video["source"] == "xhs"]
    write_source_doc(YT_DOC, "@這就是足球 YouTube Shorts 99 条全量逐段旁白处理", youtube_videos)
    write_source_doc(XHS_DOC, "小红书 16 条全量逐段旁白处理", xhs_videos)
    JSON_DOC.write_text(json.dumps(all_videos, ensure_ascii=False, indent=2), encoding="utf-8")
    write_readme_patch(
        sum(video["segment_count"] for video in youtube_videos),
        sum(video["segment_count"] for video in xhs_videos),
    )
    print(f"wrote {YT_DOC} ({len(youtube_videos)} videos)")
    print(f"wrote {XHS_DOC} ({len(xhs_videos)} videos)")
    print(f"wrote {JSON_DOC} ({len(all_videos)} videos)")


if __name__ == "__main__":
    main()
