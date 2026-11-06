import { expect, test, vi } from "vite-plus/test";
import { ref } from "vue";
import { useOptimisticSave } from "./useOptimisticSave";

type Snapshot = { value: number; revision: number };

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

test("coalesces edits and sends each batch from the last acknowledgement", async () => {
  const initial = ref<Snapshot>({ value: 0, revision: 0 });
  const first = deferred<Snapshot>();
  const second = deferred<Snapshot>();
  const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const state = useOptimisticSave({
    initial,
    apply: (snapshot, input: { value: number }) => ({ ...snapshot, value: input.value }),
    save,
    refresh: vi.fn(async () => ({ value: 0, revision: 0 })),
  });

  state.submit({ value: 1 });
  state.submit({ value: 2 });
  expect(state.displayed.value).toEqual({ value: 2, revision: 0 });
  expect(save).toHaveBeenCalledTimes(1);
  first.resolve({ value: 1, revision: 1 });
  await Promise.resolve();
  await Promise.resolve();
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1]?.[0]).toEqual({ value: 1, revision: 1 });
  second.resolve({ value: 2, revision: 2 });
  await Promise.resolve();
  expect(state.acknowledged.value).toEqual({ value: 2, revision: 2 });
});

test("rolls back known rejection and refreshes after an uncertain outcome", async () => {
  const initial = ref<Snapshot>({ value: 0, revision: 0 });
  const save = vi
    .fn()
    .mockRejectedValueOnce(Object.assign(new Error("invalid"), { status: 422 }))
    .mockRejectedValueOnce(new Error("connection lost"));
  const refresh = vi.fn(async () => ({ value: 5, revision: 4 }));
  const state = useOptimisticSave({
    initial,
    apply: (snapshot, input: { value: number }) => ({ ...snapshot, value: input.value }),
    save,
    refresh,
  });

  state.submit({ value: 3 });
  await flush();
  expect(state.displayed.value).toEqual({ value: 0, revision: 0 });
  expect(state.error.value?.status).toBe(422);
  state.submit({ value: 4 });
  await flush();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(state.paused.value).toBe(true);
  expect(state.acknowledged.value).toEqual({ value: 5, revision: 4 });
});

test("keeps an in-flight edit visible when a later edit targets another field", async () => {
  type RecordSnapshot = { name: string; theme: string; revision: number };
  const initial = ref<RecordSnapshot>({ name: "Old", theme: "Night", revision: 0 });
  const request = deferred<RecordSnapshot>();
  const followUp = deferred<RecordSnapshot>();
  const save = vi.fn().mockReturnValueOnce(request.promise).mockReturnValueOnce(followUp.promise);
  const state = useOptimisticSave({
    initial,
    apply: (snapshot, input: Partial<RecordSnapshot>) => ({ ...snapshot, ...input }),
    save,
    refresh: vi.fn(async () => initial.value),
  });

  state.submit({ name: "New" });
  state.submit({ theme: "Dawn" });
  expect(state.displayed.value).toEqual({ name: "New", theme: "Dawn", revision: 0 });
  request.resolve({ name: "New", theme: "Night", revision: 1 });
  await flush();
  expect(save).toHaveBeenCalledTimes(2);
  expect(state.displayed.value).toEqual({ name: "New", theme: "Dawn", revision: 1 });
  followUp.resolve({ name: "New", theme: "Dawn", revision: 2 });
  await flush();
  expect(state.displayed.value).toEqual({ name: "New", theme: "Dawn", revision: 2 });
});
