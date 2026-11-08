<script setup lang="ts">
import InvitationLinkCard from "../../../src/modules/invitations/InvitationLinkCard.vue";
const sampleUrl = "https://example.test/invite/sample";

function initialState() {
  return { linkTitle: "Game link", enabled: true, pending: false };
}
</script>

<template>
  <Story title="Domain/Game management/Invitation link card" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <ul class="max-w-xl">
            <InvitationLinkCard
              :title="state.linkTitle"
              :url="sampleUrl"
              :enabled="state.enabled"
              :pending="state.pending"
              @toggle="state.enabled = !state.enabled"
            />
          </ul>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstText v-model="state.linkTitle" title="Title" /><HstCheckbox
        v-model="state.enabled"
        title="Enabled" />
      <HstCheckbox v-model="state.pending" title="Pending"
    /></template>
  </Story>
</template>
