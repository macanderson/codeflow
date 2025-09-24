import { EventEmitter } from "events";
import { getLLM } from "./llm/provider";
import { createSandbox, connectSandbox, runCmd, readFile, writeFile, installPkgs } from "./tools/e2b";
import { gitClone } from "./tools/git";
import { fastApply } from "./tools/fastApply";

export type ToolEvent =
  | { type: "plan"; content: string }
  | { type: "tool"; name: string; input: any; output?: any }
  | { type: "log"; content: string }
  | { type: "done"; summary: string }
  | { type: "error"; error: string };

export async function runAgent(params: {
  repoUrl?: string;
  sandboxId?: string;
  task: string;
  model: string;
  emitter: EventEmitter;
}) {
  const { repoUrl, sandboxId, task, model, emitter } = params;
  const llm = getLLM(model);

  let sbx: any;
  if (sandboxId) {
    emitter.emit("event", { type: "log", content: `Connecting to sandbox ${sandboxId}...` });
    sbx = await connectSandbox(sandboxId);
  } else {
    emitter.emit("event", { type: "log", content: "Creating sandbox..." });
    sbx = await createSandbox();
    if (repoUrl) {
      emitter.emit("event", { type: "tool", name: "git.clone", input: { repoUrl } });
      await gitClone(sbx, repoUrl);
    }
  }

  const system = `You are an autonomous coding agent operating in a secure sandbox.
Your repository is located at /home/user/workspace.
You can: run shell commands, read/write files, install packages, and apply partial code edits.
Output compact, executable steps. Prefer small, testable iterations.`;

  const initial = await llm.complete([
    { role: "system", content: system },
    { role: "user", content: `Task: ${task}\nConstraints:\n- Use npm\n- Keep steps atomic\n- After each step, propose next step` }
  ]);
  emitter.emit("event", { type: "plan", content: initial.text });

  for (let step = 0; step < 12; step++) {
    const toolReq = await llm.jsonToolCall([
      { role: "system", content: system },
      { role: "user", content: `Repository cloned at /home/user/workspace.\nUser task: ${task}` },
      { role: "assistant", content: initial.text }
    ], {
      tools: {
        "cmd.run": { cmd: "string", cwd: "string?" },
        "fs.read": { path: "string" },
        "fs.write": { path: "string", content: "string" },
        "pkg.install": { pkgs: "string[]" },
        "edit.fastApply": { path: "string", patch: "string" }
      }
    });

    const { name, args } = toolReq;
    emitter.emit("event", { type: "tool", name, input: args });

    let out = "";
    try {
      if (name === "cmd.run") out = await runCmd(sbx, args.cmd, args.cwd);
      else if (name === "fs.read") out = await readFile(sbx, args.path);
      else if (name === "fs.write") { await writeFile(sbx, args.path, args.content); out = "OK"; }
      else if (name === "pkg.install") out = await installPkgs(sbx, args.pkgs);
      else if (name === "edit.fastApply") {
        const target = args.path.startsWith("/home/user/") ? args.path : `/home/user/workspace/${args.path}`;
        out = await fastApply(sbx, target, args.patch);
      }
      else out = `Unknown tool: ${name}`;

      emitter.emit("event", { type: "tool", name, input: args, output: (out ?? "").toString().slice(0, 2000) });
    } catch (e: any) {
      emitter.emit("event", { type: "error", error: e?.message ?? String(e) });
      break;
    }

    const verdict = await llm.complete([
      { role: "system", content: system },
      { role: "user", content: `Last tool output:\n${(out ?? "").toString().slice(0, 4000)}\nIs the task complete? If yes, summarize starting with 'DONE:'. If no, propose next tool call.` }
    ]);
    emitter.emit("event", { type: "plan", content: verdict.text });
    if (/^DONE:/i.test(verdict.text)) {
      emitter.emit("event", { type: "done", summary: verdict.text });
      break;
    }
  }
}
