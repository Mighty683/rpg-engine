import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import "./style.css";
import App from "./App.vue";
import { createFrontendI18n } from "./shared/i18n";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import GamesView from "./modules/games/GamesView.vue";
import GameView from "./modules/games/GameView.vue";
import CharacterView from "./modules/characters/CharacterView.vue";
import InvitationView from "./modules/invitations/InvitationView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: GamesView },
    { path: "/games/:gameId", component: GameView },
    { path: "/games/:gameId/characters/:characterId", component: CharacterView },
    { path: "/invite/:token", component: InvitationView },
  ],
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});
createApp(App)
  .use(router)
  .use(ui)
  .use(createFrontendI18n())
  .use(VueQueryPlugin, { queryClient })
  .mount("#app");
