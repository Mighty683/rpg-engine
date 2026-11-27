import { tr } from "../../shared/i18n";
import type { NpcWrite } from "../npcs/types";
import type { EditDifference } from "./types";
export function nested(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function differences(before: Record<string, unknown>, after: Record<string, unknown>) {
  const entries: EditDifference[] = [];
  for (const [key, value] of Object.entries(after)) {
    const previous = before[key];
    if (nested(value) && nested(previous)) {
      for (const item of differences(previous, value))
        entries.push({ ...item, field: key + "." + item.field });
    } else if (previous !== value)
      entries.push({ field: key, oldValue: previous, newValue: value });
  }
  return entries;
}
function fieldLabel(path: string) {
  const [group, field] = path.split(".");
  if (group === "baseDice") return tr("ui.baseDie", { attribute: field });
  if (group === "resources")
    return field === "fabula"
      ? tr("ui.fabulaPoints")
      : tr("ui.currentValue1", { value1: field?.toUpperCase() });
  if (group === "hp" || group === "mp")
    return field === "current"
      ? tr("ui.currentValue1", { value1: group.toUpperCase() })
      : tr("ui.maximumResource", { resource: group.toUpperCase() });
  if (group === "magicDefense") return tr("ui.magicDefense");
  if (group === "notes") return tr("ui.gmNotes");
  return path.charAt(0).toUpperCase() + path.slice(1);
}
export function mergedProfile(base: NpcWrite, patch: Record<string, unknown>): NpcWrite {
  const updated = { ...base, ...patch };
  for (const key of ["baseDice", "hp", "mp"] as const) {
    if (nested(patch[key])) Object.assign(updated, { [key]: { ...base[key], ...patch[key] } });
  }
  return updated;
}

export function editDifferences(before: Record<string, unknown>, after: Record<string, unknown>) {
  return differences(before, after).map((row) => ({ ...row, field: fieldLabel(row.field) }));
}
