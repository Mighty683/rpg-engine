import { computed, ref, type Ref } from "vue";

export type SaveError = Error & {
  code?: string;
  status?: number;
};

export type OptimisticSaveOptions<TSnapshot, TInput> = {
  initial?: Ref<TSnapshot | null>;
  apply: (snapshot: TSnapshot, input: TInput) => TSnapshot;
  save: (snapshot: TSnapshot, input: TInput) => Promise<TSnapshot>;
  refresh: () => Promise<TSnapshot>;
  merge?: (previous: TInput, next: TInput) => TInput;
  isKnownRejection?: (error: SaveError) => boolean;
};

/**
 * Keeps a server snapshot separate from edits shown to the user while one
 * conditional save is in flight. Later edits are coalesced and dispatched
 * only after the acknowledgement for the preceding revision arrives.
 */
export function useOptimisticSave<TSnapshot, TInput>(
  options: OptimisticSaveOptions<TSnapshot, TInput>,
) {
  const acknowledged = ref<TSnapshot | null>(
    options.initial?.value ?? null,
  ) as Ref<TSnapshot | null>;
  const displayed = ref<TSnapshot | null>(options.initial?.value ?? null) as Ref<TSnapshot | null>;
  const pending = ref<TInput | null>(null) as Ref<TInput | null>;
  const saving = ref(false);
  const paused = ref(false);
  const error = ref<SaveError | null>(null);
  let inFlight: TInput | null = null;

  function setSnapshot(snapshot: TSnapshot) {
    acknowledged.value = snapshot;
    displayed.value = snapshot;
    if (options.initial) options.initial.value = snapshot;
  }

  function queue(input: TInput) {
    pending.value = pending.value && options.merge ? options.merge(pending.value, input) : input;
  }

  function applyPending() {
    if (!acknowledged.value) {
      displayed.value = acknowledged.value;
      return;
    }
    let next = acknowledged.value as TSnapshot;
    if (inFlight) next = options.apply(next, inFlight);
    if (pending.value) next = options.apply(next, pending.value);
    displayed.value = next;
  }

  async function dispatch() {
    if (saving.value || paused.value || !acknowledged.value || !pending.value) return;
    const base = acknowledged.value;
    const input = pending.value;
    pending.value = null;
    inFlight = input;
    saving.value = true;
    error.value = null;
    try {
      const result = await options.save(base, input);
      acknowledged.value = result as TSnapshot;
      if (options.initial) options.initial.value = result;
      inFlight = null;
      if (pending.value) {
        applyPending();
        saving.value = false;
        await dispatch();
      } else {
        displayed.value = result as TSnapshot;
      }
    } catch (cause) {
      const failure = (cause instanceof Error ? cause : new Error("Save failed")) as SaveError;
      error.value = failure;
      const known =
        options.isKnownRejection?.(failure) ?? (failure.status === 400 || failure.status === 422);
      inFlight = null;
      if (known) {
        // Keep newer input, but remove the rejected batch from the optimistic view.
        applyPending();
        saving.value = false;
        await dispatch();
      } else {
        pending.value = null;
        paused.value = true;
        try {
          setSnapshot(await options.refresh());
          error.value = failure;
        } catch (refreshCause) {
          error.value = (refreshCause instanceof Error ? refreshCause : failure) as SaveError;
        }
      }
    } finally {
      saving.value = false;
    }
  }

  function submit(input: TInput) {
    if (paused.value || !acknowledged.value) return;
    queue(input);
    applyPending();
    void dispatch();
  }

  async function retry() {
    paused.value = false;
    error.value = null;
    try {
      setSnapshot(await options.refresh());
    } catch (cause) {
      paused.value = true;
      error.value = (cause instanceof Error ? cause : new Error("Refresh failed")) as SaveError;
      return;
    }
    await dispatch();
  }

  return {
    acknowledged,
    displayed,
    pending: computed(() => pending.value),
    saving: computed(() => saving.value),
    paused: computed(() => paused.value),
    error: computed(() => error.value),
    submit,
    retry,
    setSnapshot,
  };
}
