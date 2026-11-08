<script setup lang="ts">
import type { ApiError, Game, System } from "./types";

import { h, nextTick, onMounted, ref } from "vue";
import ContentState from "../../shared/design-system/ContentState.vue";
import GameListEntry from "./GameListEntry.vue";
import { useField, useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { useToast } from "@nuxt/ui/composables";
import { useRouter } from "vue-router";

import { useGamesQuery, useSystemsQuery, useCreateGameMutation } from "./hooks";

const toast = useToast();
const router = useRouter();
const gamesQuery = useGamesQuery();
const systemsQuery = useSystemsQuery();
const createGameMutation = useCreateGameMutation();
const { t } = useI18n();
const {
  handleSubmit,
  resetForm,
  setErrors,
  errors: fields,
} = useForm({
  initialValues: { name: "", systemId: "" },
});
const { value: name } = useField<string>(
  "name",
  (value) => {
    const trimmed = value.trim();
    if (!trimmed) return t("games.nameRequired");
    return Array.from(trimmed).length <= 20 || t("games.nameTooLong");
  },
  { validateOnValueUpdate: false },
);
const { value: systemId } = useField<string>(
  "systemId",
  (value) => Boolean(value) || t("games.systemRequired"),
  { validateOnValueUpdate: false },
);
const view = ref<"list" | "form">("list");
const games = ref<Game[]>([]);
const systems = ref<System[]>([]);
const listState = ref<"loading" | "ready" | "error">("loading");
const systemState = ref<"loading" | "ready" | "error">("loading");
const saving = ref(false);
const outcome = ref<"" | "failed" | "unknown">("");
const checking = ref(false);
const discarding = ref(false);
const nameInput = ref<{ inputRef: HTMLInputElement }>();
const systemInput = ref<{ triggerRef: HTMLElement }>();
const listHeading = ref<HTMLElement>();

async function loadGames() {
  listState.value = "loading";
  try {
    const result = await gamesQuery.refetch();
    if (result.error) throw result.error;
    games.value = result.data?.games ?? [];
    listState.value = "ready";
  } catch {
    listState.value = "error";
    toast.add({ title: h("span", { "data-testid": "games-load-error-toast" }, t("games.loadError")), description: t("games.retry"), color: "error" });
  }
}
async function loadSystems() {
  systemState.value = "loading";
  try {
    const result = await systemsQuery.refetch();
    if (result.error) throw result.error;
    systems.value = result.data?.systems ?? [];
    systemState.value = "ready";
  } catch {
    systemState.value = "error";
    toast.add({ title: t("games.systemsError"), description: t("games.retry"), color: "error" });
  }
}
async function showForm() {
  view.value = "form";
  if (!checking.value) void loadSystems();
  await nextTick();
  nameInput.value?.inputRef?.focus();
}
async function showList() {
  view.value = "list";
  void loadGames();
  await nextTick();
  listHeading.value?.focus();
}
function clearDraft() {
  resetForm();
  outcome.value = "";
  checking.value = false;
}
function cancel() {
  if (name.value || systemId.value) {
    discarding.value = true;
    return;
  }
  clearDraft();
  void showList();
}
async function keepEditing() {
  discarding.value = false;
  await nextTick();
  nameInput.value?.inputRef?.focus();
}
function discard() {
  discarding.value = false;
  clearDraft();
  void showList();
}
const submit = handleSubmit(
  async (values) => {
    const trimmed = values.name.trim();
    saving.value = true;
    outcome.value = "";
    try {
      try {
        const data = await createGameMutation.mutateAsync({
          name: trimmed,
          systemId: values.systemId,
        });
        toast.add({
          title: h(
            "span",
            { "data-testid": "game-created-toast" },
            t("games.created", { name: data.game.name }),
          ),
          color: "success",
        });
        clearDraft();
        await router.push(`/games/${data.game.id}`);
        return;
      } catch (cause) {
        const failure = cause as Error & { status?: number; payload?: { error?: ApiError } };
        if (failure.status === 400 || failure.status === 422) {
          const messages = Object.values(failure.payload?.error?.fields ?? {});
          toast.add({ title: h("span", { "data-testid": "game-create-error-toast" }, t("games.createFailed")), description: messages.join(" ") || failure.payload?.error?.message, color: "error" });
          outcome.value = "failed";
          return;
        }
        outcome.value = "unknown";
        toast.add({ title: t("games.createUnknown"), color: "error" });
      }
    } catch {
      outcome.value = "unknown";
      toast.add({ title: t("games.createUnknown"), color: "error" });
    } finally {
      saving.value = false;
    }
  },
  async ({ errors }) => {
    await nextTick();
    (errors.name ? nameInput.value?.inputRef : systemInput.value?.triggerRef)?.focus();
  },
);
function checkGames() {
  checking.value = true;
  void showList();
}
onMounted(() => {
  void loadGames();
});
</script>

<template>
  <div class="max-w-2xl space-y-section">
    <template v-if="view === 'list'">
      <div class="flex flex-wrap items-center justify-between gap-large">
        <h1 ref="listHeading" tabindex="-1" class="text-heading font-semibold">
          {{ t("games.title") }}
        </h1>
        <UButton v-if="!checking" data-testid="open-game-creation" @click="showForm">{{
          t("games.create")
        }}</UButton>
        <UButton v-else @click="showForm">{{ t("games.returnToSetup") }}</UButton>
      </div>
      <p v-if="checking" role="status">
        {{ t("games.setupAvailable") }}
      </p>
      <p class="text-sm text-muted">{{ t("games.joinHint") }}</p>
      <div aria-live="polite">
        <ContentState v-if="listState === 'loading'" kind="loading">{{ t("games.loading") }}</ContentState>
        <ContentState v-else-if="listState === 'error'" kind="error" retry-test-id="retry-games" :retry-label="t('games.retry')" @retry="loadGames" />
        <ContentState v-else-if="games.length === 0" kind="empty" data-testid="games-empty">{{ t("games.empty") }}</ContentState>
        <ul v-else class="divide-y divide-default rounded-panel border border-default">
          <GameListEntry
            v-for="game in games"
            :key="game.id"
            :game="game"
            :system-label="t('games.rowSystem', { name: game.system.name })"
          />
        </ul>
      </div>
    </template>
    <template v-else>
      <h1 class="text-heading font-semibold">{{ t("games.create") }}</h1>
      <form class="space-y-section" novalidate @submit="submit">
        <fieldset :disabled="saving || discarding" class="space-y-field">
          <UFormField
            data-testid="game-name-field"
            :label="t('games.name')"
            name="name"
            required
            :error="fields.name"
            :hint="t('games.nameHint')"
          >
            <UInput
              id="game-name"
              data-testid="game-name"
              ref="nameInput"
              v-model="name"
              required
              class="w-full"
              @update:model-value="setErrors({ name: undefined })"
            />
          </UFormField>
          <UFormField
            :label="t('games.system')"
            name="systemId"
            required
            :error="fields.systemId"
            :description="t('games.systemDescription')"
          >
            <USelect
              id="system"
              data-testid="game-system"
              ref="systemInput"
              v-model="systemId"
              :items="systems"
              label-key="name"
              value-key="id"
              :placeholder="t('games.systemPlaceholder')"
              class="w-full"
              :disabled="systemState !== 'ready' || !systems.length"
              @update:model-value="setErrors({ systemId: undefined })"
            >
              <template #item-label="{ item }">
                <span :data-testid="`game-system-option-${item.id}`">{{ item.name }}</span>
              </template>
            </USelect>
            <div aria-live="polite" class="mt-small">
              <p v-if="systemState === 'loading'">{{ t("games.systemsLoading") }}</p>
              <div v-else-if="systemState === 'error'" class="space-y-small">
                <UButton type="button" color="neutral" variant="outline" @click="loadSystems">{{
                  t("games.retry")
                }}</UButton>
              </div>
              <p v-else-if="!systems.length">{{ t("games.systemsEmpty") }}</p>
            </div>
          </UFormField>
          <div role="status" aria-live="polite">
            <p v-if="saving">{{ t("games.creating") }}</p>
            <div v-else-if="outcome === 'unknown'" class="space-y-small">
              <UButton type="button" color="neutral" variant="outline" @click="checkGames">{{
                t("games.checkGames")
              }}</UButton>
            </div>
          </div>
          <div class="flex flex-wrap gap-medium">
            <UButton
              type="submit"
              data-testid="submit-game"
              :disabled="systemState !== 'ready' || !systemId"
              >{{ t("games.create") }}</UButton
            >
            <UButton type="button" color="neutral" variant="outline" @click="cancel">{{
              t("games.cancel")
            }}</UButton>
          </div>
        </fieldset>
      </form>
      <UModal v-model:open="discarding" :title="t('games.discardTitle')" :close="false">
        <template #body>
          <div class="flex gap-medium">
            <UButton type="button" @click="keepEditing">{{ t("games.keepEditing") }}</UButton>
            <UButton type="button" color="neutral" variant="outline" @click="discard">{{
              t("games.discard")
            }}</UButton>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
