/** API dependency boundary shared by production composition, tests, and prototypes. */
import { inject, type InjectionKey } from "vue";
import type { ApiServices } from "./types";
export type { ApiServices } from "./types";

export const apiServicesKey: InjectionKey<ApiServices> = Symbol("api-services");

export function useApiServices(): ApiServices {
  const services = inject(apiServicesKey);
  if (!services)
    throw new Error("API services must be provided by the application composition root");
  return services;
}
