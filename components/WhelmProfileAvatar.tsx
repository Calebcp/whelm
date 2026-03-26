"use client";

import styles from "@/app/page.module.css";
import { getProfileTierTheme, type ProfileAvatarSize } from "@/lib/profile-tier";

export default function WhelmProfileAvatar({
  tierColor,
  size,
  isPro = false,
  photoUrl,
}: {
  tierColor: string | null | undefined;
  size: ProfileAvatarSize;
  isPro?: boolean;
  photoUrl?: string | null;
}) {
  const theme = getProfileTierTheme(tierColor, isPro);

  return (
    <div
      className={`${styles.profileAvatarCard} ${
        size === "mini"
          ? styles.profileAvatarCardMini
          : size === "row"
          ? styles.profileAvatarCardRow
          : size === "compact"
            ? styles.profileAvatarCardCompact
            : styles.profileAvatarCardHero
      }`}
      data-tier-color={tierColor ?? "yellow"}
      aria-hidden="true"
    >
      <img src={theme.imagePath} alt="" className={styles.profileAvatarImage} />
      {photoUrl ? (
        <span className={styles.profileAvatarPhotoShell}>
          <img src={photoUrl} alt="" className={styles.profileAvatarPhoto} />
        </span>
      ) : null}
    </div>
  );
}
