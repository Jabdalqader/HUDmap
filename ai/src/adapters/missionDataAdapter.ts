
import type {
  MissionData,
  MissionDataSource,
  MissionStop,
} from "../contracts/MissionData";

/**
 * Mission data adapter: the single boundary between raw mission JSON and the
 * normalized `MissionData` model.
 *
 *   raw JSON (unknown) ──► mapRawMission() ──► validateMission() ──► MissionData
 *                          (schema-specific)   (schema-independent)
 *
 * When the official T1.1 `mission.json` arrives with a different schema,
 * change ONLY `mapRawMission` / `mapRawStop` below. Everything after this file
 * works with `MissionData` and doesn't need to change.
 * See docs/REPLACING_MOCK_DATA.md, Scenario B.
 */

export class MissionDataValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      `Invalid mission data (${issues.length} issue${issues.length === 1 ? "" : "s"}):\n` +
        issues.map((issue) => `  - ${issue}`).join("\n"),
    );
    this.name = "MissionDataValidationError";
  }
}

export interface NormalizeOptions {
  /** Who is supplying the data. The provider sets this; it isn't read from the JSON. */
  source: MissionDataSource;
}

/** Validate and normalize raw mission JSON. Throws `MissionDataValidationError`. */
export function normalizeMissionData(
  raw: unknown,
  options: NormalizeOptions,
): MissionData {
  const issues: string[] = [];
  const reader = new FieldReader(issues);

  const mission = mapRawMission(raw, reader, options.source);

  if (issues.length === 0 && mission) {
    validateMission(mission, issues);
    // Guard against accidentally shipping demo data as official data.
    if (options.source === "official" && isRecord(raw) && raw["is_mock"] === true) {
      issues.push(
        'is_mock: data is marked as mock ("is_mock": true) but was loaded as official mission data',
      );
    }
  }

  if (issues.length > 0 || !mission) {
    throw new MissionDataValidationError(issues);
  }
  return mission;
}

// ---------------------------------------------------------------------------
// Schema-specific mapping. EDIT THIS SECTION when the official schema differs.
// Current mapping = the mock schema (src/data/mission.mock.json).
// ---------------------------------------------------------------------------

function mapRawMission(
  raw: unknown,
  r: FieldReader,
  source: MissionDataSource,
): MissionData | undefined {
  if (!isRecord(raw)) {
    r.issues.push(`(root): expected a JSON object, got ${describe(raw)}`);
    return undefined;
  }

  const rawStops = r.array(raw, "stops", "stops");

  return {
    missionId: r.string(raw, "mission_id", "mission_id"),
    missionName: r.string(raw, "mission_name", "mission_name"),
    location: r.string(raw, "location", "location"),
    source,
    stops: rawStops.map((rawStop, i) => mapRawStop(rawStop, r, `stops[${i}]`)),
  };
}

function mapRawStop(raw: unknown, r: FieldReader, path: string): MissionStop {
  if (!isRecord(raw)) {
    r.issues.push(`${path}: expected an object, got ${describe(raw)}`);
    return { id: NaN, name: "", description: "", tasks: [] };
  }
  return {
    id: r.integer(raw, "id", `${path}.id`),
    name: r.string(raw, "name", `${path}.name`),
    description: r.string(raw, "description", `${path}.description`),
    tasks: r.stringArray(raw, "tasks", `${path}.tasks`),
  };
}

// ---------------------------------------------------------------------------
// Schema-independent rules on the normalized model. Normally left unchanged.
// ---------------------------------------------------------------------------

function validateMission(mission: MissionData, issues: string[]): void {
  if (mission.stops.length === 0) {
    issues.push("stops: mission must contain at least one stop");
  }
  const seen = new Set<number>();
  mission.stops.forEach((stop, i) => {
    if (stop.id < 1) {
      issues.push(`stops[${i}].id: must be a positive integer, got ${stop.id}`);
    }
    if (seen.has(stop.id)) {
      issues.push(`stops[${i}].id: duplicate stop id ${stop.id}`);
    }
    seen.add(stop.id);
  });
}

// ---------------------------------------------------------------------------
// Small runtime-validation helpers (no external dependency). Missing or invalid
// required fields are recorded as issues. Nothing gets a made-up default value.
// ---------------------------------------------------------------------------

class FieldReader {
  constructor(public readonly issues: string[]) {}

  string(obj: Record<string, unknown>, key: string, path: string): string {
    const value = obj[key];
    if (value === undefined || value === null) {
      this.issues.push(`${path}: required field is missing`);
      return "";
    }
    if (typeof value !== "string" || value.trim() === "") {
      this.issues.push(`${path}: expected a non-empty string, got ${describe(value)}`);
      return "";
    }
    return value.trim();
  }

  integer(obj: Record<string, unknown>, key: string, path: string): number {
    const value = obj[key];
    if (value === undefined || value === null) {
      this.issues.push(`${path}: required field is missing`);
      return NaN;
    }
    if (typeof value !== "number" || !Number.isInteger(value)) {
      this.issues.push(`${path}: expected an integer, got ${describe(value)}`);
      return NaN;
    }
    return value;
  }

  array(obj: Record<string, unknown>, key: string, path: string): unknown[] {
    const value = obj[key];
    if (value === undefined || value === null) {
      this.issues.push(`${path}: required field is missing`);
      return [];
    }
    if (!Array.isArray(value)) {
      this.issues.push(`${path}: expected an array, got ${describe(value)}`);
      return [];
    }
    return value;
  }

  stringArray(obj: Record<string, unknown>, key: string, path: string): string[] {
    return this.array(obj, key, path).flatMap((item, i) => {
      if (typeof item !== "string" || item.trim() === "") {
        this.issues.push(`${path}[${i}]: expected a non-empty string, got ${describe(item)}`);
        return [];
      }
      return [item.trim()];
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return value.trim() === "" ? "empty string" : "string";
  return typeof value;
}
