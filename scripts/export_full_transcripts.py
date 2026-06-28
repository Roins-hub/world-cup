#!/usr/bin/env python3
"""Export full local transcript files from benchmark ASR JSON.

Outputs one complete TXT and one complete SRT per video. The ASR JSON remains
the source of truth, but these files are easier to read, search, and use in
downstream script-learning workflows.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "data/benchmark/football-creators/transcript-index.json"
OUT_ROOT = ROOT / "docs/benchmark-full-transcripts"
MANIFEST_PATH = OUT_ROOT / "full-transcript-manifest.json"
README_PATH = OUT_ROOT / "README.md"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def safe_name(value: str, limit: int = 70) -> str:
    value = re.sub(r"[\\/:*?\"<>|#\n\r\t]+", " ", value or "").strip()
    value = re.sub(r"\s+", "-", value)
    return (value[:limit].strip("-") or "untitled")


def timecode_srt(seconds: float) -> str:
    seconds = max(0.0, seconds)
    whole_ms = int(round(seconds * 1000))
    ms = whole_ms % 1000
    total_seconds = whole_ms // 1000
    sec = total_seconds % 60
    minutes = (total_seconds // 60) % 60
    hours = total_seconds // 3600
    return f"{hours:02d}:{minutes:02d}:{sec:02d},{ms:03d}"


def compact_text(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def source_url(payload: dict[str, Any]) -> str:
    metadata = payload.get("metadata") or {}
    return metadata.get("url") or metadata.get("video_url") or "-"


def text_segments(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for segment in payload.get("segments") or []:
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


def write_srt(path: Path, segments: list[dict[str, Any]]) -> None:
    blocks = []
    for index, segment in enumerate(segments, start=1):
        blocks.append(
            "\n".join(
                [
                    str(index),
                    f"{timecode_srt(segment['start'])} --> {timecode_srt(segment['end'])}",
                    segment["text"],
                ]
            )
        )
    path.write_text("\n\n".join(blocks) + ("\n" if blocks else ""), encoding="utf-8")


def write_txt(path: Path, sample: dict[str, Any], payload: dict[str, Any], segments: list[dict[str, Any]]) -> None:
    metadata = payload.get("metadata") or {}
    text = payload.get("text") or "".join(segment["text"] for segment in segments)
    lines = [
        f"标题: {sample.get('title') or metadata.get('title') or ''}",
        f"来源: {sample['source']}",
        f"作者/频道: {sample.get('author_or_channel') or metadata.get('channel') or metadata.get('author') or ''}",
        f"URL: {source_url(payload)}",
        f"本地 ASR JSON: {ROOT / sample['transcript_file']}",
        f"分类: {sample.get('class')}",
        f"开头形态: {sample.get('opening_shape')}",
        f"结尾形态: {sample.get('ending_shape')}",
        f"标签: {', '.join(sample.get('tags') or [])}",
        f"字数: {len(text)}",
        f"字幕段数: {len(segments)}",
        "",
        "完整合并旁白:",
        text or "[ASR 为空或视频无明确旁白]",
        "",
        "完整时间轴字幕:",
    ]
    for index, segment in enumerate(segments, start=1):
        lines.append(
            f"{index:03d} {timecode_srt(segment['start'])} --> {timecode_srt(segment['end'])} {segment['text']}"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def export_sample(sample: dict[str, Any], source_index: int) -> dict[str, Any]:
    asr_path = ROOT / sample["transcript_file"]
    payload = read_json(asr_path)
    segments = text_segments(payload)
    metadata = payload.get("metadata") or {}
    title = sample.get("title") or metadata.get("title") or ""
    base = f"{source_index:03d}-{sample['id'].split('-', 1)[-1]}-{safe_name(title, 42)}"
    source_dir = OUT_ROOT / sample["source"]
    txt_dir = source_dir / "txt"
    srt_dir = source_dir / "srt"
    txt_dir.mkdir(parents=True, exist_ok=True)
    srt_dir.mkdir(parents=True, exist_ok=True)
    txt_path = txt_dir / f"{base}.txt"
    srt_path = srt_dir / f"{base}.srt"
    write_txt(txt_path, sample, payload, segments)
    write_srt(srt_path, segments)
    full_text = payload.get("text") or "".join(segment["text"] for segment in segments)
    return {
        "source": sample["source"],
        "source_index": source_index,
        "id": sample["id"],
        "title": title,
        "url": source_url(payload),
        "asr_json": sample["transcript_file"],
        "txt": str(txt_path.relative_to(ROOT)),
        "srt": str(srt_path.relative_to(ROOT)),
        "char_count": len(full_text),
        "segment_count": len(segments),
        "has_text": bool(full_text),
    }


def write_readme(manifest: list[dict[str, Any]]) -> None:
    youtube = [item for item in manifest if item["source"] == "youtube"]
    xhs = [item for item in manifest if item["source"] == "xhs"]
    lines = [
        "# Benchmark Full Transcripts",
        "",
        "这里是已采集样本的完整本地字幕/旁白导出。",
        "",
        "每条视频都导出两份文件：",
        "",
        "- `txt`：包含标题、来源、完整合并旁白、完整时间轴字幕。",
        "- `srt`：标准字幕文件，保留每段时间码。",
        "",
        "统计：",
        "",
        f"- YouTube `@這就是足球`：{len(youtube)} 条，{sum(item['segment_count'] for item in youtube)} 个字幕段。",
        f"- 小红书：{len(xhs)} 条，{sum(item['segment_count'] for item in xhs)} 个字幕段。",
        f"- 总计：{len(manifest)} 条，{sum(item['segment_count'] for item in manifest)} 个字幕段。",
        "",
        "目录：",
        "",
        "- YouTube TXT：`docs/benchmark-full-transcripts/youtube/txt/`",
        "- YouTube SRT：`docs/benchmark-full-transcripts/youtube/srt/`",
        "- 小红书 TXT：`docs/benchmark-full-transcripts/xhs/txt/`",
        "- 小红书 SRT：`docs/benchmark-full-transcripts/xhs/srt/`",
        "- 清单：`docs/benchmark-full-transcripts/full-transcript-manifest.json`",
        "",
    ]
    README_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    index = read_json(INDEX_PATH)
    manifest = []
    source_counters = {"youtube": 0, "xhs": 0}
    for sample in index["samples"]:
        source = sample["source"]
        source_counters[source] += 1
        manifest.append(export_sample(sample, source_counters[source]))
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    write_readme(manifest)
    print(f"wrote {README_PATH}")
    print(f"wrote {MANIFEST_PATH}")
    print(json.dumps({
        "videos": len(manifest),
        "youtube": source_counters["youtube"],
        "xhs": source_counters["xhs"],
        "segments": sum(item["segment_count"] for item in manifest),
        "empty_text": [item["id"] for item in manifest if not item["has_text"]],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
