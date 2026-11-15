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
}>();
defineEmits<{
  navigate: [screen: string];
  switchContext: [context: string];
  open: [id: string];
  create: [name: string];
  copy: [id: string];
  removeClass: [id: string];
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
  <main class="min-h-screen bg-default p-section text-default">
    <div class="mx-auto flex max-w-5xl flex-col gap-section">
      <header class="flex flex-wrap items-start justify-between gap-medium">
        <div>
          <p class="text-label text-muted">
            {{ context === "Library" ? "LIBRARY" : "GAME / THE CRYSTAL ROAD" }} · FABULA ULTIMA
          </p>
          <h1 class="text-heading font-semibold">
            {{
              {
                List: "Classes",
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
            v-if="screen === 'List' || screen === 'Copy'"
            color="neutral"
            variant="outline"
            data-testid="switch-class-context"
            @click="$emit('switchContext', context === 'Library' ? 'Game' : 'Library')"
            >{{ context === "Library" ? "Game classes" : "Class library" }}</UButton
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
              data-testid="copy-from-library"
              :disabled="!editable"
              @click="$emit('navigate', 'Copy')"
              >Copy from library</UButton
            >
            <UButton
              color="neutral"
              variant="outline"
              data-testid="view-characters"
              @click="$emit('navigate', 'Character')"
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
          Copy into The Crystal Road. The game copy is independent of the library.
        </p>
        <p v-if="!entries.length" class="text-muted" data-testid="empty-class-list">
          {{
            screen === "Copy"
              ? "Create a class in the library before copying it into this game."
              : "No classes yet."
          }}
        </p>
        <SurfaceCard v-for="entry in entries" :key="entry.id">
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
                  v-if="context === 'Game'"
                  color="error"
                  variant="outline"
                  :disabled="!editable"
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

      <UTabs
        v-else-if="screen === 'Details' && current"
        v-model="activeTab"
        :items="editorTabs"
        :ui="{ content: 'mt-medium' }"
      >
        <template #default="{ item }"
          ><span :data-testid="`class-tab-${item.value}`">{{ item.label }}</span></template
        >
        <template #details>
          <SurfaceCard>
            <p class="text-muted">
              {{
                context === "Library"
                  ? "Library changes do not update existing game copies."
                  : "You are editing this game’s copy."
              }}
            </p>
            <LabeledInput
              :key="current.id"
              class="mt-medium max-w-xs"
              label="Name"
              :model-value="current.name"
              :readonly="!editable"
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
              :readonly="!editable"
              data-testid="class-description"
              @update:model-value="$emit('updateClass', { description: String($event) })"
            />
          </SurfaceCard>
        </template>
        <template #benefits><slot name="free-benefits" /></template>
        <template #skills><slot name="skills" /></template>
      </UTabs>

      <slot v-else-if="screen === 'Character'" name="characters" />
    </div>
  </main>
</template>
