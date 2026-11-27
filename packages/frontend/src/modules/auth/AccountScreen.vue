<script setup lang="ts">
import { tr } from "../../shared/i18n";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
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
        ? tr("ui.tooManyAttemptsTryAgainLater")
        : mode.value === "login"
          ? tr("ui.couldNotSignInCheckYourUsernameAndPassword")
          : tr("ui.couldNotCreateTheAccountCheckYourDetailsAnd");
    const detail = (
      cause as { payload?: { error?: { message: string; fields?: Record<string, string> } } }
    ).payload?.error;
    toast.add({
      title: detail?.message ?? message,
      description: Object.values(detail?.fields ?? {}).join(" "),
      color: "error",
    });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen bg-default text-default flex items-center justify-center p-large">
    <section class="w-full max-w-md space-y-large">
      <h1 class="text-section font-semibold">
        {{ mode === "login" ? tr("ui.signIn") : tr("ui.createAnAccount") }}
      </h1>
      <form class="space-y-medium" @submit.prevent="submit">
        <LabeledInput
          :label="tr('ui.username')"
          id="username"
          v-model="username"
          name="username"
          autocomplete="username"
          required
          :disabled="busy"
          class="w-full"
          data-testid="auth-username"
        />
        <LabeledInput
          :label="tr('ui.password')"
          id="password"
          v-model="password"
          name="password"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          required
          :disabled="busy"
          class="w-full"
          data-testid="auth-password"
        />
        <UButton type="submit" :loading="busy" data-testid="auth-submit">{{
          mode === "login" ? tr("ui.signIn") : tr("ui.createAccount")
        }}</UButton>
      </form>
      <UButton
        color="neutral"
        variant="subtle"
        :disabled="busy"
        data-testid="auth-mode"
        @click="mode = mode === 'login' ? 'register' : 'login'"
      >
        {{ mode === "login" ? tr("ui.createAnAccount") : tr("ui.alreadyHaveAnAccountSignIn") }}
      </UButton>
    </section>
  </main>
</template>
