<script setup lang="ts">
import { tr } from "../../shared/i18n";
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
  useBreadcrumbs?: boolean;
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
  { label: tr("ui.classDetails"), value: "details", slot: "details" },
  { label: tr("ui.freeBenefits"), value: "benefits", slot: "benefits" },
  { label: tr("ui.skills2"), value: "skills", slot: "skills" },
];
</script>

<template>
  <section class="bg-default text-default" :class="{ 'p-section': !useBreadcrumbs }">
    <div
      class="mx-auto flex flex-col gap-section"
      :class="useBreadcrumbs ? 'max-w-6xl' : 'max-w-5xl'"
    >
      <header class="flex flex-wrap items-start justify-between gap-medium">
        <div>
          <p class="text-label text-muted">
            <template v-if="context === 'Game'">
              {{ tr("ui.value1FabulaUltima", { value1: gameName }) }}
            </template>
            <template v-else>{{ tr("ui.fabulaUltima2") }}</template>
          </p>
          <h1 class="text-heading font-semibold">
            {{
              {
                List: context === "Library" ? tr("ui.classLibrary") : tr("ui.gameClasses"),
                Create: tr("ui.createClass"),
                Copy: tr("ui.copyFromLibrary"),
                Character: tr("ui.characters"),
              }[screen] ??
              current?.name ??
              tr("ui.classDetails")
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
            >{{ context === "Library" ? tr("ui.gameClasses") : tr("ui.classLibrary") }}</UButton
          >
          <UButton
            v-if="screen === 'List' && context === 'Library'"
            data-testid="create-class"
            :disabled="!editable"
            @click="$emit('navigate', 'Create')"
            >{{ tr("ui.createClass") }}</UButton
          >
          <template v-else-if="screen === 'List'">
            <UButton
              v-if="canManage"
              data-testid="copy-from-library"
              :disabled="!editable"
              @click="$emit('navigate', 'Copy')"
              >{{ tr("ui.copyFromLibrary") }}</UButton
            >
            <UButton
              color="neutral"
              variant="outline"
              v-if="showCharacters"
              :to="charactersTo"
              data-testid="view-characters"
              @click="!charactersTo && $emit('navigate', 'Character')"
              >{{ tr("ui.characters") }}</UButton
            >
          </template>
          <UButton
            v-else-if="!useBreadcrumbs"
            color="neutral"
            variant="outline"
            data-testid="back-to-classes"
            @click="$emit('navigate', 'List')"
          >
            {{ tr("ui.backToClasses") }}
          </UButton>
        </div>
      </header>

      <template v-if="screen === 'List' || screen === 'Copy'">
        <p v-if="screen === 'Copy'" class="text-muted">
          {{ tr("ui.copyIntoValue1TheGameCopyIsIndependentOf", { value1: gameName }) }}
        </p>
        <p v-if="!entries.length" class="text-muted" data-testid="empty-class-list">
          {{
            screen === "Copy"
              ? tr("ui.createAClassInTheLibraryBeforeCopyingIt")
              : tr("ui.noClassesYet")
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
                >{{ tr("ui.copyClass") }}</UButton
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
                  >{{ tr("ui.viewClass") }}</UButton
                >
                <UButton
                  v-if="context === 'Game' && canManage"
                  color="neutral"
                  variant="outline"
                  :disabled="!actionsEnabled"
                  :data-testid="`save-to-library-${entry.id}`"
                  @click="$emit('saveToLibrary', entry.id)"
                  >{{ tr("ui.saveToLibrary") }}</UButton
                >
                <UButton
                  v-if="context === 'Game' && showRemoval && canManage"
                  color="error"
                  variant="outline"
                  :disabled="!actionsEnabled"
                  :data-testid="`remove-class-${entry.id}`"
                  @click="$emit('removeClass', entry.id)"
                  >{{ tr("ui.removeClass") }}</UButton
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
          :label="tr('ui.className')"
          data-testid="create-class-name"
          maxlength="100"
        />
        <UButton
          type="submit"
          :disabled="!editable || !newName.trim()"
          data-testid="add-library-class"
          >{{ tr("ui.addClass") }}</UButton
        >
      </form>

      <template v-else-if="screen === 'Details' && current">
        <p v-if="hasDraft" class="text-small text-muted" role="status">
          {{ tr("ui.completeTheDraftFieldsToSaveChanges") }}
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
                    ? tr("ui.libraryChangesDoNotUpdateExistingGameCopies")
                    : readOnlyDefinition
                      ? tr("ui.thisClassBelongsToThisGame")
                      : tr("ui.youAreEditingThisGameSCopy")
                }}
              </p>
              <LabeledInput
                :key="current.id"
                class="mt-medium max-w-xs"
                :label="tr('ui.name')"
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
                :label="tr('ui.description')"
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

      <p v-else-if="screen === 'Details'" role="status">{{ tr("ui.classUnavailable") }}</p>
      <slot v-else-if="screen === 'Character'" name="characters" />
    </div>
  </section>
</template>
