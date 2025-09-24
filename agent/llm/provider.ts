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
            async jsonToolCall(msgs: Msg[], schema?: any) {
                // Prepend an instruction requiring a JSON object response to
                // satisfy OpenAI's json_object response_format requirement.
                const jsonGuard: Msg = {
                    role: "system",
                    content:
                        "Respond with a single JSON object only. Use keys 'tool' and 'args'. Do not include any text outside of JSON.",
                };

                const toolSchemaText = schema
                    ? `Available tools and argument shapes (JSON): ${JSON.stringify(
                          schema
                      )}. Rules: Always choose one listed tool. Use only non-interactive commands. Use 'pnpm' for packages. Never open editors like 'nano' or 'vim'.`
                    : undefined;

                const toolSchemaMsg: Msg | null = toolSchemaText
                    ? { role: "system", content: toolSchemaText }
                    : null;

                const r = await client.chat.completions.create({
                    model: name,
                    temperature: 0,
                    messages: toolSchemaMsg
                        ? [jsonGuard, toolSchemaMsg, ...msgs]
                        : [jsonGuard, ...msgs],
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
