<script setup lang="ts">
import type { Account } from "./modules/auth/types";

import { useToast } from "@nuxt/ui/composables";
import { onMounted, onUnmounted, ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";
import AccountScreen from "./modules/auth/AccountScreen.vue";
import { authApi } from "./modules/auth/api";
import { account } from "./modules/auth/session";
import PrimaryNavigation from "./shared/components/PrimaryNavigation.vue";

const toast = useToast();
const client = useQueryClient();
const router = useRouter();
const loading = ref(true);
const sessionError = ref("");
const menuOpen = ref(false);

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
    <main v-else class="min-h-screen bg-default text-default">
      <header class="flex items-center gap-small border-b border-default p-medium">
        <UButton color="neutral" variant="outline" aria-label="Open menu" :aria-expanded="menuOpen" data-testid="open-navigation" @click="menuOpen = true">
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </UButton>
        <RouterLink to="/" class="font-semibold">RPG Engine</RouterLink>
      </header>
      <USlideover v-model:open="menuOpen" :title="account.username" side="left">
        <template #body>
          <div class="space-y-large">
            <PrimaryNavigation @navigate="menuOpen = false" />
            <div class="space-y-small border-t border-default pt-medium">
              <UButton variant="outline" color="error" data-testid="sign-out" @click="signOut">Sign out</UButton>
            </div>
          </div>
        </template>
      </USlideover>
      <UContainer class="py-page sm:py-page-wide"><RouterView :key="$route.fullPath" /></UContainer>
    </main>
  </UApp>
</template>
