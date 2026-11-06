import { useToast } from "@nuxt/ui/composables";
import { watch, type Ref } from "vue";

/** Notify after a query fails, including subsequent failed retries. */
export function useQueryErrorToast(query: { errorUpdatedAt: Ref<number> }, message: string) {
  const toast = useToast();
  watch(query.errorUpdatedAt, (updatedAt) => {
    if (updatedAt) toast.add({ title: message, color: "error" });
  }, { immediate: true });
}
