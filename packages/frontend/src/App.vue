<script setup lang="ts">
import { useToast } from "@nuxt/ui/composables";
import { onMounted, onUnmounted, ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";
import AccountScreen from "./modules/auth/AccountScreen.vue";
import { authApi, type Account } from "./modules/auth/api";
import { account } from "./modules/auth/session";

const toast = useToast();
const client = useQueryClient();
const router = useRouter();
const loading = ref(true);
const sessionError = ref("");

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
      <header class="flex items-center justify-between gap-small border-b border-default p-medium">
        <RouterLink to="/" class="font-semibold">RPG Engine</RouterLink>
        <div class="flex items-center gap-small">
          <span>{{ account.username }}</span>
          <UButton variant="outline" color="neutral" data-testid="sign-out" @click="signOut">Sign out</UButton>
        </div>
      </header>
      <UContainer class="py-page sm:py-page-wide"><RouterView :key="$route.fullPath" /></UContainer>
    </main>
  </UApp>
</template>
