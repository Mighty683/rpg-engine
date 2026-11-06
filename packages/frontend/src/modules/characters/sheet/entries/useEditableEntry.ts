import { ref, watch, type Ref } from "vue";
import type { NamedEntry } from "../types";

/** Keep edits local to a card and publish complete updates to its owner. */
export function useEditableEntry(
  source: () => NamedEntry,
  update: (entry: NamedEntry) => void,
): Ref<NamedEntry> {
  const copy = (entry: NamedEntry) => JSON.parse(JSON.stringify(entry)) as NamedEntry;
  const draft = ref(copy(source())) as Ref<NamedEntry>;
  watch(
    source,
    (entry) => {
      if (JSON.stringify(entry) !== JSON.stringify(draft.value)) draft.value = copy(entry);
    },
    { deep: true },
  );
  watch(
    draft,
    (entry) => {
      if (JSON.stringify(entry) !== JSON.stringify(source())) update(copy(entry));
    },
    { deep: true },
  );
  return draft;
}
