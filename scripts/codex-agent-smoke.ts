import { generateContentPack, generateTopics } from "../server/pipeline";

const playersByTeam: Record<string, string[]> = {
  Spain: ["亚马尔", "佩德里", "罗德里"],
  "Saudi Arabia": ["萨勒姆·达瓦萨里", "萨利赫·谢赫里"],
  Argentina: ["梅西", "劳塔罗"],
  Austria: ["阿瑙托维奇", "萨比策"],
  Algeria: ["马赫雷斯", "本纳赛尔"],
  Jordan: ["塔马里"],
  Japan: ["三笘薰", "久保建英"],
  Belgium: ["德布劳内", "多库", "卢卡库"],
  Iran: ["塔雷米", "阿兹蒙"],
  Uruguay: ["努涅斯", "巴尔韦德", "阿劳霍"],
  "Cape Verde": ["沃齐尼亚", "贝贝"],
  "New Zealand": ["克里斯·伍德"],
  Egypt: ["萨拉赫", "特雷泽盖"],
  France: ["姆巴佩", "格列兹曼"],
  Senegal: ["马内", "库利巴利"],
  Ghana: ["库杜斯", "托马斯"],
  Scotland: ["麦克托米奈", "罗伯逊"],
  Norway: ["哈兰德", "厄德高"],
  Iraq: ["艾曼·侯赛因"],
  Mexico: ["希门尼斯", "洛萨诺"],
  Brazil: ["维尼修斯", "罗德里戈", "内马尔"],
  England: ["贝林厄姆", "凯恩", "萨卡"],
  Germany: ["穆西亚拉", "维尔茨"],
  Portugal: ["C罗", "B费"],
  Uzbekistan: ["肖穆罗多夫"],
  Panama: ["戈多伊"],
  Croatia: ["莫德里奇", "格瓦迪奥尔"],
  Colombia: ["路易斯·迪亚斯", "哈梅斯"],
  "Congo DR": ["巴坎布"],
  Switzerland: ["扎卡", "阿坎吉"],
  Haiti: ["纳宗"],
  "South Africa": ["莫科纳"],
  "South Korea": ["孙兴慜", "李刚仁"],
  Ecuador: ["凯塞多", "恩纳·瓦伦西亚"],
  Turkiye: ["恰尔汗奥卢", "居莱尔"],
  Netherlands: ["范戴克", "加克波"],
  Italy: ["巴雷拉", "基耶萨"],
  Morocco: ["阿什拉夫", "齐耶赫"],
  Czechia: ["希克", "绍切克"]
};

async function main() {
  const response = await generateTopics({
    language: "zh",
    fixtureId: process.env.WC_SMOKE_FIXTURE_ID || "2026-06-23-por-uzb",
    themeId: process.env.WC_SMOKE_THEME_ID || "star-legacy",
    count: Number(process.env.WC_SMOKE_COUNT || 2)
  });
  const topic = response.topics[0];
  const pack = topic ? generateContentPack(topic, response.assets) : undefined;
  const selectedFixture = topic?.fixture;
  const allowedPlayers = new Set(selectedFixture ? [...(playersByTeam[selectedFixture.home] || []), ...(playersByTeam[selectedFixture.away] || [])] : []);
  const forbiddenForeignPlayers = Object.values(playersByTeam)
    .flat()
    .filter((name) => !allowedPlayers.has(name))
    .filter((name) => response.topics.some((item) => `${item.title}${item.hook}`.includes(name)));
  const result = {
    ok: Boolean(topic && pack?.generationMode === "codex_agent" && forbiddenForeignPlayers.length === 0),
    warnings: response.warnings,
    trace: response.trace.filter((line) => /Codex|Benchmark|降级/.test(line)),
    fixture: selectedFixture ? `${selectedFixture.home} vs ${selectedFixture.away}` : undefined,
    topics: response.topics.map((item) => ({
      title: item.title,
      engine: item.styleEngineLabel,
      mode: item.narrationMode,
      score: item.preflight.total
    })),
    generationMode: pack?.generationMode,
    forbiddenForeignPlayers,
    firstVoiceover: pack?.script?.[0]?.voiceover,
    firstVisualInstruction: pack?.script?.[0]?.visualInstruction
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
