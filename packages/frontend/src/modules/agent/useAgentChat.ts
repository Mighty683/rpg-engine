import { tr } from "../../shared/i18n";
import { useToast } from "@nuxt/ui/composables";
import { computed, onScopeDispose, ref, shallowRef } from "vue";
import { useApiServices } from "../../shared/api-services";
import type { AgentAction, ChatMessage, HistoryTurn } from "./types";

function uniqueTurns(turns: HistoryTurn[]) {
  return [...new Map(turns.map((turn) => [turn.id, turn])).values()];
}

export function useAgentChat(gameId: string) {
  const { agent } = useApiServices();
  const toast = useToast();
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const draft = ref("");
  const pending = shallowRef<ChatMessage>();
  const turns = shallowRef<HistoryTurn[]>([]);
  const awaitingPage = shallowRef<HistoryTurn[]>([]);
  const nextBefore = ref<string | null>(null);
  const available = ref(false);
  const checking = ref(true);
  const remoteBusy = ref(false);
  const sending = ref(false);
  const action = shallowRef<AgentAction>();
  const actionTurnId = ref("");
  const busy = computed(() => remoteBusy.value || sending.value);
  let loaded = false;
  let refreshing = false;
  let rollVersion = 0;
  let loadingOlder = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let failed = false;

  const messages = computed(() =>
    [...turns.value, ...awaitingPage.value]
      .flatMap((turn): ChatMessage[] => [
        { id: turn.id + "-user", role: "user", text: turn.message },
        ...turn.tools.map((tool, i) => ({
          id: turn.id + "-tool-" + i,
          role: "tool" as const,
          text: tool.label,
        })),
        { id: turn.id + "-reply", role: "agent", text: turn.reply, roll: turn.roll },
      ])
      .concat(pending.value ? [pending.value] : []),
  );

  function report(error: unknown, title: string, notify = true) {
    if (signal.aborted) return;
    const problem = error as { status?: number; payload?: { error?: { message?: string } } };
    if ([401, 403, 404].includes(problem.status ?? 0)) {
      lifetime.abort();
      clearInterval(timer);
      available.value = false;
      pending.value = undefined;
      turns.value = [];
      awaitingPage.value = [];
      draft.value = "";
      action.value = undefined;
      loaded = false;
      nextBefore.value = null;
    }
    if (notify) toast.add({ title, description: problem.payload?.error?.message, color: "error" });
  }

  async function refresh() {
    if (refreshing || signal.aborted) return;
    refreshing = true;
    const version = rollVersion;
    try {
      const latest = await agent.status(gameId, signal);
      const known = new Set(turns.value.map((turn) => turn.id));
      let rows = latest.turns;
      let cursor = latest.nextBefore;
      while (known.size && cursor && !rows.some((turn) => known.has(turn.id))) {
        const page = await agent.status(gameId, signal, cursor);
        rows = [...page.turns, ...rows];
        cursor = page.nextBefore;
      }
      if (signal.aborted || pending.value || version !== rollVersion) return;
      if (!loaded || !turns.value.length) nextBefore.value = cursor;
      const updates = new Map(rows.map((turn) => [turn.id, turn]));
      turns.value = [
        ...turns.value.map((turn) => updates.get(turn.id) ?? turn),
        ...rows.filter((turn) => !known.has(turn.id)),
      ];
      if (awaitingPage.value.length) {
        const acknowledged = new Set(rows.map((turn) => turn.id));
        awaitingPage.value = awaitingPage.value.filter((turn) => !acknowledged.has(turn.id));
      }
      available.value = latest.available;
      remoteBusy.value = latest.busy;
      loaded = true;
      failed = false;
    } catch (error) {
      available.value = false;
      report(error, tr("ui.couldNotLoadAgentChat"), !failed);
      failed = true;
    } finally {
      checking.value = false;
      refreshing = false;
    }
  }

  async function older() {
    const cursor = nextBefore.value;
    if (!cursor || loadingOlder) return;
    loadingOlder = true;
    try {
      const page = await agent.status(gameId, signal, cursor);
      if (signal.aborted) return;
      turns.value = uniqueTurns([...page.turns, ...turns.value]);
      nextBefore.value = page.nextBefore;
    } catch (error) {
      report(error, tr("ui.couldNotLoadOlderMessagesScrollUpToRetry"));
    } finally {
      loadingOlder = false;
    }
  }

  async function submit() {
    const message = draft.value.trim();
    if (!message || !available.value || busy.value) return;
    sending.value = true;
    pending.value = { id: "pending-user", role: "user", text: message };
    draft.value = "";
    try {
      const turn = await agent.submit(gameId, message, signal);
      if (signal.aborted) return;
      pending.value = undefined;
      if (!turns.value.some((row) => row.id === turn.id)) {
        awaitingPage.value = [...awaitingPage.value, { ...turn, message, author: "GM" }];
      }
      void refresh();
      actionTurnId.value = turn.id;
      action.value = turn.action;
    } catch (error) {
      pending.value = undefined;
      report(error, tr("ui.couldNotCompleteTheAgentTurn"));
      await refresh();
    } finally {
      sending.value = false;
    }
  }

  function rolled(id: string, roll: NonNullable<HistoryTurn["roll"]>) {
    rollVersion++;
    const update = (turn: HistoryTurn) => (turn.id === id ? { ...turn, roll } : turn);
    turns.value = turns.value.map(update);
    awaitingPage.value = awaitingPage.value.map(update);
    if (actionTurnId.value === id) action.value = undefined;
    void refresh();
  }

  function setOpen(open: boolean) {
    clearInterval(timer);
    if (open) {
      void refresh();
      timer = setInterval(() => void refresh(), 2000);
    }
  }

  onScopeDispose(() => {
    clearInterval(timer);
    lifetime.abort();
  });
  return {
    draft,
    messages,
    available,
    checking,
    busy,
    action,
    actionTurnId,
    rolled,
    setOpen,
    older,
    submit,
  };
}
