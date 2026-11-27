<script setup lang="ts">
import ContentState from "../../../src/shared/design-system/base/ContentState.vue";
import SkeletonBlock from "../../../src/shared/design-system/base/SkeletonBlock.vue";
import SkeletonRegion from "../../../src/shared/design-system/base/SkeletonRegion.vue";

function initialState() {
  return { kind: "loading" as "loading" | "empty" | "error" };
}
</script>
<template>
  <Story title="Design system/Base/Content state" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <SkeletonRegion
            v-if="state.kind === 'loading'"
            label="Loading…"
            class="max-w-md space-y-small"
          >
            <SkeletonBlock class="h-6 w-1/3" /><SkeletonBlock class="h-4" /><SkeletonBlock
              class="h-4 w-2/3"
            />
          </SkeletonRegion>
          <ContentState v-else :kind="state.kind" @retry="state.kind = 'loading'">{{
            state.kind === "empty" ? "Nothing here yet." : "Could not load content."
          }}</ContentState>
        </div></UApp
      >
    </template>
    <template #controls="{ state }"
      ><HstSelect v-model="state.kind" title="State" :options="['loading', 'empty', 'error']"
    /></template>
  </Story>
</template>
