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
    try {
      await sbx.applyPatch(unified);
      return "Fast-apply updated file";
    } catch (e) {
      // Fallback to direct write if patch fails
      const dir = path.substring(0, path.lastIndexOf('/'))
      if (dir) {
        try { await sbx.run(`mkdir -p ${JSON.stringify(dir)}`) } catch {}
      }
      await sbx.writeFile(path, patch, "utf8");
      return "Patched failed; wrote file content directly";
    }
  } else {
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (dir) {
      try { await sbx.run(`mkdir -p ${JSON.stringify(dir)}`) } catch {}
    }
    await sbx.writeFile(path, patch, "utf8");
    return "Wrote file content directly (applyPatch unavailable)";
  }
}
