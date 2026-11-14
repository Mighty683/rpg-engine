<template>
  <section class="sheet-subsection">
    <h2 class="sheet-heading">
      <slot name="heading" /><span><slot name="hint" /></span>
    </h2>
    <slot />
  </section>
</template>

<style scoped>
.sheet-subsection {
  min-width: 0;
}
.sheet-heading {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-small);
  color: var(--ui-primary);
  margin-bottom: var(--sheet-tight, var(--spacing-tight));
  font-size: var(--sheet-label-size, var(--text-label));
  font-weight: 700;
  letter-spacing: 0.05em;
}
.sheet-heading span {
  color: var(--ui-text-muted);
  text-align: right;
  font-weight: 500;
}
</style>
