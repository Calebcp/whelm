export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 16;

const USERNAME_PATTERN = /^[A-Za-z0-9._ -]+$/;

export function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function usernameKey(value: string) {
  return normalizeUsername(value).toLowerCase();
}

export function validateUsername(rawValue: string) {
  const username = normalizeUsername(rawValue);

  if (!username) {
    return { ok: false as const, message: "Choose a username." };
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false as const,
      message: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false as const,
      message: `Username must be ${USERNAME_MAX_LENGTH} characters or less.`,
    };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false as const,
      message: "Username can only use letters, numbers, spaces, periods, hyphens, and underscores.",
    };
  }

  return { ok: true as const, username };
}
