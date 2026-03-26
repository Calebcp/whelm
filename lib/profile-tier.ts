import { STREAK_BANDANA_TIERS } from "@/lib/streak-bandanas";

export type ProfileAvatarSize = "mini" | "row" | "compact" | "hero";

export type ProfileTierTheme = {
  title: string;
  imagePath: string;
};

export function getProfileTierTheme(
  tier: string | null | undefined,
  isPro = false,
): ProfileTierTheme {
  switch (tier) {
    case "white":
      return {
        title: "White Ascendant",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_white.PNG"
          : "/profile-tiers/white_profile.PNG",
      };
    case "black":
      return {
        title: "Black Resolve",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_black.PNG"
          : "/profile-tiers/black_profile.PNG",
      };
    case "blue":
      return {
        title: "Blue Voltage",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_blue.PNG"
          : "/profile-tiers/blue_profile.PNG",
      };
    case "purple":
      return {
        title: "Purple Pulse",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_purple.PNG"
          : "/profile-tiers/purple_profile.PNG",
      };
    case "green":
      return {
        title: "Green Current",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_green.PNG"
          : "/profile-tiers/green_profile.PNG",
      };
    case "red":
      return {
        title: "Red Return",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_red.PNG"
          : "/profile-tiers/red_profile.PNG",
      };
    case "yellow":
    default:
      return {
        title: "Yellow Spark",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_yellow.PNG"
          : "/profile-tiers/yellow_profile.PNG",
      };
  }
}

export function getStreakBandanaAssetPath(tierColor: string | null | undefined) {
  const tier =
    STREAK_BANDANA_TIERS.find((item) => item.color === tierColor) ??
    STREAK_BANDANA_TIERS.find((item) => item.color === "yellow");
  return tier ? `/streak/${tier.assetFile}` : "/streak/moveband.riv";
}
