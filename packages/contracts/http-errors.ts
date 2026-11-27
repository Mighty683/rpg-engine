/** Public wire contract. Codes are permanent within a method + path.
 * ERR01–39 belong to the operation, ERR40–79 to its fields, ERR80–99 to middleware.
 * Add explicit entries; never renumber existing entries when adding an error. */
type CodeMap = Readonly<Record<string, string>>;
const shared: CodeMap = {
  ERR80: "bad_request",
  ERR81: "unauthorized",
  ERR82: "forbidden",
  ERR83: "not_found",
  ERR84: "validation",
  ERR85: "invalid_csrf",
  ERR86: "rate_limited",
  ERR87: "payload_too_large",
  ERR79: "invalid_field",
  ERR88: "database_busy",
  ERR89: "auth_busy",
  ERR99: "server_error",
};

const classFields = {
  ERR40: "use_valid_text_without_null_characters",
  ERR41: "enter_a_name",
  ERR42: "use_distinct_skill_and_benefit_ids",
  ERR43: "enter_a_description_for_each_text_benefit",
  ERR44: "skill_rank_in_use",
  ERR45: "skill_id_unavailable",
};

const sheetFields = {
  ERR40: "invalid_equipment",
  ERR41: "invalid_weapon",
  ERR42: "invalid_equipment_modifiers",
  ERR43: "invalid_armor",
  ERR44: "invalid_sheet",
  ERR45: "enter_a_character_name",
  ERR46: "invalid_theme",
  ERR47: "level_must_be_between_5_and_50",
  ERR48: "invalid_attribute_dice",
  ERR49: "invalid_resources",
  ERR50: "invalid_overrides",
  ERR51: "at_least_one_change_is_required",
  ERR52: "unknown_sheet_field",
  ERR53: "choose_each_class_once",
  ERR54: "choose_each_skill_once",
  ERR55: "exp_saved_levels",
  ERR56: "insufficient_exp",
  ERR57: "exp_assigned_levels",
  ERR58: "choose_classes_available_in_this_game",
  ERR59: "choose_valid_skill_ranks_within_their_limits",
  ERR60: "skill_ranks_cannot_exceed_their_class_level",
};

const throwFields = {
  ERR40: "invalid_note",
  ERR41: "note_must_be_500_characters_or_fewer",
  ERR42: "modifier_must_be_a_32_bit_integer",
  ERR43: "choose_one_or_two_attributes",
  ERR44: "invalid_character",
  ERR45: "invalid_expected_revision",
  ERR46: "invalid_dice",
  ERR47: "unknown_attribute_die",
  ERR48: "attribute_dice_use_d6_d8_d10_or_d12",
  ERR49: "invalid_character_or_weapon",
  ERR50: "invalid_roll_attribution",
  ERR51: "invalid_npc",
  ERR52: "invalid_npc_or_attack",
  ERR53: "invalid_privacy_setting",
  ERR54: "invalid_source_throw",
  ERR55: "invalid_agent_turn",
  ERR56: "invalid_setup",
  ERR57: "unknown_setup_type",
  ERR58: "a_reroll_keeps_the_original_character",
  ERR59: "a_reroll_keeps_the_original_character_and_weapon",
  ERR60: "weapon_setup_incomplete",
  ERR61: "weapon_dice_use_d6_d8_d10_or_d12",
  ERR62: "reroll_setup_changed",
  ERR63: "a_reroll_keeps_the_original_npc_and_roll",
  ERR64: "a_reroll_keeps_the_original_attack",
};

const noteFields = {
  ERR40: "inline_formatting_applies_to_text_headings_and_lists",
  ERR41: "note_title_required",
  ERR42: "note_title_length",
  ERR43: "note_title_encoding",
  ERR44: "the_body_contains_unsupported_characters",
  ERR45: "unsupported_formatting",
  ERR46: "the_document_must_end_with_a_newline",
  ERR47: "note_body_length",
  ERR48: "the_formatted_document_is_too_large",
};

