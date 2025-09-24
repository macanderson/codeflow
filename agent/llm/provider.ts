import OpenAI from "openai";

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
                try {
                    parsed = JSON.parse(content);
                } catch {}
                const tool = parsed.tool ?? parsed.name;
                const args = parsed.args ?? parsed.arguments ?? {};
                return { name: tool, args };
            }
        };
    }
    throw new Error(`Unknown model: ${model}`);
}
