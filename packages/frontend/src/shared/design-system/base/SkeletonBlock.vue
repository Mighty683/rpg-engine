<template>
  <span aria-hidden="true" class="skeleton-block" />
</template>

<style scoped>
.skeleton-block {
  display: block;
  min-height: 0.85em;
  border-radius: var(--radius-control);
  background-color: var(--ui-border);
  background-image: linear-gradient(
    100deg,
    transparent 30%,
    var(--ui-border-accented) 50%,
    transparent 70%
  );
  background-size: 220% 100%;
}
@media (prefers-reduced-motion: no-preference) {
  .skeleton-block {
    animation: skeleton-sweep 1.8s ease-in-out infinite;
  }
}
@keyframes skeleton-sweep {
  from {
    background-position: 120% 0;
  }
  to {
    background-position: -100% 0;
  }
}
</style>
