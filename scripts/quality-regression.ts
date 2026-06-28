import { readFile } from "node:fs/promises";
import { generateContentPack, generateTopics } from "../server/pipeline";

type Assertion = {
  id: string;
  passed: boolean;
  detail: string;
};

const bannedVoiceoverTerms = [
  "我先押一个",
  "前20分钟",
  "谁先急",
  "撑过20分钟",
  "更重要的是",
  "更关键的是",
  "更要命的是",
  "真正的问题在于",
  "真正可怕的是",
  "归根结底",
  "本质上",
  "换句话说",
  "进一步说",
  "值得关注",
  "具有重要意义"
];

const editorLeakPattern = /(素材|剪辑|剪出来|先放|切到|画面怎么放|字幕怎么放|封面|发布平台|这条视频|这条内容)/;

function assert(id: string, passed: boolean, detail: string): Assertion {
  return { id, passed, detail };
}

function failIfNeeded(assertions: Assertion[]) {
  const failed = assertions.filter((item) => !item.passed);
  console.log(
    JSON.stringify(
      {
        passed: failed.length === 0,
        total: assertions.length,
        failed
      },
      null,
      2
    )
  );
  if (failed.length) process.exitCode = 1;
}

async function main() {
  process.env.WC_TEST_OFFLINE = "1";
  const profile = JSON.parse(await readFile("data/benchmark/football-creators/voiceover-style-profile.json", "utf8"));
  const response = await generateTopics({
    language: "zh",
    fixtureId: "2026-06-23-por-uzb",
    themeId: "star-legacy",
    count: 5
  });
  const first = response.topics[0];
  const pack = generateContentPack(first, response.assets);
  const voiceover = pack.script.map((beat) => beat.voiceover).join("\n");
  const rawFixtureNames = [
    ...new Set(
      response.topics.flatMap((topic) => (topic.fixture ? [topic.fixture.home, topic.fixture.away] : [])).filter((name) => /[A-Za-z]/.test(name))
    )
  ];

  const assertions: Assertion[] = [
    assert("profile-engines", profile.engines.length >= 7, `engines=${profile.engines.length}`),
    assert("profile-full-base", profile.evidenceBase.totalVideos === 115, `videos=${profile.evidenceBase.totalVideos}`),
    assert("topics-generated", response.topics.length >= 3, `topics=${response.topics.length}`),
    assert("offline-hotspot-fallback", response.hotspotSignals.length > 0, `signals=${response.hotspotSignals.length}`),
    assert(
      "all-topics-have-style-fields",
      response.topics.every(
        (topic) =>
          topic.styleEngineLabel &&
          topic.evidenceType &&
          topic.narrationMode &&
          topic.editDifficulty &&
          topic.topicMechanism &&
          topic.hotspotSignals.length > 0
      ),
      response.topics.map((topic) => `${topic.title}:${topic.styleEngineLabel}/${topic.hotspotSignals.length}`).join(" | ")
    ),
    assert(
      "all-topics-pass-preflight",
      response.topics.every((topic) => topic.preflight.total >= 82 && topic.preflight.verdict === "pass"),
      response.topics.map((topic) => `${topic.preflight.total}:${topic.title}`).join(" | ")
    ),
    assert(
      "zh-localized-topic",
      response.topics.every((topic) => {
        const text = `${topic.title}${topic.hook}`;
        return /[\u4e00-\u9fa5]/.test(text) && !rawFixtureNames.some((name) => text.includes(name));
      }),
      `raw=${rawFixtureNames.join(",")} topics=${response.topics.map((topic) => topic.title).join(" | ")}`
    ),
    assert(
      "no-banned-topic-phrases",
      response.topics.every((topic) => !bannedVoiceoverTerms.some((term) => `${topic.title}${topic.hook}`.includes(term))),
      response.topics.map((topic) => topic.title).join(" | ")
    ),
    assert("content-pack-go-or-revise", ["go", "revise"].includes(pack.viralScore.verdict), `verdict=${pack.viralScore.verdict}`),
    assert("voiceover-no-editor-leak", !editorLeakPattern.test(voiceover), voiceover.slice(0, 160)),
    assert(
      "voiceover-no-ai-crutches",
      !bannedVoiceoverTerms.some((term) => voiceover.includes(term)) && !/不是[^。！？\n\r]{0,28}而是/.test(voiceover),
      voiceover.slice(0, 200)
    ),
    assert(
      "voiceover-visual-separated",
      pack.script.every((beat) => beat.voiceover && beat.visualInstruction && beat.voiceover !== beat.visualInstruction),
      pack.script.map((beat) => `${beat.label}:${beat.voiceover.slice(0, 16)} / ${beat.visualInstruction.slice(0, 16)}`).join(" | ")
    )
  ];

  failIfNeeded(assertions);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
