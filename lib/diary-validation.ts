export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validDiaryDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1970-01-01" ||
    value > "2100-12-31"
  )
    return false;
  const parsed = new Date(value + "T00:00:00Z");
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function validSession(
  value: unknown,
): value is {
  id: string;
  played_on: string;
  minutes: number;
  notes: string;
  completed: boolean;
  replay: boolean;
} {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    uuidPattern.test(b.id) &&
    validDiaryDate(b.played_on) &&
    Number.isInteger(b.minutes) &&
    Number(b.minutes) >= 1 &&
    Number(b.minutes) <= 1440 &&
    typeof b.notes === "string" &&
    b.notes.length <= 3000 &&
    typeof b.completed === "boolean" &&
    typeof b.replay === "boolean"
  );
}
