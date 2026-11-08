import type { Account } from "./types";
import { ref } from "vue";

/** The currently authenticated account, populated by the application shell. */
export const account = ref<Account | null>(null);
