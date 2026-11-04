<script setup lang="ts">
import { h, nextTick, onMounted, ref } from "vue";
import { useToast } from "@nuxt/ui/composables";

type System = { id: string; name: string };
type Game = { id: string; name: string; system: System; createdAt: string };
type ApiError = { error?: { fields?: Record<string, string>; message?: string } };

const toast = useToast();
const view = ref<"list" | "form">("list");
const games = ref<Game[]>([]);
const systems = ref<System[]>([]);
const listState = ref<"loading" | "ready" | "error">("loading");
const systemState = ref<"loading" | "ready" | "error">("loading");
const name = ref("");
const systemId = ref("");
const fields = ref<Record<string, string>>({});
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
    const response = await fetch("/api/games");
    if (!response.ok) throw new Error();
    games.value = (await response.json()).games;
    listState.value = "ready";
  } catch {
    listState.value = "error";
  }
}
async function loadSystems() {
  systemState.value = "loading";
  try {
    const response = await fetch("/api/rpg-systems");
    if (!response.ok) throw new Error();
    systems.value = (await response.json()).systems;
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
  name.value = "";
  systemId.value = "";
  fields.value = {};
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
async function submit() {
  fields.value = {};
  const trimmed = name.value.trim();
  if (!trimmed) fields.value.name = "Enter a game name";
  else if (Array.from(trimmed).length > 20) fields.value.name = "Use 20 characters or fewer";
  if (!systemId.value) fields.value.systemId = "Select an RPG system";
  if (Object.keys(fields.value).length) {
    await nextTick();
    (fields.value.name ? nameInput.value?.inputRef : systemInput.value?.triggerRef)?.focus();
    return;
  }
  saving.value = true;
  outcome.value = "";
  try {
    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, systemId: systemId.value }),
    });
    if (response.status === 400 || response.status === 422) {
      const data: ApiError = await response.json();
      fields.value = data.error?.fields ?? {};
      outcome.value = "failed";
      await nextTick();
      (fields.value.name
        ? nameInput.value?.inputRef
        : fields.value.systemId
          ? systemInput.value?.triggerRef
          : undefined
      )?.focus();
      return;
    }
    if (!response.ok) {
      outcome.value = "unknown";
      return;
    }
    const data: { game: Game } = await response.json();
    toast.add({
      title: h("span", { "data-testid": "game-created-toast" }, `Game created: ${data.game.name}.`),
      color: "success",
    });
    clearDraft();
    await showList();
  } catch {
    outcome.value = "unknown";
  } finally {
    saving.value = false;
  }
}
function checkGames() {
  checking.value = true;
  void showList();
}
onMounted(() => {
  void loadGames();
});
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <template v-if="view === 'list'">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h1 ref="listHeading" tabindex="-1" class="text-3xl font-semibold">Games</h1>
        <UButton v-if="!checking" data-testid="open-game-creation" @click="showForm"
          >Create game</UButton
        >
        <UButton v-else @click="showForm">Return to setup</UButton>
      </div>
      <p v-if="checking" role="status">
        Your setup is still available. A retry may create a duplicate.
      </p>
      <div aria-live="polite">
        <p v-if="listState === 'loading'">Loading games…</p>
        <div v-else-if="listState === 'error'" class="space-y-3">
          <p data-testid="games-load-error">Could not load games.</p>
          <UButton data-testid="retry-games" variant="outline" @click="loadGames">Retry</UButton>
        </div>
        <p v-else-if="games.length === 0" data-testid="games-empty" class="text-muted">
          No games yet. Create your first game.
        </p>
        <ul v-else class="divide-y divide-default rounded-lg border border-default">
          <li
            v-for="game in games"
            :key="game.id"
            data-testid="game-row"
            class="flex flex-wrap justify-between gap-2 p-4"
          >
            <span data-testid="game-row-name" class="font-medium">{{ game.name }}</span
            ><span data-testid="game-row-system" class="text-muted">{{ game.system.name }}</span>
          </li>
        </ul>
      </div>
    </template>
    <template v-else>
      <h1 class="text-3xl font-semibold">Create game</h1>
      <form class="space-y-6" novalidate @submit.prevent="submit">
        <fieldset :disabled="saving || discarding" class="space-y-5">
          <UFormField
            label="Game name"
            name="name"
            required
            :error="fields.name"
            hint="Maximum 20 characters."
          >
            <UInput
              id="game-name"
              data-testid="game-name"
              ref="nameInput"
              v-model="name"
              required
              class="w-full"
              @update:model-value="delete fields.name"
            />
          </UFormField>
          <UFormField
            label="RPG system"
            name="systemId"
            required
            :error="fields.systemId"
            description="The RPG system cannot be changed after the game is created."
          >
            <USelect
              id="system"
              data-testid="game-system"
              ref="systemInput"
              v-model="systemId"
              :items="systems"
              label-key="name"
              value-key="id"
              placeholder="Select a system"
              class="w-full"
              :disabled="systemState !== 'ready' || !systems.length"
              @update:model-value="delete fields.systemId"
            >
              <template #item-label="{ item }">
                <span :data-testid="`game-system-option-${item.id}`">{{ item.name }}</span>
              </template>
            </USelect>
            <div aria-live="polite" class="mt-2">
              <p v-if="systemState === 'loading'">Loading RPG systems…</p>
              <div v-else-if="systemState === 'error'" class="space-y-2">
                <p>Could not load RPG systems.</p>
                <UButton type="button" variant="outline" @click="loadSystems">Retry</UButton>
              </div>
              <p v-else-if="!systems.length">No RPG systems are available.</p>
            </div>
          </UFormField>
          <div role="status" aria-live="polite">
            <p v-if="saving">Creating game…</p>
            <p v-else-if="outcome === 'failed'">
              Could not create game. Your entries are unchanged.
            </p>
            <div v-else-if="outcome === 'unknown'" class="space-y-2">
              <p>
                We couldn't confirm whether the game was created. Check the games list before trying
                again.
              </p>
              <UButton type="button" variant="outline" @click="checkGames">Check games</UButton>
            </div>
          </div>
          <div class="flex flex-wrap gap-3">
            <UButton
              type="submit"
              data-testid="submit-game"
              :disabled="systemState !== 'ready' || !systemId"
              >Create game</UButton
            >
            <UButton type="button" variant="outline" @click="cancel">Cancel</UButton>
          </div>
        </fieldset>
      </form>
      <UModal v-model:open="discarding" title="Discard this game setup?" :close="false">
        <template #body>
          <div class="flex gap-3">
            <UButton type="button" @click="keepEditing">Keep editing</UButton>
            <UButton type="button" variant="outline" @click="discard">Discard</UButton>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
