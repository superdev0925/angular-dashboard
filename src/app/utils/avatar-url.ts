/** Bundled fallback when profile has no avatar URL. */
export const DEFAULT_TRAINER_AVATAR = 'assets/images/default-trainer-avatar.svg';

/**
 * Returns a displayable avatar URL, using the static default when missing or blank.
 *
 * @param url - Trainer or draft avatar URL from profile/API
 */
export function resolveTrainerAvatarUrl(url?: string | null): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return DEFAULT_TRAINER_AVATAR;
  }
  return trimmed;
}

/**
 * Opponent avatar for battle log rows (bundled default; remote trainer sprites are unreliable).
 *
 * @param _name - Opponent display name (reserved for future per-trainer assets)
 */
export function resolveOpponentAvatarUrl(_name?: string): string {
  return DEFAULT_TRAINER_AVATAR;
}
