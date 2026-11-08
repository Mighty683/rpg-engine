<script setup lang="ts">
import { ref } from "vue";
const name = ref("Wayfarer");
function initialState() {
  return { saving: false, invalid: false };
}
</script>
<template>
  <Story title="Design system/Basic components/Form field" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <form class="space-y-medium" @submit.prevent>
            <fieldset :disabled="state.saving" class="space-y-medium">
              <UFormField
                label="Name"
                hint="A short descriptive name"
                :error="state.invalid ? 'Enter a name' : undefined"
                ><UInput v-model="name" class="w-full" /></UFormField
              ><UButton type="submit" :loading="state.saving">Save</UButton>
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
