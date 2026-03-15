export type WhelmEmoteTier = "core" | "support";

export type WhelmEmoteCategory =
  | "welcome"
  | "guidance"
  | "focus"
  | "learning"
  | "review"
  | "identity";

export type WhelmEmoteId =
  | "whelm.neutral"
  | "whelm.wave"
  | "whelm.guide"
  | "whelm.encourage"
  | "whelm.timer"
  | "whelm.write"
  | "whelm.idea"
  | "whelm.proud"
  | "whelm.enter"
  | "whelm.ready"
  | "whelm.heart"
  | "whelm.inspect"
  | "whelm.books"
  | "whelm.checklist"
  | "whelm.read"
  | "whelm.score"
  | "whelm.progress"
  | "whelm.sort"
  | "whelm.wave_high";

export type WhelmEmoteSurface =
  | "schedule"
  | "today"
  | "notes"
  | "reports"
  | "onboarding"
  | "empty_state"
  | "celebration";

export type WhelmEmoteDefinition = {
  id: WhelmEmoteId;
  label: string;
  tier: WhelmEmoteTier;
  category: WhelmEmoteCategory;
  sourceName: string;
  sourcePath: string;
  publicPath: string;
  useCases: string[];
  recommendedSurfaces: WhelmEmoteSurface[];
  notes: string;
};

const sourceRoot = "/public/whelm-emotes";

