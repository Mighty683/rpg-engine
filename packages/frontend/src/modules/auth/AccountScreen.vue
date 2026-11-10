<script setup lang="ts">
import type { Account } from "./types";

import { useToast } from "@nuxt/ui/composables";
import { ref } from "vue";
import { useApiServices } from "../../shared/api-services";

const { auth: authApi } = useApiServices();

const emit = defineEmits<{ authenticated: [account: Account] }>();
const mode = ref<"login" | "register">("login");
const username = ref("");
const password = ref("");
const toast = useToast();
const busy = ref(false);

async function submit() {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = await authApi[mode.value](username.value, password.value);
    password.value = "";
    emit("authenticated", result.account);
  } catch (cause) {
    const status = (cause as { status?: number }).status;
    const message =
      status === 429
        ? "Too many attempts. Try again later."
        : mode.value === "login"
          ? "Could not sign in. Check your username and password."
          : "Could not create the account. Check your details and try again.";
    toast.add({ title: message, color: "error" });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen bg-default text-default flex items-center justify-center p-large">
    <section class="w-full max-w-md space-y-large">
      <h1 class="text-2xl font-semibold">
        {{ mode === "login" ? "Sign in" : "Create an account" }}
      </h1>
      <form class="space-y-medium" @submit.prevent="submit">
        <div class="space-y-small">
          <label for="username" class="block">Username</label>
          <UInput
            id="username"
            v-model="username"
            name="username"
            autocomplete="username"
            required
            class="w-full"
            data-testid="auth-username"
          />
        </div>
        <div class="space-y-small">
          <label for="password" class="block">Password</label>
          <UInput
            id="password"
            v-model="password"
            name="password"
            type="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            required
            class="w-full"
            data-testid="auth-password"
          />
        </div>
        <UButton type="submit" :loading="busy" data-testid="auth-submit">{{
          mode === "login" ? "Sign in" : "Create account"
        }}</UButton>
      </form>
      <UButton variant="link" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === "login" ? "Create an account" : "Already have an account? Sign in" }}
      </UButton>
    </section>
  </main>
</template>
