export const PLAYBACK_COMPLETION_THRESHOLD = 0.9


export const isPlaybackCompleted = (
    positionSeconds: number,
    durationSeconds: number
) =>
    Number.isFinite(positionSeconds) &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0 &&
    positionSeconds / durationSeconds >= PLAYBACK_COMPLETION_THRESHOLD
