import type { Plant } from "../types";

/**
 * The garden's server state — now only the open streams.
 *
 * **There is no sample book any more.** This module used to hold one generated
 * business, its weather and its timeline, shared by every visitor: a demo, and
 * the thing every `/api/garden/*` handler fell back to. It has been deleted along
 * with `lib/mockData` and the webhook simulator, because a dashboard that shows
 * invented customers to a signed-in user is a dashboard nobody can trust. A user
 * with nothing connected now sees an empty plot that says so.
 *
 * What is left is the subscriber registry for `/api/garden/stream`. It is still
 * pinned to `globalThis` for the reason it always was: Next re-evaluates route
 * modules on edit, and a fresh module would strand every open connection.
 */

interface Subscriber {
  send: (event: string, data: unknown) => void;
  close: () => void;
}

interface GardenServer {
  subscribers: Set<Subscriber>;
}

const KEY = Symbol.for("forestmrr.garden.server");
type GlobalWithGarden = typeof globalThis & { [KEY]?: GardenServer };

export function gardenServer(): GardenServer {
  const scope = globalThis as GlobalWithGarden;
  scope[KEY] ??= { subscribers: new Set() };
  return scope[KEY];
}

/** Push an event to every open stream. A dead socket unsubscribes itself. */
export function broadcast(event: string, data: unknown) {
  const { subscribers } = gardenServer();
  for (const subscriber of subscribers) {
    try {
      subscriber.send(event, data);
    } catch {
      subscribers.delete(subscriber);
    }
  }
}

export type { GardenServer, Plant, Subscriber };
