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
import { apiServicesKey } from "./shared/api-services";
import { authApi } from "./modules/auth/api";
import { api as characters } from "./modules/characters/api";
import { api as gameTable } from "./modules/game-table/api";
import { api as npcs } from "./modules/npcs/api";
import { api as games } from "./modules/games/api";
import { invitationApi } from "./modules/invitations/api";
import { api as players } from "./modules/players/api";

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
  .provide(apiServicesKey, {
    auth: authApi,
    characters,
    gameTable,
    npcs,
    games,
    invitations: invitationApi,
    players,
  })
  .use(router)
  .use(ui)
  .use(createFrontendI18n())
  .use(VueQueryPlugin, { queryClient })
  .mount("#app");
