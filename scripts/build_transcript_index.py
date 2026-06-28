#!/usr/bin/env python3
"""Build a lightweight, reproducible index from benchmark ASR transcripts."""

from __future__ import annotations

import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BENCHMARK_ROOT = ROOT / "data/benchmark/football-creators"
TRANSCRIPT_DIRS = {
    "youtube": BENCHMARK_ROOT / "youtube/transcripts",
    "xhs": BENCHMARK_ROOT / "xhs/transcripts",
}
OUT_PATH = BENCHMARK_ROOT / "transcript-index.json"


STAR_RE = re.compile(
    r"梅西|C罗|Cristiano|Ronaldo|Messi|姆巴佩|Mbappe|Mbapp|哈兰德|Haaland|内马尔|Neymar|亚马尔|Yamal|C羅|羅納爾多",
    re.I,
)
REPLAY_RE = re.compile(r"回放|慢镜|慢動作|第一眼|看错|看錯|才发现|才發現|原来|原來|反转|反轉|镜头|鏡頭")
MISTAKE_RE = re.compile(r"失误|失誤|犯错|犯錯|离谱|離譜|乌龙|烏龍|红牌|紅牌|点球|點球|VAR|争议|爭議|摔|滑")
QUESTION_RE = re.compile(r"为什么|為什麼|怎么|怎麼|到底|吗|嗎|？|\?")
LIVE_RE = re.compile(r"进球|進球|射门|射門|扑救|撲救|解说|解說|原声|原聲|欢呼|歡呼|全场|全場|现场|現場")
DATA_RE = re.compile(r"\d|第[一二三四五六七八九十]|排名|身价|身價|纪录|紀錄|分钟|分鐘|岁|歲|万|萬|亿|億")
TIME_RE = re.compile(r"\d{2,4}年|最後|最后|第[一二三四五六七八九十].*届|屆|分钟|分鐘|秒")
COMMENT_RE = re.compile(r"你觉得|你覺得|你会|你會|评论区|評論區|谁|誰|吗|嗎|？|\?")


def transcript_id(path: Path) -> str:
    stem = path.stem
    return stem.split("-", 1)[1] if "-" in stem else stem


def read_unique_transcripts(source: str) -> list[dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for path in sorted(TRANSCRIPT_DIRS[source].glob("*.json")):
        if path.name.endswith(".error.json"):
            continue
        video_id = transcript_id(path)
        if video_id in rows:
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        rows[video_id] = {
            "path": path,
            "payload": payload,
        }
    return list(rows.values())


def tags_for(text: str, title: str) -> list[str]:
    combined = f"{title}\n{text}"
    tags: list[str] = []
    if STAR_RE.search(combined):
        tags.append("star")
    if TIME_RE.search(combined):
        tags.append("time_payoff")
    if REPLAY_RE.search(combined):
        tags.append("replay_reveal")
    if MISTAKE_RE.search(combined):
        tags.append("mistake")
    if QUESTION_RE.search(title[:80]) or QUESTION_RE.search(text[:80]):
        tags.append("question_hook")
    if LIVE_RE.search(combined):
        tags.append("live_energy")
    if COMMENT_RE.search(text[-120:]):
        tags.append("comment_hook")
    if DATA_RE.search(combined):
        tags.append("data_or_ranking")
    return tags


def classify(text: str, title: str, source: str, tags: list[str]) -> str:
    if len(text) < 40:
        return "silent_or_subtitle_only"
    if source == "xhs" and "live_energy" in tags and len(text) < 420:
        return "live_match_commentary"
    if "question_hook" in tags and ("data_or_ranking" in tags or QUESTION_RE.search(title)):
        return "question_explainer"
    if "replay_reveal" in tags or "mistake" in tags:
        return "twist_story"
    if "star" in tags and "time_payoff" in tags:
        return "emotional_time_story"
    if "star" in tags:
        return "star_micro_story"
    if "live_energy" in tags:
        return "clip_commentary"
    return "general_narrative"


def opening_shape(text: str, title: str, tags: list[str]) -> str:
    head = f"{title} {text[:90]}"
    if len(text) < 40:
        return "no_spoken_hook"
    if QUESTION_RE.search(head):
        return "direct_question"
    if re.search(r"这个|這個|这次|這次|这一|這一|先看|看完|门将|門將|裁判|球迷|进球|進球|失误|失誤", head):
        return "start_from_visible_moment"
    if "live_energy" in tags:
        return "live_action_entry"
    if re.search(r"最|第一|不是|不是.*而是|才是|所有人|没人|沒人", head):
        return "value_or_attitude_claim"
    return "compressed_context_entry"


def ending_shape(text: str, tags: list[str]) -> str:
    tail = text[-120:]
    if len(text) < 40:
        return "none"
    if COMMENT_RE.search(tail):
        return "question_or_debate"
    if re.search(r"爱|愛|哭|泪|淚|温暖|溫暖|梦|夢|最后|最後|告别|告別|青春|身边|身邊", tail):
        return "emotional_payoff"
    if DATA_RE.search(tail) or re.search(r"所以|因此|答案|结果|結果", tail):
        return "fact_payoff"
    return "open_loop_or_summary"


def summarize(samples: list[dict[str, Any]]) -> dict[str, Any]:
    by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for sample in samples:
        by_source[sample["source"]].append(sample)
    summary: dict[str, Any] = {}
    for source, rows in by_source.items():
        tag_counter: Counter[str] = Counter()
        for row in rows:
            tag_counter.update(row["tags"])
        char_counts = [row["char_count"] for row in rows]
        summary[source] = {
            "count": len(rows),
            "classes": dict(Counter(row["class"] for row in rows)),
            "opening": dict(Counter(row["opening_shape"] for row in rows)),
            "ending": dict(Counter(row["ending_shape"] for row in rows)),
            "median_chars": statistics.median(char_counts) if char_counts else 0,
            "tags": dict(tag_counter),
        }
    return summary


def main() -> None:
    samples: list[dict[str, Any]] = []
    for source in ("youtube", "xhs"):
        for row in read_unique_transcripts(source):
            payload = row["payload"]
            metadata = payload.get("metadata") or {}
            text = payload.get("text") or ""
            title = metadata.get("title") or ""
            item_tags = tags_for(text, title)
            sample_class = classify(text, title, source, item_tags)
            path = row["path"]
            samples.append(
                {
                    "id": path.stem,
                    "source": source,
                    "title": title,
                    "author_or_channel": metadata.get("channel") or metadata.get("author"),
                    "views": metadata.get("view_count"),
                    "likes": metadata.get("like_count") or metadata.get("likes"),
                    "comments": metadata.get("comments"),
                    "duration": metadata.get("duration"),
                    "char_count": len(text),
                    "class": sample_class,
                    "opening_shape": opening_shape(text, title, item_tags),
                    "ending_shape": ending_shape(text, item_tags),
                    "tags": item_tags,
                    "transcript_file": str(path.relative_to(ROOT)),
                }
            )
    samples.sort(key=lambda item: (item["source"], item["id"]))
    OUT_PATH.write_text(
        json.dumps({"samples": samples, "summary": summarize(samples)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"wrote {OUT_PATH} with {len(samples)} unique transcripts")


if __name__ == "__main__":
    main()
