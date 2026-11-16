<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import type { Account } from "./modules/auth/types";

import { useToast } from "@nuxt/ui/composables";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";
import AccountScreen from "./modules/auth/AccountScreen.vue";
import { useApiServices } from "./shared/api-services";
import { account } from "./modules/auth/session";
import PrimaryNavigation from "./shared/components/PrimaryNavigation.vue";

const toast = useToast();
const { auth: authApi } = useApiServices();
const client = useQueryClient();
const router = useRouter();
const loading = ref(true);
const sessionError = ref("");
const accountItems = computed<DropdownMenuItem[]>(() => [
  { label: account.value?.username ?? "", type: "label" },
  { label: "Sign out", color: "error", "data-testid": "sign-out", onSelect: signOut },
]);

async function setAccount(next: Account | null) {
  account.value = null;
  await client.cancelQueries();
  client.clear();
  account.value = next;
}

async function loadSession() {
  loading.value = true;
  sessionError.value = "";
  try {
    await setAccount((await authApi.current()).account);
  } catch (cause) {
    if ((cause as { status?: number }).status === 401) await setAccount(null);
    else {
      sessionError.value = "Could not check your session. Please try again.";
      toast.add({ title: sessionError.value, color: "error" });
    }
  } finally {
    loading.value = false;
  }
}

async function signOut() {
  sessionError.value = "";
  try {
    await authApi.logout();
    await setAccount(null);
    await router.push("/");
  } catch {
    toast.add({ title: "Could not sign out. Please try again.", color: "error" });
  }
}

function sessionExpired() {
  void setAccount(null);
}

onMounted(() => {
  window.addEventListener("session-expired", sessionExpired);
  void loadSession();
});
onUnmounted(() => window.removeEventListener("session-expired", sessionExpired));
</script>

<template>
  <UApp>
    <div v-if="loading" class="p-large" role="status">Loading account…</div>
    <div v-else-if="sessionError && !account" class="p-large" role="alert">
      <UButton @click="loadSession">Try again</UButton>
    </div>
    <AccountScreen v-else-if="!account" @authenticated="setAccount" />
    <div v-else class="min-h-screen bg-default text-default">
      <header
        class="grid grid-cols-[1fr_auto] items-center gap-x-small border-b border-default px-large sm:grid-cols-[auto_1fr_auto] sm:gap-x-section"
      >
        <RouterLink to="/" class="col-start-1 row-start-1 font-semibold">RPG Engine</RouterLink>
        <PrimaryNavigation
          class="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
        />
        <UDropdownMenu :items="accountItems" :content="{ align: 'end' }">
          <UButton
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-chevron-down"
            class="col-start-2 row-start-1 min-h-page justify-self-end sm:col-start-3"
            data-testid="open-account-menu"
            >Account</UButton
          >
        </UDropdownMenu>
      </header>
      <UContainer as="main" class="py-page sm:py-page-wide">
        <RouterView :key="$route.fullPath" />
      </UContainer>
    </div>
  </UApp>
</template>
