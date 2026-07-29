export function getEffectiveDuration(
  fallbackDuration: number,
  mediaDuration: number | null,
  metadataLoaded: boolean,
): number | null {
  if (
    mediaDuration !== null &&
    Number.isFinite(mediaDuration) &&
    mediaDuration >= 0
  ) {
    return mediaDuration;
  }
  return metadataLoaded ? null : fallbackDuration;
}

export function normalizeSeekTime(
  time: number,
  mediaDuration: number | null,
  fallbackDuration: number | null,
): number | null {
  if (!Number.isFinite(time) || time < 0) return null;
  const max = mediaDuration ?? fallbackDuration;
  return max === null || !Number.isFinite(max) || max < 0
    ? time
    : Math.min(time, max);
}
