const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

function compactNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

/** Formats file sizes using decimal units (1 MB = 1,000,000 bytes). */
export function formatFileSize(bytes: number): string {
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1000 && unitIndex < UNITS.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }

  // Avoid displaying 1000.00 KB/MB/GB after rounding at a unit boundary.
  if (unitIndex < UNITS.length - 1 && value.toFixed(2) === "1000.00") {
    value /= 1000;
    unitIndex += 1;
  }

  const unit = UNITS[unitIndex];
  if (!unit) return bytes + " B";
  return unitIndex === 0
    ? `${value} ${unit}`
    : `${compactNumber(value)} ${unit}`;
}