const revision = { ERR01: "stale_revision" };
const create = { ERR01: "id_conflict" };
const invitation = { ERR01: "conflict" };
const game = "/api/games/:gameId";
const operations: Record<string, CodeMap> = {
  [`GET ${game}/agent/status`]: { ERR01: "not_found" },
  "GET /api/library/class": { ERR01: "database_busy" },
  [`GET ${game}/classes`]: { ERR01: "not_found" },
  "GET /api/auth/csrf": { ERR01: "unauthorized" },
  "GET /api/auth/me": { ERR01: "unauthorized" },
  "POST /api/auth/logout": { ERR01: "unauthorized" },
  "GET /api/rpg-systems": { ERR01: "database_busy" },
  "GET /api/games": { ERR01: "database_busy" },
  [`GET ${game}`]: { ERR01: "not_found" },
  [`GET ${game}/characters`]: { ERR01: "not_found" },
  [`GET ${game}/characters/:id`]: { ERR01: "not_found" },
  [`GET ${game}/party`]: { ERR01: "not_found" },
  [`GET ${game}/npcs`]: { ERR01: "not_found" },
  [`GET ${game}/npcs/:id`]: { ERR01: "not_found" },
  [`GET ${game}/notes`]: { ERR01: "not_found" },
  [`GET ${game}/notes/:id`]: { ERR01: "not_found" },
  [`GET ${game}/throws`]: { ERR01: "not_found" },
  [`DELETE ${game}/throws/:id`]: { ERR01: "not_found" },
  [`GET ${game}/members`]: { ERR01: "not_found" },
  [`GET ${game}/invitations`]: { ERR01: "not_found" },
  "GET /api/invitations/:id": { ERR01: "not_found" },
  "POST /api/auth/login": { ERR01: "invalid_credentials" },
  "POST /api/auth/register": {
    ERR01: "username_taken",
    ERR40: "username_format",
    ERR41: "password_length",
  },
  "POST /api/games": {
    ERR01: "validation",
    ERR40: "name_required",
    ERR41: "name_length",
    ERR42: "system_required",
  },
  "POST /api/library/class": { ...classFields, ...create },
  "PATCH /api/library/class/:templateId": { ...classFields, ...revision },
  [`POST ${game}/agent/turns`]: {
    ERR01: "agent_disabled",
    ERR02: "agent_game_busy",
    ERR03: "agent_context_changed",
    ERR04: "agent_busy",
    ERR05: "agent_failed",
    ERR06: "agent_unavailable",
    ERR07: "agent_timeout",
    ERR40: "agent_message_length",
  },
  [`POST ${game}/classes`]: { ...create, ERR02: "stale_revision" },
  [`PATCH ${game}/classes/:id`]: {
    ...classFields,
    ...revision,
    ERR02: "skill_removal_confirmation_required",
  },
  [`DELETE ${game}/classes/:id`]: { ...revision, ERR02: "class_in_use" },
  [`POST ${game}/classes/:id/save-to-library`]: {
    ...classFields,
    ...revision,
    ERR02: "id_conflict",
  },
  [`POST ${game}/characters`]: { ...create, ERR40: "character_name_length" },
  [`PATCH ${game}/characters/:id`]: { ...sheetFields, ...revision },
  [`DELETE ${game}/characters/:id`]: revision,
  [`PUT ${game}/characters/:id/active`]: revision,
  [`PATCH ${game}/characters/:id/controller`]: revision,
  [`POST ${game}/npcs`]: create,
  [`PUT ${game}/npcs/:id`]: revision,
  [`DELETE ${game}/npcs/:id`]: revision,
  [`POST ${game}/notes`]: { ...noteFields, ...create },
  [`PATCH ${game}/notes/:id`]: { ...noteFields, ...revision },
  [`POST ${game}/throws`]: {
    ...throwFields,
    ...revision,
    ERR02: "no_active_character",
    ERR03: "inactive_character",
  },
  [`PUT ${game}/members/:id/active-character`]: revision,
  [`PUT ${game}/active-character`]: revision,
  [`POST ${game}/members/:id/remove`]: revision,
  [`POST ${game}/members/:id/restore`]: revision,
  [`POST ${game}/invitations`]: invitation,
  [`PATCH ${game}/invitations/:id`]: invitation,
  [`POST ${game}/invitations/:id/rotate`]: invitation,
  "POST /api/invitations/:token/accept": invitation,
  [`GET ${game}/events`]: { ERR01: "stream_capacity", ERR02: "server_stopping" },
};

const routes = Object.entries(operations).map(([route, codes]) => ({
  pattern: new RegExp(`^${route.replace(/:\w+/g, "[^/]+")}/?$`, "i"),
  codes,
}));

export function operationErrors(method: string, path: string): CodeMap {
  const key = `${method.toUpperCase()} ${path.split("?", 1)[0]}`;
  return routes.find(({ pattern }) => pattern.test(key))?.codes ?? {};
}

export function errorCode(codes: CodeMap, reason: string, fallback = "ERR99") {
  for (const map of [codes, shared]) {
    const entry = Object.entries(map).find(([, value]) => value === reason);
    if (entry) return entry[0];
  }
  return fallback;
}

export function errorReason(codes: CodeMap, code: string) {
  if (!/^ERR\d{2}$/.test(code)) return undefined;
  return codes[code] ?? shared[code];
}
