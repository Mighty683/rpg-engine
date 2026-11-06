import { createI18n } from "vue-i18n";

export function createFrontendI18n() {
  return createI18n({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: {
      en: {
        games: {
          title: "Games",
          create: "Create game",
          returnToSetup: "Return to setup",
          setupAvailable: "Your setup is still available. A retry may create a duplicate.",
          loading: "Loading games…",
          loadError: "Could not load games.",
          retry: "Retry",
          empty: "No games yet. Create your first game.",
          name: "Game name",
          nameHint: "Maximum 20 characters.",
          nameRequired: "Enter a game name",
          nameTooLong: "Use 20 characters or fewer",
          system: "RPG system",
          rowSystem: "System: {name}",
          systemDescription: "The RPG system cannot be changed after the game is created.",
          systemPlaceholder: "Select a system",
          systemRequired: "Select an RPG system",
          systemsLoading: "Loading RPG systems…",
          systemsError: "Could not load RPG systems.",
          systemsEmpty: "No RPG systems are available.",
          creating: "Creating game…",
          createFailed: "Could not create game. Your entries are unchanged.",
          createUnknown:
            "We couldn't confirm whether the game was created. Check the games list before trying again.",
          checkGames: "Check games",
          cancel: "Cancel",
          discardTitle: "Discard this game setup?",
          keepEditing: "Keep editing",
          discard: "Discard",
          created: "Game created: {name}.",
        },
      },
    },
  });
}
