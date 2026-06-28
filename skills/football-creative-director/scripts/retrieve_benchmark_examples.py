#!/usr/bin/env python3
"""Retrieve benchmark football voiceover neighbors for a creative target.

The script returns compact learning references, not long transcript copies.
It reads the local full-transcript manifest, learning cards, and ASR payloads
from the world-cup workspace.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


DEFAULT_WORKSPACE = Path("/Users/airhua/Documents/world-cup")

CLASS_HINTS = {
    "question_explainer": ["为什么", "怎么", "规则", "越位", "VAR", "裁判", "战术", "原因", "看不懂"],
    "twist_story": ["回放", "慢镜头", "第一眼", "看错", "失误", "反转", "离谱", "误会"],
    "emotional_time_story": ["旧事", "时间", "重逢", "朋友", "父亲", "孩子", "告别", "最后一舞"],
    "star_micro_story": ["C罗", "梅西", "姆巴佩", "哈兰德", "内马尔", "亚马尔", "动作", "眼神", "助跑"],
    "live_match_commentary": ["原声", "解说", "进球", "现场", "欢呼", "高能"],
    "clip_commentary": ["片段", "高光", "进球", "扑救", "射门"],
    "silent_or_subtitle_only": ["字幕", "无旁白", "原声", "表情包"],
    "general_narrative": ["前瞻", "故事", "球队", "世界杯"],
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def words(text: str) -> list[str]:
    text = text.lower()
    ascii_words = re.findall(r"[a-z0-9_]+", text)
    cjk = re.findall(r"[\u4e00-\u9fffA-Za-z0-9·]+", text)
    grams: list[str] = []
    for item in cjk:
        if len(item) <= 2:
            grams.append(item)
            continue
        grams.extend(item[i : i + 2] for i in range(len(item) - 1))
        grams.extend(item[i : i + 3] for i in range(max(0, len(item) - 2)))
    return [token for token in set(ascii_words + grams + cjk) if len(token) >= 2]


def load_payload(workspace: Path, card: dict[str, Any]) -> dict[str, Any]:
    path = workspace / card.get("transcript_file", "")
    if not path.exists():
        return {}
    try:
        return read_json(path)
    except Exception:
        return {}


def manifest_by_key(workspace: Path) -> dict[tuple[str, str], dict[str, Any]]:
    path = workspace / "docs/benchmark-full-transcripts/full-transcript-manifest.json"
    if not path.exists():
        return {}
    rows = read_json(path)
    return {(row.get("source", ""), row.get("id", "")): row for row in rows}


def class_boost(query: str, sample_class: str) -> int:
    return sum(4 for hint in CLASS_HINTS.get(sample_class, []) if hint.lower() in query.lower())


def score_card(query: str, tokens: list[str], card: dict[str, Any], payload: dict[str, Any]) -> tuple[int, list[str]]:
    title = card.get("title", "")
    text = payload.get("text") or ""
    tags = " ".join(card.get("tags") or [])
    hay_title = compact(title).lower()
    hay_meta = compact(" ".join([title, card.get("class", ""), card.get("opening_shape", ""), tags])).lower()
    hay_text = compact(text).lower()
    score = 0
    reasons: list[str] = []

    for token in tokens:
        t = token.lower()
        if t in hay_title:
            score += 12
            reasons.append(f"title:{token}")
        elif t in hay_meta:
            score += 6
            reasons.append(f"meta:{token}")
        elif t in hay_text:
            score += 3
            reasons.append(f"text:{token}")

    boost = class_boost(query, card.get("class", ""))
    if boost:
        score += boost
        reasons.append(f"class:{card.get('class')}")

    if card.get("source") == "youtube":
        score += 2
    if card.get("source") == "xhs" and re.search(r"小红书|原声|解说|高光|字幕", query):
        score += 5
    if card.get("char_count", 0) < 40 and "字幕" not in query and "原声" not in query:
        score -= 6

    return score, reasons[:8]


def build_reference(card: dict[str, Any], payload: dict[str, Any], manifest: dict[tuple[str, str], dict[str, Any]], score: int, reasons: list[str]) -> dict[str, Any]:
    full = manifest.get((card.get("source", ""), card.get("id", "")), {})
    return {
        "id": card.get("id"),
        "source": card.get("source"),
        "title": card.get("title"),
        "url": card.get("url") or (payload.get("metadata") or {}).get("url"),
        "score": score,
        "matchReasons": reasons,
        "class": card.get("class"),
        "classLabel": card.get("class_label"),
        "openingShape": card.get("opening_shape"),
        "endingShape": card.get("ending_shape"),
        "tags": card.get("tags") or [],
        "charCount": card.get("char_count"),
        "segmentCount": card.get("segment_count"),
        "durationSec": card.get("duration_sec"),
        "learningStrategy": card.get("learning_strategy"),
        "voiceoverStructure": card.get("voiceover_structure"),
        "transferTemplate": card.get("transfer_template"),
        "phaseNotes": card.get("phase_notes", [])[:3],
        "shortReferenceExcerpt": card.get("short_reference_excerpt"),
        "fullTranscriptTxt": full.get("txt"),
        "fullTranscriptSrt": full.get("srt"),
        "asrJson": card.get("transcript_file"),
    }


def summarize(matches: list[dict[str, Any]]) -> dict[str, Any]:
    classes: dict[str, int] = {}
    openings: dict[str, int] = {}
    for item in matches:
        classes[item["class"]] = classes.get(item["class"], 0) + 1
        openings[item["openingShape"]] = openings.get(item["openingShape"], 0) + 1
    return {
        "classes": classes,
        "openings": openings,
        "recommendedEngines": [key for key, _ in sorted(classes.items(), key=lambda pair: pair[1], reverse=True)[:3]],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", default=str(DEFAULT_WORKSPACE))
    parser.add_argument("--query", required=True)
    parser.add_argument("--limit", type=int, default=6)
    parser.add_argument("--source", choices=["youtube", "xhs", "all"], default="all")
    args = parser.parse_args()

    workspace = Path(args.workspace).expanduser().resolve()
    cards_path = workspace / "docs/benchmark-voiceover-learning/voiceover-learning-cards.json"
    cards = read_json(cards_path)
    manifest = manifest_by_key(workspace)
    tokens = words(args.query)
    ranked = []
    for card in cards:
        if args.source != "all" and card.get("source") != args.source:
            continue
        payload = load_payload(workspace, card)
        score, reasons = score_card(args.query, tokens, card, payload)
        if score <= 0:
            continue
        ranked.append((score, card, payload, reasons))
    ranked.sort(key=lambda row: row[0], reverse=True)
    matches = [build_reference(card, payload, manifest, score, reasons) for score, card, payload, reasons in ranked[: args.limit]]
    result = {
        "query": args.query,
        "workspace": str(workspace),
        "tokenCount": len(tokens),
        "matchCount": len(matches),
        "matches": matches,
        "styleSummary": summarize(matches),
        "usage": "Use mechanisms and phase notes as style transfer. Do not copy long benchmark transcript text.",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
