#!/usr/bin/env python3
"""Score football short-video copy against benchmark/director rules."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


BANNED_TERMS = [
    "我先押一个",
    "前20分钟",
    "前 20 分钟",
    "谁先急",
    "撑过20分钟",
    "撑过前 20 分钟",
    "更重要的是",
    "更关键的是",
    "更要命的是",
    "最要命的是",
    "真正的问题在于",
    "真正可怕的是",
    "真正值得警惕的是",
    "问题的核心在于",
    "说到底",
    "归根结底",
    "本质上",
    "深层原因是",
    "从根本上说",
    "更深一层看",
    "换句话说",
    "进一步说",
    "值得关注",
    "具有重要意义",
    "整体来看",
    "提供参考",
]

EDITOR_LEAK_RE = re.compile(r"素材|剪辑|剪出来|画面怎么放|先放|切到|字幕|封面|发布平台|这条视频|对标账号|旁白|脚本")
FORMULA_RE = re.compile(r"不是[^。！？\n\r]{0,28}而是|不是[^。！？\n\r]{0,20}[，,、]\s*是|不仅[^。！？\n\r]{0,28}而且")
HOOK_RE = re.compile(r"为什么|怎么|先别|所有人|没人|回放|慢镜头|第一眼|看错|动作|眼神|压力|爆冷|零封|一战成名|最后一舞|？|\?")
PROOF_RE = re.compile(r"回放|慢镜头|表情|眼神|助跑|扑救|射门|比分|看台|庆祝|裁判|门将|反击|摊手|背影|原声|队徽|发布会")
FACT_RE = re.compile(r"\d|第[一二三四五六七八九十]|分钟|岁|纪录|帽子戏法|点球|VAR|红牌|任意球|决赛|排名|身价|世界杯")
COMMENT_RE = re.compile(r"你觉得|你会|评论区|该不该|算不算|哪边|谁|？|\?")


def load_pack(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    return json.loads(Path(path).read_text(encoding="utf-8"))


def split_sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"[。！？!?；;\n\r]+", text) if part.strip()]


def check(id_: str, label: str, passed: bool, severity: str, detail: str) -> dict[str, Any]:
    return {"id": id_, "label": label, "passed": passed, "severity": severity, "detail": detail}


def pack_fields(pack: dict[str, Any], voiceover_arg: str, visual_arg: str, title_arg: str, mode_arg: str) -> tuple[str, str, str, str, dict[str, Any]]:
    script = pack.get("script") or []
    voiceover = voiceover_arg or "\n".join(str(beat.get("voiceover", "")) for beat in script)
    visual = visual_arg or "\n".join(str(beat.get("visualInstruction", "")) for beat in script)
    title = title_arg or pack.get("title") or (pack.get("topic") or {}).get("title") or ""
    mode = mode_arg or (pack.get("topic") or {}).get("narrationMode") or "narrative_voiceover"
    return voiceover, visual, title, mode, pack.get("topic") or {}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pack")
    parser.add_argument("--voiceover", default="")
    parser.add_argument("--visual-plan", default="")
    parser.add_argument("--title", default="")
    parser.add_argument("--mode", default="")
    parser.add_argument("--json-stdin", action="store_true")
    args = parser.parse_args()

    if args.json_stdin:
        pack = json.load(sys.stdin)
    else:
        pack = load_pack(args.pack)
    voiceover, visual, title, mode, topic = pack_fields(pack, args.voiceover, args.visual_plan, args.title, args.mode)
    sentences = split_sentences(voiceover)
    first = sentences[0] if sentences else ""
    last = sentences[-1] if sentences else ""
    banned = next((term for term in BANNED_TERMS if term in voiceover), "")
    max_sentence = max((len(sentence) for sentence in sentences), default=0)
    word_count = len(re.sub(r"\s+", "", voiceover))
    expected_min = 40 if mode == "subtitle_first" else 80 if mode == "commentary_assisted" else 140
    expected_max = 420 if mode == "narrative_voiceover" else 220
    has_engine = bool(topic.get("styleEngineLabel") and topic.get("evidenceType") and topic.get("narrationMode"))
    has_benchmark_refs = bool(pack.get("benchmarkRefs") or topic.get("benchmarkRefs") or topic.get("styleEngineLabel"))
    needs_original = mode in {"commentary_assisted", "subtitle_first"}
    original_audio_plan = bool(re.search(r"原声|现场声|解说|收声|压低|保留", visual))

    checks = [
        check("voiceover-length", "旁白长度适配模式", expected_min <= word_count <= expected_max, "blocker", f"{word_count} chars for {mode}; expected {expected_min}-{expected_max}."),
        check("no-editor-leak", "旁白不泄漏剪辑思路", not EDITOR_LEAK_RE.search(voiceover), "blocker", "ok" if not EDITOR_LEAK_RE.search(voiceover) else "voiceover contains editing words."),
        check("no-ai-crutch", "无 AI 连接词/模板句", not banned and not FORMULA_RE.search(voiceover), "blocker", banned or ("formula" if FORMULA_RE.search(voiceover) else "ok")),
        check("opening-hook", "开头能停住人", len(first) <= 70 and bool(HOOK_RE.search(first + title)), "warning", first),
        check("visible-proof", "有可见证据", bool(PROOF_RE.search(voiceover + visual + title)), "warning", "proof words present" if PROOF_RE.search(voiceover + visual + title) else "missing visible proof words"),
        check("fact-anchor", "有一个事实锚点", bool(FACT_RE.search(voiceover + title)), "warning", "fact anchor present" if FACT_RE.search(voiceover + title) else "missing concrete fact"),
        check("comment-or-payoff", "结尾有余味或站队", bool(COMMENT_RE.search(last) or re.search(r"留下|记住|改写|背锅|封神|一战成名|告别", last)), "warning", last),
        check("subtitle-readable", "字幕句长可读", max_sentence <= 34, "warning", f"max sentence chars={max_sentence}"),
        check("benchmark-engine", "有样本引擎/证据类型", has_engine and has_benchmark_refs, "blocker", json.dumps({k: topic.get(k) for k in ("styleEngineLabel", "evidenceType", "narrationMode")}, ensure_ascii=False)),
        check("mode-audio-plan", "音频模式匹配", (not needs_original) or original_audio_plan, "warning", "mode needs original audio plan" if needs_original and not original_audio_plan else "ok"),
    ]
    penalty = 0
    for item in checks:
        if item["passed"]:
            continue
        penalty += 22 if item["severity"] == "blocker" else 7
    score = max(0, 100 - penalty)
    verdict = "go" if score >= 85 and all(item["passed"] or item["severity"] != "blocker" for item in checks) else "revise" if score >= 70 else "restart"
    print(json.dumps({"score": score, "verdict": verdict, "checks": checks}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
