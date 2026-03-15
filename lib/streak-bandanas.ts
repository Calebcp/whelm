export type StreakBandanaTierId =
  | "tier1_yellow"
  | "tier2_red"
  | "tier3_green"
  | "tier4_purple"
  | "tier5_blue"
  | "tier6_black"
  | "tier7_white";

export type StreakBandanaTier = {
  id: StreakBandanaTierId;
  label: string;
  color: string;
  minDays: number;
  maxDays: number | null;
  assetFile: string;
  assetPath: string;
  playbackRate: number;
  notes: string;
};

const assetRoot = "/Users/calebroemhildtsultan/Downloads/colorbandanastreak";

export const STREAK_BANDANA_TIERS: readonly StreakBandanaTier[] = [
  {
    id: "tier1_yellow",
    label: "Yellow Bandana",
    color: "yellow",
    minDays: 1,
    maxDays: 1,
    assetFile: "yellow_bandana_streak.riv",
    assetPath: `${assetRoot}/yellow_bandana_streak.riv`,
    playbackRate: 0.33,
    notes: "Entry-tier streak bandana. Use for the user's first protected day.",
  },
  {
    id: "tier2_red",
    label: "Red Bandana",
    color: "red",
    minDays: 2,
    maxDays: 4,
    assetFile: "red_bandana_streak_.riv",
    assetPath: `${assetRoot}/red_bandana_streak_.riv`,
    playbackRate: 0.33,
    notes: "Early streak proof. Signals that the user returned instead of getting lucky once.",
  },
  {
    id: "tier3_green",
    label: "Green Bandana",
    color: "green",
    minDays: 5,
    maxDays: 9,
    assetFile: "green_bandana_streak_.riv",
    assetPath: `${assetRoot}/green_bandana_streak_.riv`,
    playbackRate: 0.33,
    notes: "Five-day rhythm threshold. First genuinely earned bandana tier.",
  },
  {
    id: "tier4_purple",
    label: "Purple Bandana",
    color: "purple",
    minDays: 10,
    maxDays: 19,
    assetFile: "purple_bandana_streak__.riv",
    assetPath: `${assetRoot}/purple_bandana_streak__.riv`,
    playbackRate: 0.33,
    notes: "Double-digit streak tier. Should feel visibly harder-won than green.",
  },
  {
    id: "tier5_blue",
    label: "Blue Bandana",
    color: "blue",
    minDays: 20,
    maxDays: 49,
    assetFile: "blue_bandana_streak_.riv",
    assetPath: `${assetRoot}/blue_bandana_streak_.riv`,
    playbackRate: 0.33,
    notes: "Established consistency tier. A user here is no longer experimenting.",
  },
  {
    id: "tier6_black",
    label: "Black Bandana",
    color: "black",
    minDays: 50,
    maxDays: 99,
    assetFile: "black_bandana_streak.riv",
    assetPath: `${assetRoot}/black_bandana_streak.riv`,
    playbackRate: 0.33,
    notes: "Prestige tier. Fifty days should read as rare and serious.",
  },
  {
    id: "tier7_white",
    label: "White Bandana",
    color: "white",
    minDays: 100,
    maxDays: null,
    assetFile: "white_bandana_streak.riv",
    assetPath: `${assetRoot}/white_bandana_streak.riv`,
    playbackRate: 0.33,
    notes: "Top streak bandana. White is the elite 100-day-plus mark.",
  },
] as const;

export function getStreakBandanaTier(streak: number): StreakBandanaTier | null {
  if (streak <= 0) return null;
  return (
    STREAK_BANDANA_TIERS.find((tier) => {
      if (tier.maxDays === null) return streak >= tier.minDays;
      return streak >= tier.minDays && streak <= tier.maxDays;
    }) ?? null
  );
}

export const STREAK_BANDANA_BY_ID: Record<StreakBandanaTierId, StreakBandanaTier> =
  Object.fromEntries(STREAK_BANDANA_TIERS.map((tier) => [tier.id, tier])) as Record<
    StreakBandanaTierId,
    StreakBandanaTier
  >;
