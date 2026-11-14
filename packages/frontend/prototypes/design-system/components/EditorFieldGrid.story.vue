<script setup lang="ts">
import EditorFieldGrid from "../../../src/shared/design-system/base/EditorFieldGrid.vue";
import LabeledInput from "../../../src/shared/design-system/base/LabeledInput.vue";
</script>
<template>
  <Story title="Design system/Base/Editor field grid">
    <UApp
      ><div class="min-h-screen bg-default p-section text-default">
        <EditorFieldGrid class="max-w-xl">
          <LabeledInput label="Name" model-value="Example" />
          <LabeledInput label="Quantity" :model-value="1" type="number" />
          <LabeledInput
            label="Description"
            multiline
            class="col-span-full"
            model-value="Full-width content"
          />
        </EditorFieldGrid></div
    ></UApp>
  </Story>
</template>
