<script setup lang="ts">
import { tr } from "../../shared/i18n";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import type { EditDifference } from "./types";
defineProps<{
  profile?: string;
  diff: EditDifference[];
  busy: boolean;
  notice: string;
  accept(): Promise<void>;
  dismiss(): void;
}>();
</script>
<template>
  <section
    :aria-label="tr('ui.reviewProfileEdit')"
    class="mt-tight w-full space-y-tight rounded-panel border border-default p-small"
  >
    <h3 class="font-semibold">
      {{ tr("ui.reviewEdit") }}<span v-if="profile"> · {{ profile }}</span>
    </h3>
    <p v-if="notice" role="status" data-testid="agent-edit-notice">{{ notice }}</p>
    <ul v-if="diff.length" data-testid="agent-edit-diff">
      <li v-for="row in diff" :key="row.field" class="whitespace-pre-wrap break-words">
        <strong>{{ row.field }}</strong> · {{ row.oldValue ?? tr("ui.none") }} →
        {{ row.newValue ?? tr("ui.none") }}
      </li>
    </ul>
    <SkeletonRegion
      v-else-if="busy && !profile"
      :label="tr('ui.loadingChanges')"
      class="space-y-tight"
      ><SkeletonBlock class="h-4 w-4/5" /><SkeletonBlock class="h-4 w-2/3"
    /></SkeletonRegion>
    <p v-else-if="!busy && profile">{{ tr("ui.theSavedValuesAlreadyMatchThisProposal") }}</p>
    <div class="flex justify-end gap-small">
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        :disabled="busy"
        data-testid="agent-cancel-edit"
        @click="dismiss"
        >{{ tr("games.cancel") }}</UButton
      >
      <UButton
        size="xs"
        :loading="busy"
        :disabled="busy || !diff.length"
        data-testid="agent-accept-edit"
        @click="accept"
        >{{ tr("ui.acceptEdit") }}</UButton
      >
    </div>
  </section>
</template>
