#!/usr/bin/env python3
"""Download benchmark audio and transcribe it with faster-whisper.

This script is intentionally boring: it only creates evidence for later
copywriting analysis. It does not infer style or generate new script rules.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
YT_RAW = ROOT / "data/benchmark/football-creators/youtube/this-is-football-raw.jsonl"
YT_AUDIO = ROOT / "data/benchmark/football-creators/youtube/audio"
YT_TRANSCRIPTS = ROOT / "data/benchmark/football-creators/youtube/transcripts"
XHS_DETAILS = ROOT / "data/benchmark/football-creators/xhs/details"
XHS_AUDIO = ROOT / "data/benchmark/football-creators/xhs/audio"
XHS_TRANSCRIPTS = ROOT / "data/benchmark/football-creators/xhs/transcripts"


def read_youtube_rows(limit: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with YT_RAW.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            item = json.loads(line)
            if not item.get("id") or not item.get("webpage_url"):
                continue
            rows.append(
                {
                    "id": item["id"],
                    "title": item.get("title"),
                    "url": item.get("webpage_url"),
                    "duration": item.get("duration"),
                    "view_count": item.get("view_count"),
                    "like_count": item.get("like_count"),
                    "channel": item.get("channel"),
                }
            )
    rows.sort(key=lambda row: row.get("view_count") or 0, reverse=True)
    return rows[:limit]


def read_xhs_rows(limit: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in sorted(XHS_DETAILS.glob("*.json")):
        item = json.loads(path.read_text(encoding="utf-8"))
        videos = item.get("videos") or []
        if not videos:
            continue
        rows.append(
            {
                "id": path.stem,
                "title": item.get("title"),
                "url": item.get("url"),
                "video_url": videos[0],
                "likes": item.get("likes") or 0,
                "comments": item.get("comments") or 0,
                "author": item.get("author"),
                "content": item.get("content"),
                "tags": item.get("tags") or [],
            }
        )
    rows.sort(key=lambda row: (row.get("likes") or 0, row.get("comments") or 0), reverse=True)
    return rows[:limit]


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def existing_transcript_ids(transcript_dir: Path) -> set[str]:
    ids: set[str] = set()
    for path in transcript_dir.glob("*.json"):
        if path.name.endswith(".error.json"):
            continue
        ids.add(path.stem.split("-", 1)[1] if "-" in path.stem else path.stem)
    return ids


def download_audio(row: dict[str, Any]) -> Path:
    YT_AUDIO.mkdir(parents=True, exist_ok=True)
    audio_path = YT_AUDIO / f"{row['id']}.wav"
    if audio_path.exists() and audio_path.stat().st_size > 0:
        return audio_path
    output = str(YT_AUDIO / f"{row['id']}.%(ext)s")
    run(
        [
            "yt-dlp",
            "-f",
            "ba/bestaudio/18/best",
            "-x",
            "--audio-format",
            "wav",
            "--audio-quality",
            "0",
            "--no-playlist",
            "-o",
            output,
            row["url"],
        ]
    )
    return audio_path


def download_xhs_audio(row: dict[str, Any]) -> Path:
    XHS_AUDIO.mkdir(parents=True, exist_ok=True)
    audio_path = XHS_AUDIO / f"{row['id']}.wav"
    if audio_path.exists() and audio_path.stat().st_size > 0:
        return audio_path
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            row["video_url"],
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            str(audio_path),
        ]
    )
    return audio_path


def transcribe(rows: list[dict[str, Any]], model_name: str, source: str) -> None:
    from faster_whisper import WhisperModel

    transcript_dir = YT_TRANSCRIPTS if source == "youtube" else XHS_TRANSCRIPTS
    transcript_dir.mkdir(parents=True, exist_ok=True)
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    completed_ids = existing_transcript_ids(transcript_dir)
    for index, row in enumerate(rows, start=1):
        if row["id"] in completed_ids:
            print(f"skip existing transcript id: {row['id']}")
            continue
        out_path = transcript_dir / f"{index:03d}-{row['id']}.json"
        print(f"[{index}/{len(rows)}] download {row['id']} {row['title']}")
        try:
            audio_path = download_audio(row) if source == "youtube" else download_xhs_audio(row)
        except subprocess.CalledProcessError as exc:
            error_path = transcript_dir / f"{index:03d}-{row['id']}.error.json"
            error_path.write_text(
                json.dumps(
                    {
                        "source": source,
                        "metadata": row,
                        "stage": "download",
                        "returncode": exc.returncode,
                        "cmd": exc.cmd,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
            print(f"download failed, wrote {error_path.name}")
            continue
        print(f"[{index}/{len(rows)}] transcribe {audio_path.name}")
        try:
            segments, info = model.transcribe(
                str(audio_path),
                language="zh",
                vad_filter=True,
                beam_size=5,
                word_timestamps=False,
            )
        except Exception as exc:
            error_path = transcript_dir / f"{index:03d}-{row['id']}.error.json"
            error_path.write_text(
                json.dumps(
                    {
                        "source": source,
                        "metadata": row,
                        "stage": "transcribe",
                        "error": repr(exc),
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
            print(f"transcribe failed, wrote {error_path.name}")
            continue
        segment_rows = [
            {
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": segment.text.strip(),
            }
            for segment in segments
            if segment.text.strip()
        ]
        payload = {
            "source": source,
            "metadata": row,
            "asr": {
                "model": model_name,
                "language": info.language,
                "language_probability": info.language_probability,
                "duration": info.duration,
            },
            "text": "".join(segment["text"] for segment in segment_rows),
            "segments": segment_rows,
        }
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        completed_ids.add(row["id"])
        print(f"wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["youtube", "xhs"], default="youtube")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--model", default="small")
    args = parser.parse_args()
    rows = read_youtube_rows(args.limit) if args.source == "youtube" else read_xhs_rows(args.limit)
    if not rows:
        source_path = YT_RAW if args.source == "youtube" else XHS_DETAILS
        raise SystemExit(f"No {args.source} rows found at {source_path}")
    transcribe(rows, args.model, args.source)


if __name__ == "__main__":
    main()
