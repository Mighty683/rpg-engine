<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
import LabeledInput from "../../../../shared/design-system/base/LabeledInput.vue";
const value = defineModel<string>({ required: true });
</script>

<template>
  <LabeledInput
    class="theme-field self-end"
    :label="tr('ui.theme')"
    data-testid="character-theme"
    v-model="value"
    :placeholder="tr('ui.hopeJustice')"
  />
</template>
<style scoped>
@media (max-width: 640px) {
  .theme-field {
    grid-column: 1 / -1;
  }
}
</style>
