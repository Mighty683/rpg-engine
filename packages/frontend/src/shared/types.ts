import type { Ref } from "vue";

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
