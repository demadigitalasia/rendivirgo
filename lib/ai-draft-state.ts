/** Pure boundary shared by AI editors: every apply checks the latest full form snapshot. */
export function prepareAiApply(options: {
  generatedAt: string; currentVersion: string; draft: Record<string, string>;
  current: Record<string, unknown>; selected: Record<string, boolean>;
  language: string; mode: string;
}) {
  if (options.generatedAt !== options.currentVersion) throw new Error("The source changed after generation. Generate a fresh draft before applying.");
  return Object.fromEntries(Object.entries(options.draft).map(([key, value]) => {
    const eligible = (options.language === "both" || key.endsWith("Id") === (options.language === "id")) && options.selected[key] !== false && (options.mode !== "empty" || !String(options.current[key] ?? "").trim());
    return [key, eligible ? value : String(options.current[key] ?? "")];
  }));
}

export function canUndoAi(current: Record<string, unknown>, applied: Record<string, string>) {
  return Object.entries(applied).every(([key, value]) => String(current[key] ?? "") === value);
}
