<script setup lang="ts">
defineOptions({ inheritAttrs: false });
defineProps<{ blockedReason?: string; block?: boolean }>();
</script>

<template>
  <UTooltip
    :text="blockedReason"
    :delay-duration="0"
    disable-hoverable-content
    :content="{ side: 'top' }"
    :ui="{ content: 'h-auto max-w-xs whitespace-normal' }"
  >
    <span
      :class="block ? 'flex h-full w-full' : 'inline-flex'"
      :tabindex="blockedReason ? 0 : undefined"
      :role="blockedReason ? 'group' : undefined"
      :aria-label="blockedReason"
      :data-testid="$attrs['data-testid'] && `${$attrs['data-testid']}-trigger`"
    >
      <UButton
        v-bind="$attrs"
        :block="block"
        :color="blockedReason ? 'neutral' : 'primary'"
        :variant="blockedReason ? 'subtle' : 'solid'"
        :disabled="!!blockedReason"
        :class="{ 'pointer-events-none': blockedReason }"
      >
        <slot />
      </UButton>
    </span>
    <template v-if="blockedReason" #content>
      <span :data-testid="$attrs['data-testid'] && `${$attrs['data-testid']}-tooltip`">{{
        blockedReason
      }}</span>
    </template>
  </UTooltip>
</template>
