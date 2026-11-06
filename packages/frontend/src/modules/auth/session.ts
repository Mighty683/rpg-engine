import { ref } from "vue";
import type { Account } from "./api";

/** The currently authenticated account, populated by the application shell. */
export const account = ref<Account | null>(null);
