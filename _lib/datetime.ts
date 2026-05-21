// Path: medicalend-mobile/_lib/datetime.ts

export function stripTimezoneSuffix(value: string) {
  return String(value || "").replace(/(Z|[+-]\d{2}:\d{2})$/, "");
}

export function parseWallClockDate(value: string) {
  const raw = stripTimezoneSuffix(String(value || ""));
  const [datePart, timePart = "00:00:00"] = raw.split("T");

  if (!datePart) return new Date(NaN);

  const [y, m, d] = datePart.split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = timePart.split(":").map(Number);

  return new Date(y, (m || 1) - 1, d || 1, hh, mm, ss, 0);
}

export function formatWallClockDateTime(value: string) {
  try {
    const d = parseWallClockDate(value);
    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleString("ro-RO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatWallClockTime(value: string) {
  try {
    const d = parseWallClockDate(value);
    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function wallClockTimestamp(value: string) {
  const d = parseWallClockDate(value);
  return d.getTime();
}

export function nowLocalNaiveIso() {
  return dateToNaiveIso(new Date());
}

export function dateToNaiveIso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

export function normalizeUserInputToNaiveIso(raw: string) {
  const value = String(raw || "").trim();
  if (!value) return "";

  const withoutTimezone = stripTimezoneSuffix(value);

  if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}(:\d{2})?$/.test(withoutTimezone)) {
    const [datePart, timePart] = withoutTimezone.split("T");
    const [h, m, s = "00"] = timePart.split(":");
    return `${datePart}T${h.padStart(2, "0")}:${m}:${s}`;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{1,2}:\d{2}(:\d{2})?$/.test(withoutTimezone)) {
    return normalizeUserInputToNaiveIso(withoutTimezone.replace(" ", "T"));
  }

  const parsed = parseWallClockDate(withoutTimezone);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid datetime input");
  }

  return dateToNaiveIso(parsed);
}

export function toBackendNaiveIso(value: string | Date) {
  if (value instanceof Date) {
    return dateToNaiveIso(value);
  }

  return normalizeUserInputToNaiveIso(value);
}
