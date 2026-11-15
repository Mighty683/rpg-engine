import { inject, type InjectionKey } from "vue";
import type { ProgressionApi } from "./types";
export const progressionApiKey: InjectionKey<ProgressionApi> = Symbol("class-progression-api");
export function useProgressionApi(): ProgressionApi {
  const api = inject(progressionApiKey);
  if (!api) throw new Error("Class progression API must be explicitly provided");
  return api;
}
