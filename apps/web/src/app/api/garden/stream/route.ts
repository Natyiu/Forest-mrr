import { gardenServer, type Subscriber } from "@/garden/server/state";
import { requireSession } from "@/garden/server/guard";

/**
 * The live wire, as server-sent events.
 *
 * Express handed us a `Response` to write to for as long as we liked; Next
 * hands back a `ReadableStream` instead, so the subscriber is a pair of
 * closures over its controller. `request.signal` fires when the browser goes
 * away — a tab closing must unsubscribe, or `broadcast` accumulates writers
 * into sockets nobody is holding.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_MS = 25_000;

export async function GET(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const { subscribers } = gardenServer();
  const encoder = new TextEncoder();

  let subscriber: Subscriber;
  let keepalive: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      subscriber = {
        send: (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        close: () => {
          clearInterval(keepalive);
          subscribers.delete(subscriber);
          try {
            controller.close();
          } catch {
            // Already closed by the client going away.
          }
        },
      };

      subscribers.add(subscriber);
      // An SSE connection that says nothing for long enough is closed by
      // proxies and by some browsers. A comment frame is not an event, so
      // nothing downstream has to know this is happening.
      keepalive = setInterval(() => {
        try {
          write(": keepalive\n\n");
        } catch {
          subscriber.close();
        }
      }, KEEPALIVE_MS);

      request.signal.addEventListener("abort", () => subscriber.close());
    },
    cancel() {
      subscriber?.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx and friends buffer by default, which turns a live stream into a
      // batch delivered whenever the buffer happens to fill.
      "X-Accel-Buffering": "no",
    },
  });
}
