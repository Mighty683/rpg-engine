<script setup lang="ts">
import { ref } from "vue";
import SurfaceCard from "../../shared/design-system/base/SurfaceCard.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import type { ClassDefinition } from "./types";

defineProps<{
  screen: string;
  context: string;
  entries: ClassDefinition[];
  current?: ClassDefinition;
  editable: boolean;
  definitionEditable: boolean;
  readOnlyDefinition?: boolean;
  canManage: boolean;
  gameName?: string;
  contextTo?: string;
  returnTo?: string;
  charactersTo?: string;
  showRemoval?: boolean;
  showCharacters?: boolean;
  actionsEnabled?: boolean;
  hasDraft?: boolean;
}>();
defineEmits<{
  navigate: [screen: string];
  switchContext: [context: string];
  open: [id: string];
  create: [name: string];
  copy: [id: string];
  removeClass: [id: string];
  saveToLibrary: [id: string];
  updateClass: [change: Partial<Pick<ClassDefinition, "name" | "description">>];
}>();

const activeTab = ref("details");
const newName = ref("");
const editorTabs = [
  { label: "Class details", value: "details", slot: "details" },
  { label: "Free benefits", value: "benefits", slot: "benefits" },
  { label: "Skills", value: "skills", slot: "skills" },
];
</script>

<template>
  <section class="bg-default p-section text-default">
    <div class="mx-auto flex max-w-5xl flex-col gap-section">
      <header class="flex flex-wrap items-start justify-between gap-medium">
        <div>
          <p class="text-label text-muted">
            <template v-if="context === 'Game'">
              <ULink
                v-if="returnTo"
                :to="returnTo"
                class="underline-offset-4 hover:text-highlighted hover:underline"
                data-testid="return-from-classes"
                >{{ gameName ?? "Game table" }}</ULink
              >
              <span v-else>{{ gameName }}</span> · Fabula Ultima
            </template>
            <template v-else>Fabula Ultima</template>
          </p>
          <h1 class="text-heading font-semibold">
            {{
              {
                List: context === "Library" ? "Class library" : "Game classes",
                Create: "Create class",
                Copy: "Copy from library",
                Character: "Characters",
              }[screen] ??
              current?.name ??
              "Class details"
            }}
          </h1>
        </div>
        <div class="flex flex-wrap gap-small">
          <UButton
            v-if="(screen === 'List' || screen === 'Copy') && contextTo"
            :to="contextTo"
            color="neutral"
            variant="outline"
            data-testid="switch-class-context"
            >{{ context === "Library" ? "Back to game classes" : "Class library" }}</UButton
          >
          <UButton
            v-if="screen === 'List' && context === 'Library'"
            data-testid="create-class"
            :disabled="!editable"
            @click="$emit('navigate', 'Create')"
            >Create class</UButton
          >
          <template v-else-if="screen === 'List'">
            <UButton
              v-if="canManage"
              data-testid="copy-from-library"
              :disabled="!editable"
              @click="$emit('navigate', 'Copy')"
              >Copy from library</UButton
            >
            <UButton
              color="neutral"
              variant="outline"
              v-if="showCharacters"
              :to="charactersTo"
              data-testid="view-characters"
              @click="!charactersTo && $emit('navigate', 'Character')"
              >Characters</UButton
            >
          </template>
          <UButton
            v-else
            color="neutral"
            variant="outline"
            data-testid="back-to-classes"
            @click="$emit('navigate', 'List')"
          >
            Back to classes
          </UButton>
        </div>
      </header>

      <template v-if="screen === 'List' || screen === 'Copy'">
        <p v-if="screen === 'Copy'" class="text-muted">
          Copy into {{ gameName }}. The game copy is independent of the library.
        </p>
        <p v-if="!entries.length" class="text-muted" data-testid="empty-class-list">
          {{
            screen === "Copy"
              ? "Create a class in the library before copying it into this game."
              : "No classes yet."
          }}
        </p>
        <SurfaceCard v-for="entry in entries" :key="entry.id" data-testid="class-catalog-entry">
          <div class="flex flex-wrap items-center justify-between gap-medium">
            <div>
              <h2 class="text-section font-semibold">{{ entry.name }}</h2>
              <p v-if="entry.description" class="text-muted">{{ entry.description }}</p>
            </div>
            <div class="flex flex-wrap gap-small">
              <UButton
                v-if="screen === 'Copy'"
                :disabled="!editable"
                :data-testid="`copy-class-${entry.id}`"
                @click="$emit('copy', entry.id)"
                >Copy class</UButton
              >
              <template v-else>
                <UButton
                  color="neutral"
                  variant="subtle"
                  :data-testid="`view-class-${entry.id}`"
                  @click="
                    activeTab = 'details';
                    $emit('open', entry.id);
                  "
                  >View class</UButton
                >
                <UButton
                  v-if="context === 'Game' && canManage"
                  color="neutral"
                  variant="outline"
                  :disabled="!actionsEnabled"
                  :data-testid="`save-to-library-${entry.id}`"
                  @click="$emit('saveToLibrary', entry.id)"
                  >Save to library</UButton
                >
                <UButton
                  v-if="context === 'Game' && showRemoval && canManage"
                  color="error"
                  variant="outline"
                  :disabled="!actionsEnabled"
                  :data-testid="`remove-class-${entry.id}`"
                  @click="$emit('removeClass', entry.id)"
                  >Remove class</UButton
                >
              </template>
            </div>
          </div>
        </SurfaceCard>
      </template>

      <form
        v-else-if="screen === 'Create'"
        class="flex flex-wrap items-end gap-small"
        @submit.prevent="
          $emit('create', newName.trim());
          newName = '';
          activeTab = 'details';
        "
      >
        <LabeledInput
          v-model="newName"
          label="Class name"
          data-testid="create-class-name"
          maxlength="100"
        />
        <UButton
          type="submit"
          :disabled="!editable || !newName.trim()"
          data-testid="add-library-class"
          >Add class</UButton
        >
      </form>

      <template v-else-if="screen === 'Details' && current">
        <p v-if="hasDraft" class="text-small text-muted" role="status">
          Complete the draft fields to save changes.
        </p>
        <UTabs v-model="activeTab" :items="editorTabs" :ui="{ content: 'mt-medium' }">
          <template #default="{ item }"
            ><span :data-testid="`class-tab-${item.value}`">{{ item.label }}</span></template
          >
          <template #details>
            <SurfaceCard>
              <p class="text-muted">
                {{
                  context === "Library"
                    ? "Library changes do not update existing game copies."
                    : readOnlyDefinition
                      ? "This class belongs to this game."
                      : "You are editing this game’s copy."
                }}
              </p>
              <LabeledInput
                :key="current.id"
                class="mt-medium max-w-xs"
                label="Name"
                :model-value="current.name"
                :readonly="!definitionEditable"
                data-testid="class-name"
                @update:model-value="
                  String($event).trim() && $emit('updateClass', { name: String($event) })
                "
              />
              <LabeledInput
                :key="`${current.id}-description`"
                class="mt-medium"
                label="Description"
                multiline
                :model-value="current.description"
                :readonly="!definitionEditable"
                data-testid="class-description"
                @update:model-value="$emit('updateClass', { description: String($event) })"
              />
            </SurfaceCard>
          </template>
          <template #benefits><slot name="free-benefits" /></template>
          <template #skills><slot name="skills" /></template>
        </UTabs>
      </template>

      <slot v-else-if="screen === 'Character'" name="characters" />
    </div>
  </section>
</template>
