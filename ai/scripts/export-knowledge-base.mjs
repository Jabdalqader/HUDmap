
// Export ElevenLabs Knowledge Base files from the current mission data.
//
//   npm run kb:export                  # mock data  -> knowledge-base/mock/
//   npm run kb:export -- official      # official   -> knowledge-base/official/
//
// This script only writes local files. It does NOT upload to ElevenLabs.
// Upload or replace the files by hand in the ElevenLabs dashboard
// (see docs/REPLACING_MOCK_DATA.md, Scenario D).
//
// It uses Vite's module runner to load the TypeScript sources, so it runs
// through the same composition root and adapter as the app.

import { runnerImport } from "vite";
import { mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2] ?? "mock";

if (source !== "mock" && source !== "official") {
  console.error(`Unknown source "${source}". Use "mock" or "official".`);
  process.exit(1);
}

const load = (file) =>
  runnerImport(path.join(root, file), { root, logLevel: "error" }).then((r) => r.module);

try {
  const { createMissionDataServices } = await load("src/config/missionDataConfig.ts");
  const { buildMissionKnowledgeText } = await load("src/knowledge/buildMissionKnowledge.ts");

  const { missionService, stopCardService } = createMissionDataServices(source);
  const mission = await missionService.getMission();
  const cards = await stopCardService.getAllStopCards();

  const outDir = path.join(root, "knowledge-base", source);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const knowledgeFile = source === "mock" ? "mission_stops_MOCK.txt" : "mission_stops.txt";
  await writeFile(path.join(outDir, knowledgeFile), buildMissionKnowledgeText(mission, cards));
  await copyFile(path.join(root, "src/data/boxwork.txt"), path.join(outDir, "boxwork.txt"));

  console.log(`Knowledge Base files written to knowledge-base/${source}/:`);
  console.log(`  - ${knowledgeFile}  (${mission.stops.length} stops, source: ${mission.source})`);
  console.log("  - boxwork.txt");
  console.log("Not uploaded. Update the ElevenLabs Knowledge Base by hand.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