export const WHELM_EMOTES: readonly WhelmEmoteDefinition[] = [
  {
    id: "whelm.neutral",
    label: "Neutral",
    tier: "core",
    category: "identity",
    sourceName: "neutral_stand_whelm.riv",
    sourcePath: `${sourceRoot}/neutral_stand_whelm.riv`,
    publicPath: "/whelm-emotes/neutral_stand_whelm.riv",
    useCases: ["idle state", "default companion state", "empty state anchor"],
    recommendedSurfaces: ["schedule", "today", "empty_state"],
    notes: "Default resting pose. Use when no stronger emotion or instruction is needed.",
  },
  {
    id: "whelm.wave",
    label: "Wave",
    tier: "core",
    category: "welcome",
    sourceName: "wavinghand_whelm.riv",
    sourcePath: `${sourceRoot}/wavinghand_whelm.riv`,
    publicPath: "/whelm-emotes/wavinghand_whelm.riv",
    useCases: ["greeting", "welcome back", "light onboarding"],
    recommendedSurfaces: ["onboarding", "empty_state"],
    notes: "Primary greeting emote. Prefer this over the higher wave for normal entry moments.",
  },
  {
    id: "whelm.guide",
    label: "Guide",
    tier: "core",
    category: "guidance",
    sourceName: "givingrecommendation_whelm.riv",
    sourcePath: `${sourceRoot}/givingrecommendation_whelm.riv`,
    publicPath: "/whelm-emotes/givingrecommendation_whelm.riv",
    useCases: ["instruction", "coach prompt", "explaining next step"],
    recommendedSurfaces: ["schedule", "onboarding"],
    notes: "Main instructional emote. Best for lightweight guidance, not celebration.",
  },
  {
    id: "whelm.encourage",
    label: "Encourage",
    tier: "core",
    category: "guidance",
    sourceName: "pointing_with_encouragement_whelm.riv",
    sourcePath: `${sourceRoot}/pointing_with_encouragement_whelm.riv`,
    publicPath: "/whelm-emotes/pointing_with_encouragement_whelm.riv",
    useCases: ["nudge", "call to action", "next move"],
    recommendedSurfaces: ["today", "schedule"],
    notes: "Action-forward coaching pose. Good beside buttons and momentum prompts.",
  },
  {
    id: "whelm.timer",
    label: "Timer",
    tier: "core",
    category: "focus",
    sourceName: "showingtimer_whelm.riv",
    sourcePath: `${sourceRoot}/showingtimer_whelm.riv`,
    publicPath: "/whelm-emotes/showingtimer_whelm.riv",
    useCases: ["focus mode", "countdown", "start work"],
    recommendedSurfaces: ["today", "schedule"],
    notes: "Primary focus-mode emote. Keep this frequent in timer-related surfaces.",
  },
  {
    id: "whelm.write",
    label: "Write",
    tier: "core",
    category: "focus",
    sourceName: "writingonclipboard_whelm.riv",
    sourcePath: `${sourceRoot}/writingonclipboard_whelm.riv`,
    publicPath: "/whelm-emotes/writingonclipboard_whelm.riv",
    useCases: ["capture", "notes", "planning"],
    recommendedSurfaces: ["notes", "schedule"],
    notes: "Best notes/default creation pose. Use more than books or reading.",
  },
  {
    id: "whelm.idea",
    label: "Idea",
    tier: "core",
    category: "learning",
    sourceName: "lightbulbidea_whelm.riv",
    sourcePath: `${sourceRoot}/lightbulbidea_whelm.riv`,
    publicPath: "/whelm-emotes/lightbulbidea_whelm.riv",
    useCases: ["insight", "suggestion", "smart recommendation"],
    recommendedSurfaces: ["notes", "reports", "today"],
    notes: "Best for prompts, strategy suggestions, and product insight moments.",
  },
  {
    id: "whelm.proud",
    label: "Proud",
    tier: "core",
    category: "identity",
    sourceName: "proud_whelm.riv",
    sourcePath: `${sourceRoot}/proud_whelm.riv`,
    publicPath: "/whelm-emotes/proud_whelm.riv",
    useCases: ["completion", "achievement", "milestone"],
    recommendedSurfaces: ["today", "reports", "celebration"],
    notes: "Primary celebration emote. Use for real completion, not minor confirmations.",
  },
  {
    id: "whelm.enter",
    label: "Enter",
    tier: "support",
    category: "welcome",
    sourceName: "enteringthrough_door_whelm.riv",
    sourcePath: `${sourceRoot}/enteringthrough_door_whelm.riv`,
    publicPath: "/whelm-emotes/enteringthrough_door_whelm.riv",
    useCases: ["new day ritual", "entry gate", "start of flow"],
    recommendedSurfaces: ["schedule", "onboarding"],
    notes: "Strong fit for the daily entry ritual and first-time setup moments.",
  },
  {
    id: "whelm.ready",
    label: "Ready",
    tier: "support",
    category: "identity",
    sourceName: "fightingstance_whelm.riv",
    sourcePath: `${sourceRoot}/fightingstance_whelm.riv`,
    publicPath: "/whelm-emotes/fightingstance_whelm.riv",
    useCases: ["challenge mode", "discipline", "resolve"],
    recommendedSurfaces: ["today", "schedule"],
    notes: "Use sparingly. High-energy posture should signal commitment, not idle state.",
  },
  {
    id: "whelm.heart",
    label: "Heart",
    tier: "support",
    category: "guidance",
    sourceName: "handonchest_whelm.riv",
    sourcePath: `${sourceRoot}/handonchest_whelm.riv`,
    publicPath: "/whelm-emotes/handonchest_whelm.riv",
    useCases: ["reassurance", "reflection", "compassionate note"],
    recommendedSurfaces: ["today", "empty_state"],
    notes: "Use for softer recovery or reflective moments when the app should feel humane.",
  },
  {
    id: "whelm.inspect",
    label: "Inspect",
    tier: "support",
    category: "learning",
    sourceName: "holdingmagnifyingglass_whelm.riv",
    sourcePath: `${sourceRoot}/holdingmagnifyingglass_whelm.riv`,
    publicPath: "/whelm-emotes/holdingmagnifyingglass_whelm.riv",
    useCases: ["search", "review", "look closer"],
    recommendedSurfaces: ["notes", "reports"],
    notes: "Best for review/search functions, not general learning screens.",
  },
  {
    id: "whelm.books",
    label: "Books",
    tier: "support",
    category: "learning",
    sourceName: "holdingstackofbooks_whelm.riv",
    sourcePath: `${sourceRoot}/holdingstackofbooks_whelm.riv`,
    publicPath: "/whelm-emotes/holdingstackofbooks_whelm.riv",
    useCases: ["study", "knowledge", "learning queue"],
    recommendedSurfaces: ["notes", "today"],
    notes: "Use for education/study framing. Less versatile than write or idea.",
  },
  {
    id: "whelm.checklist",
    label: "Checklist",
    tier: "support",
    category: "focus",
    sourceName: "middleofcheckinglist_whelm.riv",
    sourcePath: `${sourceRoot}/middleofcheckinglist_whelm.riv`,
    publicPath: "/whelm-emotes/middleofcheckinglist_whelm.riv",
    useCases: ["task progress", "mid-execution", "block completion"],
    recommendedSurfaces: ["schedule", "today"],
    notes: "Good for progress-in-motion, especially block execution or task review.",
  },
  {
    id: "whelm.read",
    label: "Read",
    tier: "support",
    category: "learning",
    sourceName: "readingbook_whelm.riv",
    sourcePath: `${sourceRoot}/readingbook_whelm.riv`,
    publicPath: "/whelm-emotes/readingbook_whelm.riv",
    useCases: ["reading", "deep study", "reviewing notes"],
    recommendedSurfaces: ["notes", "today"],
    notes: "Use in study-specific contexts. Avoid as a general notes mascot.",
  },
  {
    id: "whelm.score",
    label: "Score",
    tier: "support",
    category: "review",
    sourceName: "showingfullmarksclipboard_whelm.riv",
    sourcePath: `${sourceRoot}/showingfullmarksclipboard_whelm.riv`,
    publicPath: "/whelm-emotes/showingfullmarksclipboard_whelm.riv",
    useCases: ["excellent result", "goal hit", "strong performance"],
    recommendedSurfaces: ["reports", "celebration"],
    notes: "This is more school-flavored than proud. Use only for explicit result moments.",
  },
  {
    id: "whelm.progress",
    label: "Progress",
    tier: "support",
    category: "review",
    sourceName: "showingsmarboardgraphs_whelm.riv",
    sourcePath: `${sourceRoot}/showingsmarboardgraphs_whelm.riv`,
    publicPath: "/whelm-emotes/showingsmarboardgraphs_whelm.riv",
    useCases: ["history", "trend review", "report summary"],
    recommendedSurfaces: ["reports"],
    notes: "Canonical reports emote. Source file has a typo; keep the typo out of product naming.",
  },
  {
    id: "whelm.sort",
    label: "Sort",
    tier: "support",
    category: "focus",
    sourceName: "sortingthroughcards_whelm.riv",
    sourcePath: `${sourceRoot}/sortingthroughcards_whelm.riv`,
    publicPath: "/whelm-emotes/sortingthroughcards_whelm.riv",
    useCases: ["organize", "prioritize", "sort ideas"],
    recommendedSurfaces: ["notes", "schedule"],
    notes: "Useful for triage, backlog, or categorization moments.",
  },
  {
    id: "whelm.wave_high",
    label: "Wave High",
    tier: "support",
    category: "welcome",
    sourceName: "wavinghandhigher_whelm.riv",
    sourcePath: `${sourceRoot}/wavinghandhigher_whelm.riv`,
    publicPath: "/whelm-emotes/wavinghandhigher_whelm.riv",
    useCases: ["big welcome", "bigger celebration", "special greeting"],
    recommendedSurfaces: ["onboarding", "celebration"],
    notes: "Secondary greeting. Use when you need more energy than the normal wave.",
  },
] as const;

