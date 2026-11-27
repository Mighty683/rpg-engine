import { tr } from "../../shared/i18n";
/**
 * Composition hook for game notes: resolves the per-game notebook against the
 * injected notes client, routes controller notices to toasts, and keeps one
 * notebook alive at a time so switching games, losing access or signing out
 * clears drafts, save queues and loaded lists.
 */
import { h, watch } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { account } from "../auth/session";
import { useApiServices } from "../../shared/api-services";
import { createNotebook, type NoteNotice, type Notebook } from "./notebook";

let current: { gameId: string; notebook: Notebook } | undefined;
watch(account, (next, previous) => {
  if (next?.id === previous?.id) return;
  current?.notebook.dispose();
  current = undefined;
});

function noticeToast(notice: NoteNotice) {
  return {
    title: h(
      "span",
      { "data-testid": notice.kind === "success" ? "note-created-toast" : "note-error-toast" },
      notice.title,
    ),
    description: notice.description,
    color: notice.kind,
    ...(notice.retry
      ? { actions: [{ label: tr("ui.retryEdits"), onClick: () => void notice.retry?.() }] }
      : {}),
  };
}

export function useNotebook(gameId: string): Notebook {
  const { gameNotes } = useApiServices();
  const toast = useToast();
  if (current && current.gameId === gameId) return current.notebook;
  current?.notebook.dispose();
  const notebook = createNotebook(gameId, gameNotes, (notice) => toast.add(noticeToast(notice)));
  current = { gameId, notebook };
  return notebook;
}
