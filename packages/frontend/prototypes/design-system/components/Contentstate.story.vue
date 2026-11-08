<script setup lang="ts">
import ContentState from "../../../src/shared/design-system/ContentState.vue";

function initialState() {
  return { kind: "loading" as "loading" | "empty" | "error" };
}
</script>
<template>
  <Story title="Design system/Components/Content state" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <ContentState :kind="state.kind" @retry="state.kind = 'loading'">{{
            state.kind === "loading"
              ? "Loading…"
              : state.kind === "empty"
                ? "Nothing here yet."
                : "Could not load content."
          }}</ContentState>
        </div></UApp
      >
    </template>
    <template #controls="{ state }"
      ><HstSelect v-model="state.kind" title="State" :options="['loading', 'empty', 'error']"
    /></template>
  </Story>
</template>