export const CORE_WHELM_EMOTE_IDS: readonly WhelmEmoteId[] = [
  "whelm.neutral",
  "whelm.wave",
  "whelm.guide",
  "whelm.encourage",
  "whelm.timer",
  "whelm.write",
  "whelm.idea",
  "whelm.proud",
] as const;

export const SUPPORT_WHELM_EMOTE_IDS: readonly WhelmEmoteId[] = WHELM_EMOTES.filter(
  (emote) => emote.tier === "support",
).map((emote) => emote.id);

export const DEFAULT_WHELM_EMOTES_BY_SURFACE: Record<WhelmEmoteSurface, readonly WhelmEmoteId[]> = {
  schedule: ["whelm.neutral", "whelm.enter", "whelm.encourage", "whelm.timer"],
  today: ["whelm.timer", "whelm.ready", "whelm.encourage", "whelm.proud"],
  notes: ["whelm.write", "whelm.idea", "whelm.read", "whelm.sort"],
  reports: ["whelm.progress", "whelm.score", "whelm.proud"],
  onboarding: ["whelm.wave", "whelm.guide", "whelm.enter"],
  empty_state: ["whelm.neutral", "whelm.wave", "whelm.heart"],
  celebration: ["whelm.proud", "whelm.wave_high", "whelm.score"],
};

export const WHELM_EMOTE_BY_ID: Record<WhelmEmoteId, WhelmEmoteDefinition> = Object.fromEntries(
  WHELM_EMOTES.map((emote) => [emote.id, emote]),
) as Record<WhelmEmoteId, WhelmEmoteDefinition>;

export function getWhelmEmote(emoteId: WhelmEmoteId) {
  return WHELM_EMOTE_BY_ID[emoteId];
}
