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
Follow these rules strictly:
- Use pnpm for Node.js package operations (never npm or yarn).
- Never use interactive editors (nano, vim) or interactive prompts; all commands must be non-interactive.
- Prefer small, testable iterations with concrete, reproducible commands and file edits.
- Do not ask the user questions; decide and proceed with the best next step.`;

  // Maintain running conversation history across steps
  type Msg = { role: "system" | "user" | "assistant"; content: string };
  const history: Msg[] = [];

  // Initial reasoning
  const initial = await llm.complete([
    { role: "system", content: system },
    { role: "user", content: `Task: ${task}\nConstraints:\n- Use pnpm for all Node tasks\n- Keep steps atomic\n- After each step, propose the exact next tool call you will make` }
  ]);
  emitter.emit("event", { type: "plan", content: initial.text });

  // Seed history with the user task and the assistant's initial plan
  history.push(
    { role: "user", content: `Task: ${task}` },
    { role: "assistant", content: initial.text }
  );

  for (let step = 0; step < 24; step++) {
    // Ask the model to choose the next tool based on full history
    const toolReq = await llm.jsonToolCall([
      { role: "system", content: system },
      ...history,
      { role: "user", content: `Return one JSON {tool, args}. Continue the task.` }
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
      if (name === "cmd.run") {
        out = await runCmd(sbx, args.cmd, args.cwd);
      }
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
      // Reflect error into history and stop
      history.push({ role: "user", content: `Tool ${name} error: ${e?.message ?? String(e)}` });
      break;
    }

    // Append tool output into history for the next decision
    const brief = (out ?? "").toString().slice(0, 4000);
    history.push({ role: "user", content: `Tool ${name} output:\n${brief}` });

    // Ask if done or what to do next, and persist this reasoning into history
    const verdict = await llm.complete([
      { role: "system", content: system },
      ...history,
      { role: "user", content: `If the task is complete, respond starting with 'DONE:' and provide a brief summary. Otherwise, describe the next step briefly.` }
    ]);
    emitter.emit("event", { type: "plan", content: verdict.text });

    history.push({ role: "assistant", content: verdict.text });

    if (/^DONE:/i.test(verdict.text)) {
      emitter.emit("event", { type: "done", summary: verdict.text });
      break;
    }
  }
}
