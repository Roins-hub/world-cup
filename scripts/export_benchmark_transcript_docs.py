#!/usr/bin/env python3
"""Export benchmark transcript corpus docs.

The raw ASR JSON files remain the source of truth. The generated Markdown files
are a readable catalog that points every sample to its local full transcript.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "data/benchmark/football-creators/transcript-index.json"
DOC_DIR = ROOT / "docs/benchmark-transcripts"
README_PATH = DOC_DIR / "README.md"
YOUTUBE_DOC_PATH = DOC_DIR / "youtube-this-is-football-99.md"
XHS_DOC_PATH = DOC_DIR / "xiaohongshu-16.md"
MANIFEST_PATH = DOC_DIR / "transcript-manifest.json"


def read_index() -> dict[str, Any]:
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def clean(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, list):
        return ", ".join(str(item) for item in value) or "-"
    return str(value).replace("\n", " ").strip() or "-"


def read_transcript_text(sample: dict[str, Any]) -> str:
    path = ROOT / sample["transcript_file"]
    if not path.exists():
        return ""
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload.get("text") or ""


def short_excerpt(text: str, limit: int = 90) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


def sample_block(index: int, sample: dict[str, Any]) -> str:
    text = read_transcript_text(sample)
    path = ROOT / sample["transcript_file"]
    source_url = "-"
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        metadata = payload.get("metadata") or {}
        source_url = metadata.get("url") or metadata.get("video_url") or sample.get("url") or "-"
    return "\n".join(
        [
            f"## {index:03d}. {clean(sample['title'])}",
            "",
            f"- 来源：{sample['source']}",
            f"- 作者/频道：{clean(sample.get('author_or_channel'))}",
            f"- 视频 ID：`{sample['id']}`",
            f"- URL：{source_url}",
            f"- 字数：{sample['char_count']}",
            f"- 分类：`{sample['class']}`",
            f"- 开头形态：`{sample['opening_shape']}`",
            f"- 结尾形态：`{sample['ending_shape']}`",
            f"- 标签：{clean(sample.get('tags'))}",
            f"- 本地全文转写：[{sample['transcript_file']}](<{ROOT / sample['transcript_file']}>)",
            "",
            "摘录：",
            "",
            f"> {short_excerpt(text) if text else 'ASR 为空或视频无明确旁白。'}",
            "",
        ]
    )


def write_source_doc(path: Path, title: str, samples: list[dict[str, Any]]) -> None:
    lines = [
        f"# {title}",
        "",
        "说明：本文件是样本文案目录。每条样本都指向本地 ASR JSON，JSON 内 `text` 是全文合并文案，`segments` 是带时间戳的字幕分段。",
        "",
        f"- 样本数：{len(samples)}",
        "- 生成脚本：`scripts/export_benchmark_transcript_docs.py`",
        "- 索引来源：`data/benchmark/football-creators/transcript-index.json`",
        "",
    ]
    for index, sample in enumerate(samples, start=1):
        lines.append(sample_block(index, sample))
    path.write_text("\n".join(lines), encoding="utf-8")


def write_readme(index: dict[str, Any]) -> None:
    summary = index.get("summary") or {}
    lines = [
        "# Benchmark Transcript Docs",
        "",
        "这里落地的是已采集足球短视频样本的字幕/旁白文案目录。",
        "",
        "完整文案不靠口头总结，全部以本地 ASR JSON 为准：",
        "",
        "- `data/benchmark/football-creators/youtube/transcripts/`：YouTube 对标账号逐条转写。",
        "- `data/benchmark/football-creators/xhs/transcripts/`：小红书样本逐条转写。",
        "- `text` 字段：整条合并文案。",
        "- `segments` 字段：带 `start/end/text` 的字幕分段。",
        "",
        "已生成文档：",
        "",
        "- [@這就是足球 YouTube Shorts 99 条](youtube-this-is-football-99.md)",
        "- [小红书足球样本 16 条](xiaohongshu-16.md)",
        "- [机器可读 manifest](transcript-manifest.json)",
        "",
        "当前统计：",
        "",
    ]
    for source in ("youtube", "xhs"):
        item = summary.get(source) or {}
        lines.extend(
            [
                f"## {source}",
                "",
                f"- 样本数：{item.get('count', 0)}",
                f"- 中位字数：{item.get('median_chars', 0)}",
                f"- 分类分布：{json.dumps(item.get('classes', {}), ensure_ascii=False)}",
                f"- 开头分布：{json.dumps(item.get('opening', {}), ensure_ascii=False)}",
                f"- 结尾分布：{json.dumps(item.get('ending', {}), ensure_ascii=False)}",
                "",
            ]
        )
    README_PATH.write_text("\n".join(lines), encoding="utf-8")


def write_manifest(samples: list[dict[str, Any]]) -> None:
    payload = []
    for sample in samples:
        text = read_transcript_text(sample)
        path = ROOT / sample["transcript_file"]
        metadata: dict[str, Any] = {}
        if path.exists():
            metadata = json.loads(path.read_text(encoding="utf-8")).get("metadata") or {}
        payload.append(
            {
                "id": sample["id"],
                "source": sample["source"],
                "title": sample["title"],
                "author_or_channel": sample.get("author_or_channel"),
                "url": metadata.get("url") or metadata.get("video_url"),
                "char_count": sample["char_count"],
                "class": sample["class"],
                "opening_shape": sample["opening_shape"],
                "ending_shape": sample["ending_shape"],
                "tags": sample.get("tags") or [],
                "transcript_file": sample["transcript_file"],
                "has_text": bool(text),
                "text_excerpt": short_excerpt(text, 70) if text else "",
            }
        )
    MANIFEST_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    DOC_DIR.mkdir(parents=True, exist_ok=True)
    index = read_index()
    samples = index["samples"]
    youtube_samples = [sample for sample in samples if sample["source"] == "youtube"]
    xhs_samples = [sample for sample in samples if sample["source"] == "xhs"]
    write_source_doc(YOUTUBE_DOC_PATH, "@這就是足球 YouTube Shorts 字幕文案目录", youtube_samples)
    write_source_doc(XHS_DOC_PATH, "小红书足球样本字幕文案目录", xhs_samples)
    write_manifest(samples)
    write_readme(index)
    print(f"wrote {README_PATH}")
    print(f"wrote {YOUTUBE_DOC_PATH} ({len(youtube_samples)} samples)")
    print(f"wrote {XHS_DOC_PATH} ({len(xhs_samples)} samples)")
    print(f"wrote {MANIFEST_PATH} ({len(samples)} samples)")


if __name__ == "__main__":
    main()
