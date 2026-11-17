<script setup lang="ts">
import AgentEditReview from "./AgentEditReview.vue";
import { useAgentEdit } from "./useAgentEdit";
import type { AgentEditRequest } from "./types";

const props = defineProps<AgentEditRequest>();
const emit = defineEmits<{ dismiss: [] }>();
const dismiss = () => emit("dismiss");
const { profile, diff, busy, notice, accept } = useAgentEdit(props, dismiss);
</script>

<template>
  <AgentEditReview
    :profile="profile"
    :diff="diff"
    :busy="busy"
    :notice="notice"
    :accept="accept"
    :dismiss="dismiss"
  />
</template>
