#!/usr/bin/env python3
"""Build processed voiceover learning cards from benchmark ASR transcripts.

The goal is not to republish full transcripts. The docs process each full video
into learnable copywriting structure: hook, progression, payoff, pacing, and a
safe short reference excerpt with a pointer to the local ASR JSON source.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "data/benchmark/football-creators/transcript-index.json"
OUT_DIR = ROOT / "docs/benchmark-voiceover-learning"
README_PATH = OUT_DIR / "README.md"
YOUTUBE_DOC_PATH = OUT_DIR / "youtube-this-is-football-99-learning.md"
XHS_DOC_PATH = OUT_DIR / "xiaohongshu-16-learning.md"
CARDS_PATH = OUT_DIR / "voiceover-learning-cards.json"


CLASS_LABELS = {
    "question_explainer": "问题解释型",
    "twist_story": "反转揭示型",
    "emotional_time_story": "情绪时间线型",
    "star_micro_story": "球星微动作型",
    "clip_commentary": "片段解说型",
    "live_match_commentary": "原声现场型",
    "general_narrative": "通用叙事型",
    "silent_or_subtitle_only": "字幕/原声主导型",
}

OPENING_LABELS = {
    "direct_question": "直接抛问题",
    "start_from_visible_moment": "先给可见瞬间",
    "compressed_context_entry": "压缩背景进入",
    "live_action_entry": "现场动作进入",
    "value_or_attitude_claim": "先给判断/态度",
    "no_spoken_hook": "无明显口播钩子",
}

ENDING_LABELS = {
    "fact_payoff": "事实结论收束",
    "emotional_payoff": "情绪回收",
    "open_loop_or_summary": "开放式总结",
    "question_or_debate": "评论区问题",
    "none": "无明显口播结尾",
}

TAG_LABELS = {
    "star": "球星/人物",
    "time_payoff": "时间差/旧事回收",
    "replay_reveal": "回放揭示",
    "mistake": "失误/争议",
    "question_hook": "问题钩子",
    "live_energy": "现场能量",
    "comment_hook": "评论钩子",
    "data_or_ranking": "数字/排名锚点",
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compact_text(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def safe_excerpt(text: str, limit: int = 22) -> str:
    text = compact_text(text)
    if not text:
        return ""
    return text[:limit] + ("..." if len(text) > limit else "")


def sentenceish_segments(payload: dict[str, Any]) -> list[dict[str, Any]]:
    segments = payload.get("segments") or []
    rows = []
    for segment in segments:
        text = compact_text(segment.get("text") or "")
        if not text:
            continue
        rows.append(
            {
                "start": float(segment.get("start") or 0),
                "end": float(segment.get("end") or 0),
                "text": text,
            }
        )
    return rows


def timecode(seconds: float) -> str:
    seconds = max(0, seconds)
    minute = int(seconds // 60)
    second = int(seconds % 60)
    return f"{minute:02d}:{second:02d}"


def sample_url(payload: dict[str, Any]) -> str:
    metadata = payload.get("metadata") or {}
    return metadata.get("url") or metadata.get("video_url") or "-"


def class_strategy(sample_class: str) -> tuple[str, str, str]:
    if sample_class == "question_explainer":
        return (
            "先用一个具体问题逼观众停住，再给规则/背景/原因，最后把答案落到一个能看懂的判断。",
            "问题 -> 条件解释 -> 可见线索 -> 结论",
            "为什么{动作/判罚/选择}会让人吵起来？先看{可见线索}，再给{简单原因}。",
        )
    if sample_class == "twist_story":
        return (
            "先让观众以为事情很普通，再用回放、失误或隐藏原因改变理解。",
            "异常瞬间 -> 第一层误读 -> 回放揭示 -> 后果",
            "第一眼都以为是{A}，回头看{细节}，才知道真正改变比赛的是{B}。",
        )
    if sample_class == "emotional_time_story":
        return (
            "用旧事、时间差或人物关系把足球事件讲成人的故事。",
            "人物/旧事 -> 当下相遇 -> 时间差 -> 情绪回收",
            "{人物}再次遇到{旧关系/旧场景}，最戳人的不是结果，而是{一个反应}。",
        )
    if sample_class == "star_micro_story":
        return (
            "不讲履历，抓球星一个动作、手势、眼神或选择，让观众读出压力。",
            "球星动作 -> 压力来源 -> 动作含义 -> 讨论点",
            "{球星}这一小下，比进球更能说明问题，因为它暴露了{压力/状态/关系}。",
        )
    if sample_class in {"clip_commentary", "live_match_commentary"}:
        return (
            "让原声或比赛片段先承担情绪，旁白只补足观众看不懂的关键条件。",
            "现场情绪 -> 一句话补背景 -> 关键动作 -> 结果",
            "这个瞬间原声已经够满，旁白只需要告诉观众：看{动作/表情/比分变化}。",
        )
    if sample_class == "silent_or_subtitle_only":
        return (
            "声音或字幕本身承担主要信息，不适合硬塞长旁白。",
            "标题钩子 -> 原声/字幕 -> 一句解释 -> 停顿",
            "如果原声已经有情绪，宁愿少说一句，把字幕放在{关键动作}上。",
        )
    return (
        "用压缩背景带观众入场，再用一个事实或动作撑住观点。",
        "压缩背景 -> 事实锚点 -> 可见动作 -> 总结",
        "{背景}不用讲太满，先给{一个事实}，再让观众看{一个动作}。",
    )


def phase_notes(sample: dict[str, Any], segments: list[dict[str, Any]]) -> list[dict[str, str]]:
    if not segments:
        return [
            {
                "phase": "全片",
                "time": "-",
                "function": "无可用 ASR 文案",
                "learning": "这类样本更适合学习标题、字幕位置、原声氛围，不适合作为旁白模板。",
            }
        ]
    n = len(segments)
    if n < 3:
        text = "".join(item["text"] for item in segments)
        return [
            {
                "phase": "全片",
                "time": f"{timecode(segments[0]['start'])}-{timecode(segments[-1]['end'])}",
                "function": "字幕段数很少，按整片看作一个口播单元。",
                "learning": "更适合作为标题/原声/短字幕样本，不适合拆成完整三段口播。",
                "reference": safe_excerpt(text, 24),
            }
        ]
    cuts = [0, max(1, math.ceil(n * 0.25)), max(2, math.ceil(n * 0.72)), n]
    ranges = [(cuts[0], cuts[1]), (cuts[1], cuts[2]), (cuts[2], cuts[3])]
    labels = [
        ("开头", "用来决定观众是否停下。重点看它是提问、给画面，还是直接给判断。"),
        ("中段", "承接解释和证据。重点看它如何少堆资料，只保留一个能被看懂的事实。"),
        ("结尾", "负责回收情绪或制造评论。重点看它是给结论、留问题，还是开放总结。"),
    ]
    out: list[dict[str, str]] = []
    for (start_i, end_i), (phase, learning) in zip(ranges, labels):
        chunk = segments[start_i:end_i] or segments[start_i : start_i + 1]
        start = chunk[0]["start"]
        end = chunk[-1]["end"]
        out.append(
            {
                "phase": phase,
                "time": f"{timecode(start)}-{timecode(end)}",
                "function": learning,
                "reference": safe_excerpt("".join(item["text"] for item in chunk), 24),
            }
        )
    return out


def build_card(sample: dict[str, Any], number: int) -> dict[str, Any]:
    transcript_path = ROOT / sample["transcript_file"]
    payload = read_json(transcript_path)
    text = payload.get("text") or ""
    segments = sentenceish_segments(payload)
    duration = 0.0
    if segments:
        duration = max(item["end"] for item in segments)
    elif payload.get("asr"):
        duration = float((payload.get("asr") or {}).get("duration") or 0)
    strategy, structure, template = class_strategy(sample["class"])
    avg_segment_chars = round(sum(len(item["text"]) for item in segments) / len(segments), 1) if segments else 0
    tags = sample.get("tags") or []
    return {
        "number": number,
        "id": sample["id"],
        "source": sample["source"],
        "title": sample["title"],
        "url": sample_url(payload),
        "author_or_channel": sample.get("author_or_channel"),
        "char_count": sample["char_count"],
        "segment_count": len(segments),
        "duration_sec": round(duration, 1),
        "avg_segment_chars": avg_segment_chars,
        "class": sample["class"],
        "class_label": CLASS_LABELS.get(sample["class"], sample["class"]),
        "opening_shape": sample["opening_shape"],
        "opening_label": OPENING_LABELS.get(sample["opening_shape"], sample["opening_shape"]),
        "ending_shape": sample["ending_shape"],
        "ending_label": ENDING_LABELS.get(sample["ending_shape"], sample["ending_shape"]),
        "tags": tags,
        "tag_labels": [TAG_LABELS.get(tag, tag) for tag in tags],
        "learning_strategy": strategy,
        "voiceover_structure": structure,
        "transfer_template": template,
        "phase_notes": phase_notes(sample, segments),
        "short_reference_excerpt": safe_excerpt(text, 28),
        "transcript_file": sample["transcript_file"],
    }


def md_card(card: dict[str, Any]) -> str:
    transcript_abs = ROOT / card["transcript_file"]
    phase_lines = []
    for phase in card["phase_notes"]:
        reference = phase.get("reference")
        ref_text = f" 短参照：`{reference}`。" if reference else ""
        phase_lines.append(
            f"- {phase['phase']}（{phase['time']}）：{phase['function']}{ref_text}"
        )
    return "\n".join(
        [
            f"## {card['number']:03d}. {card['title'] or '无标题'}",
            "",
            f"- 来源：{card['source']} / {card['author_or_channel'] or '-'}",
            f"- URL：{card['url']}",
            f"- 本地 ASR 全文：[{card['transcript_file']}](<{transcript_abs}>)",
            f"- 字数/分段/时长：{card['char_count']} 字 / {card['segment_count']} 段 / {card['duration_sec']} 秒",
            f"- 节奏：平均每段 {card['avg_segment_chars']} 字",
            f"- 类型：`{card['class']}`（{card['class_label']}）",
            f"- 开头：`{card['opening_shape']}`（{card['opening_label']}）",
            f"- 结尾：`{card['ending_shape']}`（{card['ending_label']}）",
            f"- 标签：{', '.join(card['tag_labels']) or '-'}",
            "",
            "旁白学习：",
            "",
            f"- 主策略：{card['learning_strategy']}",
            f"- 结构骨架：{card['voiceover_structure']}",
            f"- 可迁移模板：`{card['transfer_template']}`",
            "",
            "整片分段处理：",
            "",
            *phase_lines,
            "",
            f"短参照摘录：`{card['short_reference_excerpt'] or 'ASR 为空或无明确旁白'}`",
            "",
        ]
    )


def write_source_doc(path: Path, title: str, cards: list[dict[str, Any]]) -> None:
    lines = [
        f"# {title}",
        "",
        "说明：这是“旁白学习处理文档”，不是全文转载。每条卡片都基于完整 ASR 字幕处理，完整逐字稿在对应本地 JSON 的 `text` 和 `segments` 字段。",
        "",
        f"- 样本数：{len(cards)}",
        "- 处理内容：旁白类型、开头方式、结尾方式、节奏、整片三段处理、可迁移模板。",
        "",
    ]
    for index, card in enumerate(cards, start=1):
        lines.append(md_card({**card, "number": index}))
    path.write_text("\n".join(lines), encoding="utf-8")


def write_readme(cards: list[dict[str, Any]]) -> None:
    youtube_count = sum(1 for card in cards if card["source"] == "youtube")
    xhs_count = sum(1 for card in cards if card["source"] == "xhs")
    lines = [
        "# Benchmark Voiceover Learning",
        "",
        "这套文档用于学习对标账号的旁白文案，不是简单抄录。",
        "",
        "生成结果：",
        "",
        "- [@這就是足球 YouTube Shorts 99 条旁白学习卡片](youtube-this-is-football-99-learning.md)",
        "- [小红书 16 条旁白学习卡片](xiaohongshu-16-learning.md)",
        "- [机器可读学习卡片 JSON](voiceover-learning-cards.json)",
        "",
        "样本数量：",
        "",
        f"- YouTube：{youtube_count}",
        f"- 小红书：{xhs_count}",
        f"- 总计：{len(cards)}",
        "",
        "每条卡片包含：",
        "",
        "- 视频标题与本地 ASR 全文路径",
        "- 旁白类型：问题解释、反转揭示、情绪时间线、球星微动作等",
        "- 开头/中段/结尾的整片处理",
        "- 节奏指标：字数、字幕段数、平均段长、时长",
        "- 可迁移文案模板",
        "",
    ]
    README_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = read_json(INDEX_PATH)
    cards = [build_card(sample, index + 1) for index, sample in enumerate(index["samples"])]
    youtube_cards = [card for card in cards if card["source"] == "youtube"]
    xhs_cards = [card for card in cards if card["source"] == "xhs"]
    write_source_doc(YOUTUBE_DOC_PATH, "@這就是足球 YouTube Shorts 99 条旁白学习卡片", youtube_cards)
    write_source_doc(XHS_DOC_PATH, "小红书 16 条旁白学习卡片", xhs_cards)
    CARDS_PATH.write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")
    write_readme(cards)
    print(f"wrote {README_PATH}")
    print(f"wrote {YOUTUBE_DOC_PATH} ({len(youtube_cards)} cards)")
    print(f"wrote {XHS_DOC_PATH} ({len(xhs_cards)} cards)")
    print(f"wrote {CARDS_PATH} ({len(cards)} cards)")


if __name__ == "__main__":
    main()
