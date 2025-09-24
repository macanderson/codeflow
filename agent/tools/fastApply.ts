import { createTwoFilesPatch } from "diff";

export async function fastApply(sbx: any, path: string, patch: string) {
  if (patch.startsWith("--- ") && patch.includes("\n+++ ")) {
    if (sbx.applyPatch) {
      await sbx.applyPatch(patch);
      return "Patch applied";
    }
  }
  const oldContent = await sbx.readFile(path, "utf8").catch(() => "");
  const unified = createTwoFilesPatch(path, path, oldContent, patch);
  if (sbx.applyPatch) {
    await sbx.applyPatch(unified);
    return "Fast-apply updated file";
  } else {
    await sbx.writeFile(path, patch, "utf8");
    return "Wrote file content directly (applyPatch unavailable)";
  }
}
