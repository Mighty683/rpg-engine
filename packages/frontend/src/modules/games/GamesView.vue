<script setup lang="ts">
import { h, nextTick, onMounted, ref } from "vue";
import InteractiveCard from "../../shared/design-system/InteractiveCard.vue";
import { useField, useForm } from "vee-validate";
import { useI18n } from "vue-i18n";
import { useToast } from "@nuxt/ui/composables";
import type { Game, System } from "../../shared/api";
import { useGamesQuery, useSystemsQuery, useCreateGameMutation } from "./hooks";
type ApiError = { fields?: Record<string, string>; message?: string };

const toast = useToast();
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
        await showList();
        return;
      } catch (cause) {
        const failure = cause as Error & { status?: number; payload?: { error?: ApiError } };
        if (failure.status === 400 || failure.status === 422) {
          setErrors(failure.payload?.error?.fields ?? {});
          outcome.value = "failed";
          return;
        }
        outcome.value = "unknown";
      }
    } catch {
      outcome.value = "unknown";
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
      <div aria-live="polite">
        <p v-if="listState === 'loading'">{{ t("games.loading") }}</p>
        <div v-else-if="listState === 'error'" class="space-y-medium">
          <p data-testid="games-load-error">{{ t("games.loadError") }}</p>
          <UButton data-testid="retry-games" color="neutral" variant="outline" @click="loadGames">{{
            t("games.retry")
          }}</UButton>
        </div>
        <p v-else-if="games.length === 0" data-testid="games-empty" class="text-muted">
          {{ t("games.empty") }}
        </p>
        <ul v-else class="divide-y divide-default rounded-panel border border-default">
          <li v-for="game in games" :key="game.id" data-testid="game-row">
            <InteractiveCard :to="`/games/${game.id}`" data-testid="game-row-link">
              <span class="flex min-w-0 flex-col">
                <span data-testid="game-row-name" class="font-medium">{{ game.name }}</span>
                <span data-testid="game-row-system" class="text-sm text-muted">{{
                  t("games.rowSystem", { name: game.system.name })
                }}</span>
              </span>
            </InteractiveCard>
          </li>
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
                <p>{{ t("games.systemsError") }}</p>
                <UButton type="button" color="neutral" variant="outline" @click="loadSystems">{{
                  t("games.retry")
                }}</UButton>
              </div>
              <p v-else-if="!systems.length">{{ t("games.systemsEmpty") }}</p>
            </div>
          </UFormField>
          <div role="status" aria-live="polite">
            <p v-if="saving">{{ t("games.creating") }}</p>
            <p v-else-if="outcome === 'failed'">
              {{ t("games.createFailed") }}
            </p>
            <div v-else-if="outcome === 'unknown'" class="space-y-small">
              <p>
                {{ t("games.createUnknown") }}
              </p>
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
