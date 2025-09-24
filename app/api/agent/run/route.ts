import { NextRequest } from "next/server"
import { EventEmitter } from "events"
import { runAgent } from "@/agent"

export async function POST(request: NextRequest) {
  const { task, sandboxId, repoUrl, model = "openai:gpt-4o-mini" } = await request.json()

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const emit = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const emitter = new EventEmitter()
      emitter.on("event", (evt: any) => {
        emit(evt.type, evt)
        if (evt.type === "done" || evt.type === "error") {
          controller.close()
        }
      })

      runAgent({ sandboxId, repoUrl, task, model, emitter }).catch((e) => {
        emit("error", { error: e?.message || String(e) })
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
