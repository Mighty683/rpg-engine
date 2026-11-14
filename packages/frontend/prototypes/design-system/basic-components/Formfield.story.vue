<script setup lang="ts">
import { ref } from "vue";
import LabeledSelect from "../../../src/shared/design-system/base/LabeledSelect.vue";
import LabeledInput from "../../../src/shared/design-system/base/LabeledInput.vue";
const name = ref("Wayfarer");
const notes = ref("");
const level = ref(5);
const system = ref("fabula-ultima");
function initialState() {
  return { saving: false, invalid: false };
}
</script>
<template>
  <Story title="Design system/Base/Form field" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <form class="space-y-medium" @submit.prevent>
            <p class="text-muted">
              Default: medium controls; label spacing uses the input-label token (4px). Keep short
              fields compact.
            </p>
            <fieldset :disabled="state.saving" class="space-y-medium">
              <LabeledInput
                v-model="name"
                label="Name"
                hint="A short descriptive name"
                :error="state.invalid ? 'Enter a name' : undefined"
                class="max-w-xs"
              />
              <LabeledInput
                v-model="level"
                label="Level"
                type="number"
                :min="1"
                class="w-24"
                :disabled="state.saving"
              />
              <LabeledInput
                v-model="notes"
                label="Notes"
                multiline
                hint="Optional"
                class="max-w-md"
                :disabled="state.saving"
              />
              <LabeledSelect
                label="System"
                v-model="system"
                :items="[{ label: 'Fabula Ultima', value: 'fabula-ultima' }]"
                :disabled="state.saving"
              />
              <LabeledInput
                label="Read-only value"
                model-value="Shared with your party"
                readonly
                class="max-w-xs"
              />
              <UButton type="submit" :loading="state.saving">Save</UButton>
            </fieldset>
          </form>
        </div></UApp
      >
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.saving" title="Saving" /><HstCheckbox
        v-model="state.invalid"
        title="Invalid"
    /></template>
  </Story>
</template>
