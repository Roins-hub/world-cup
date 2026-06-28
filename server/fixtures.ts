import type { Fixture } from "../shared/types";

const source = "Xiaohongshu World Cup fixtures page SSR snapshot, checked 2026-06-28";

const fixtureSeeds = [
  ["2026-06-29-round-of-32-south-africa-canada", "2026-06-29", "北京时间 03:00", "2026-06-28T19:00:00.000Z", "Round of 32", "South Africa", "Canada", "Inglewood, Calif."],
  ["2026-06-30-round-of-32-brazil-japan", "2026-06-30", "北京时间 01:00", "2026-06-29T17:00:00.000Z", "Round of 32", "Brazil", "Japan", "Houston"],
  ["2026-06-30-round-of-32-germany-paraguay", "2026-06-30", "北京时间 04:30", "2026-06-29T20:30:00.000Z", "Round of 32", "Germany", "Paraguay", "Foxborough, Mass."],
  ["2026-06-30-round-of-32-netherlands-morocco", "2026-06-30", "北京时间 09:00", "2026-06-30T01:00:00.000Z", "Round of 32", "Netherlands", "Morocco", "Guadalupe, Mexico"],
  ["2026-07-01-round-of-32-ivory-coast-norway", "2026-07-01", "北京时间 01:00", "2026-06-30T17:00:00.000Z", "Round of 32", "Ivory Coast", "Norway", "Arlington, Texas"],
  ["2026-07-01-round-of-32-france-sweden", "2026-07-01", "北京时间 05:00", "2026-06-30T21:00:00.000Z", "Round of 32", "France", "Sweden", "East Rutherford, N.J."],
  ["2026-07-01-round-of-32-mexico-ecuador", "2026-07-01", "北京时间 09:00", "2026-07-01T01:00:00.000Z", "Round of 32", "Mexico", "Ecuador", "Mexico City"],
  ["2026-07-02-round-of-32-england-congo-dr", "2026-07-02", "北京时间 00:00", "2026-07-01T16:00:00.000Z", "Round of 32", "England", "Congo DR", "Atlanta"],
  ["2026-07-02-round-of-32-belgium-senegal", "2026-07-02", "北京时间 04:00", "2026-07-01T20:00:00.000Z", "Round of 32", "Belgium", "Senegal", "Seattle"],
  ["2026-07-02-round-of-32-usa-bosnia-and-herzegovina", "2026-07-02", "北京时间 08:00", "2026-07-02T00:00:00.000Z", "Round of 32", "USA", "Bosnia and Herzegovina", "Santa Clara, Calif."],
  ["2026-07-03-round-of-32-spain-austria", "2026-07-03", "北京时间 03:00", "2026-07-02T19:00:00.000Z", "Round of 32", "Spain", "Austria", "Inglewood, Calif."],
  ["2026-07-03-round-of-32-portugal-croatia", "2026-07-03", "北京时间 07:00", "2026-07-02T23:00:00.000Z", "Round of 32", "Portugal", "Croatia", "Toronto"],
  ["2026-07-03-round-of-32-switzerland-algeria", "2026-07-03", "北京时间 11:00", "2026-07-03T03:00:00.000Z", "Round of 32", "Switzerland", "Algeria", "Vancouver, Canada"],
  ["2026-07-04-round-of-32-australia-egypt", "2026-07-04", "北京时间 02:00", "2026-07-03T18:00:00.000Z", "Round of 32", "Australia", "Egypt", "Arlington, Texas"],
  ["2026-07-04-round-of-32-argentina-cabo-verde", "2026-07-04", "北京时间 06:00", "2026-07-03T22:00:00.000Z", "Round of 32", "Argentina", "Cabo Verde", "Miami Gardens, Fla."],
  ["2026-07-04-round-of-32-colombia-ghana", "2026-07-04", "北京时间 09:30", "2026-07-04T01:30:00.000Z", "Round of 32", "Colombia", "Ghana", "Kansas City, Mo."],
  ["2026-07-05-round-of-16-match-1", "2026-07-05", "北京时间 01:00", "2026-07-04T17:00:00.000Z", "Round of 16", "Round of 16 Match 1", "TBD", "Houston"],
  ["2026-07-05-round-of-16-match-2", "2026-07-05", "北京时间 05:00", "2026-07-04T21:00:00.000Z", "Round of 16", "Round of 16 Match 2", "TBD", "Philadelphia"],
  ["2026-07-06-round-of-16-match-3", "2026-07-06", "北京时间 04:00", "2026-07-05T20:00:00.000Z", "Round of 16", "Round of 16 Match 3", "TBD", "East Rutherford, N.J."],
  ["2026-07-06-round-of-16-match-4", "2026-07-06", "北京时间 08:00", "2026-07-06T00:00:00.000Z", "Round of 16", "Round of 16 Match 4", "TBD", "Mexico City"],
  ["2026-07-07-round-of-16-match-5", "2026-07-07", "北京时间 03:00", "2026-07-06T19:00:00.000Z", "Round of 16", "Round of 16 Match 5", "TBD", "Arlington, Texas"],
  ["2026-07-07-round-of-16-match-6", "2026-07-07", "北京时间 08:00", "2026-07-07T00:00:00.000Z", "Round of 16", "Round of 16 Match 6", "TBD", "Seattle"],
  ["2026-07-08-round-of-16-match-7", "2026-07-08", "北京时间 00:00", "2026-07-07T16:00:00.000Z", "Round of 16", "Round of 16 Match 7", "TBD", "Atlanta"],
  ["2026-07-08-round-of-16-match-8", "2026-07-08", "北京时间 04:00", "2026-07-07T20:00:00.000Z", "Round of 16", "Round of 16 Match 8", "TBD", "Vancouver, Canada"],
  ["2026-07-10-quarterfinal-1", "2026-07-10", "北京时间 04:00", "2026-07-09T20:00:00.000Z", "Quarterfinals", "Quarterfinal 1", "TBD", "Foxborough, Mass."],
  ["2026-07-11-quarterfinal-2", "2026-07-11", "北京时间 03:00", "2026-07-10T19:00:00.000Z", "Quarterfinals", "Quarterfinal 2", "TBD", "Inglewood, Calif."],
  ["2026-07-12-quarterfinal-3", "2026-07-12", "北京时间 05:00", "2026-07-11T21:00:00.000Z", "Quarterfinals", "Quarterfinal 3", "TBD", "Miami Gardens, Fla."],
  ["2026-07-12-quarterfinal-4", "2026-07-12", "北京时间 09:00", "2026-07-12T01:00:00.000Z", "Quarterfinals", "Quarterfinal 4", "TBD", "Kansas City, Mo."],
  ["2026-07-15-semifinal-1", "2026-07-15", "北京时间 03:00", "2026-07-14T19:00:00.000Z", "Semifinals", "Semifinal 1", "TBD", "Arlington, Texas"],
  ["2026-07-16-semifinal-2", "2026-07-16", "北京时间 03:00", "2026-07-15T19:00:00.000Z", "Semifinals", "Semifinal 2", "TBD", "Atlanta"],
  ["2026-07-19-third-place-playoff", "2026-07-19", "北京时间 05:00", "2026-07-18T21:00:00.000Z", "Third-place playoff", "Third Place Playoff", "TBD", "Miami Gardens, Fla."],
  ["2026-07-20-final", "2026-07-20", "北京时间 03:00", "2026-07-19T19:00:00.000Z", "Final", "Final", "TBD", "East Rutherford, N.J."]
] as const;

const rawFixtures: Fixture[] = fixtureSeeds.map(([id, date, localTime, startsAt, group, home, away, venue]) => ({
  id,
  date,
  localTime,
  startsAt,
  group,
  home,
  away,
  venue,
  status: "upcoming",
  source
}));

export const fixtures = [...rawFixtures].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

export function getFutureFixtures(now = new Date()) {
  return fixtures.filter((fixture) => Date.parse(fixture.startsAt) > now.getTime());
}
