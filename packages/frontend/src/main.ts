import { agentApi } from "./modules/agent/api";
import ClassCatalogView from "./modules/class-management/ClassCatalogView.vue";
import { classCatalog } from "./modules/class-management/api";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import "./style.css";
import App from "./App.vue";
import { createFrontendI18n } from "./shared/i18n";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import GamesView from "./modules/games/GamesView.vue";
import GameView from "./modules/games/GameView.vue";
import "./shared/route-meta";
import InvitationView from "./modules/invitations/InvitationView.vue";
import { apiServicesKey } from "./shared/api-services";
import { authApi } from "./modules/auth/api";
import { api as characters } from "./modules/characters/api";
import { api as gameTable } from "./modules/game-table/api";
import { gameNotesApi } from "./modules/game-notes/api";
import GameNotesView from "./modules/game-notes/GameNotesView.vue";
import { api as npcs } from "./modules/npcs/api";
import { api as games } from "./modules/games/api";
import { invitationApi } from "./modules/invitations/api";
import { api as players } from "./modules/players/api";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      meta: { breadcrumb: { label: "Games", route: "games" } },
      children: [
        { path: "", name: "games", component: GamesView, meta: { pageGroup: "games" } },
        {
          path: "games/new",
          name: "game-new",
          component: GamesView,
          meta: { breadcrumb: { label: "Create game" }, pageGroup: "games" },
        },
        {
          path: "games/:gameId",
          meta: { breadcrumb: { label: "Game", route: "game-table" } },
          children: [
            {
              path: "",
              name: "game-table",
              meta: { pageGroup: "game-table" },
              component: GameView,
            },
            {
              path: "settings",
              name: "game-settings",
              component: GameView,
              meta: { breadcrumb: { label: "Settings" } },
            },
            {
              path: "characters",
              meta: { breadcrumb: { label: "Characters management", route: "game-characters" } },
              children: [
                { path: "", name: "game-characters", component: GameView },
                {
                  path: ":characterId",
                  name: "game-character",
                  component: GameView,
                  meta: { breadcrumb: { label: "Character sheet" } },
                },
              ],
            },
            {
              path: "classes",
              meta: {
                breadcrumb: { label: "Game classes", route: "game-classes" },
                pageGroup: "game-classes",
              },
              children: [
                { path: "", name: "game-classes", component: ClassCatalogView },
                {
                  path: "copy",
                  name: "game-class-copy",
                  component: ClassCatalogView,
                  meta: { breadcrumb: { label: "Copy from library" } },
                },
                {
                  path: ":classId",
                  name: "game-class-detail",
                  component: ClassCatalogView,
                  meta: { breadcrumb: { label: "Class details" } },
                },
              ],
            },
            {
              path: "notes",
              meta: { breadcrumb: { label: "Game notes", route: "game-notes" } },
              children: [
                { path: "", name: "game-notes", component: GameNotesView },
                {
                  path: "new",
                  name: "note-new",
                  component: GameNotesView,
                  meta: { breadcrumb: { label: "New entry" } },
                },
                {
                  path: ":entryId",
                  name: "note-detail",
                  component: GameNotesView,
                  meta: { breadcrumb: { label: "Entry details" } },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      path: "/library/class",
      meta: {
        breadcrumb: { label: "Class library", route: "class-library" },
        pageGroup: "class-library",
      },
      children: [
        { path: "", name: "class-library", component: ClassCatalogView },
        {
          path: "new",
          name: "library-class-new",
          component: ClassCatalogView,
          meta: { breadcrumb: { label: "Create class" } },
        },
        {
          path: ":classId",
          name: "library-class-detail",
          component: ClassCatalogView,
          meta: { breadcrumb: { label: "Class details" } },
        },
      ],
    },
    {
      path: "/invite/:token",
      component: InvitationView,
      meta: { breadcrumb: { label: "Game invitation" } },
    },
  ],
});

router.beforeEach((to) => {
  if (to.name !== "game-table") return;
  const { character, manage, ...query } = to.query;
  if (typeof character === "string" && character)
    return {
      name: "game-character",
      params: { ...to.params, characterId: character },
      query,
      replace: true,
    };
  if (manage === "characters")
    return { name: "game-characters", params: to.params, query, replace: true };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});
createApp(App)
  .provide(apiServicesKey, {
    agent: agentApi,
    auth: authApi,
    characters,
    gameTable,
    gameNotes: gameNotesApi,
    npcs,
    classCatalog,
    games,
    invitations: invitationApi,
    players,
  })
  .use(router)
  .use(ui)
  .use(createFrontendI18n())
  .use(VueQueryPlugin, { queryClient })
  .mount("#app");
