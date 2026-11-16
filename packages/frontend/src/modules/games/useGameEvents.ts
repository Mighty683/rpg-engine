import { onMounted, onUnmounted } from "vue";
import { useApiServices } from "../../shared/api-services";
import type { GameChangeHint } from "./types";

/** Refreshes after subscribing to close the gap between the initial read and live updates. */
export function useGameEvents(
  gameId: string | undefined,
  onChange: (hint: GameChangeHint) => void,
  onOpen: () => void,
) {
  if (!gameId) return;
  const { games } = useApiServices();
  let stream: ReturnType<typeof games.openGameEvents> | undefined;
  onMounted(() => {
    stream = games.openGameEvents(gameId.toLowerCase());
    stream.onopen = onOpen;
    stream.onmessage = ({ data }) => {
      try {
        const hint = JSON.parse(data) as GameChangeHint | null;
        if (hint) onChange(hint);
      } catch {
        // HTTP reads remain authoritative when an event cannot be decoded.
      }
    };
  });
  onUnmounted(() => stream?.close());
}
