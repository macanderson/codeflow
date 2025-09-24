import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export function getLLM(model: string) {
  if (model.startsWith("openai:")) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const name = model.split(":")[1];
    return {
      async complete(msgs: Msg[]) {
        const r = await client.chat.completions.create({
          model: name,
          messages: msgs,
          temperature: 0.2
        });
        return { text: r.choices[0].message?.content ?? "" };
      },
      async jsonToolCall(msgs: Msg[], _schema?: any) {
        const r = await client.chat.completions.create({
          model: name,
          temperature: 0,
          messages: msgs,
          response_format: { type: "json_object" }
        });
        const content = r.choices[0].message?.content ?? "{}";
        let parsed: any = {};
        try { parsed = JSON.parse(content); } catch {}
        const tool = parsed.tool ?? parsed.name;
        const args = parsed.args ?? parsed.arguments ?? {};
        return { name: tool, args };
      }
    };
  } else if (model.startsWith("anthropic:")) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const name = model.split(":")[1];
    return {
      async complete(msgs: Msg[]) {
        const r = await client.messages.create({
          model: name,
          max_tokens: 1024,
          temperature: 0.2,
          messages: msgs as any
        });
        const text = (r.content as any[]).map((c: any) => c.text ?? "").join("");
        return { text };
      },
      async jsonToolCall(msgs: Msg[]) {
        const r = await client.messages.create({
          model: name,
          max_tokens: 1024,
          temperature: 0,
          messages: msgs as any
        });
        const text = (r.content as any[]).map((c:any)=>c.text ?? "").join("");
        let parsed: any = {};
        try { parsed = JSON.parse(text); } catch {}
        const tool = parsed.tool ?? parsed.name;
        const args = parsed.args ?? parsed.arguments ?? {};
        return { name: tool, args };
      }
    };
  }
  throw new Error(`Unknown model: ${model}`);
}
