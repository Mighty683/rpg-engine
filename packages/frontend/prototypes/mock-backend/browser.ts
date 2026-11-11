/** Await interception before Histoire mounts any backend-connected controller. */
import { setupWorker } from "msw/browser";
import { prototypeHandlers } from "./handlers";

export const prototypeWorker = setupWorker(...prototypeHandlers);
let startup: Promise<unknown> | undefined;

export function startPrototypeBackend() {
  startup ??= prototypeWorker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: "bypass",
    quiet: true,
  });
  return startup;
}
