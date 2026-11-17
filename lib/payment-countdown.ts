const pad = (n: number) => String(n).padStart(2, '0')

/** 3725 -> "01:02:05". Hours are not capped at 24: a 48-hour window reads 48:00:00. */
export const formatCountdown = (totalSeconds: number): string => {
    const s = Math.max(0, Math.floor(totalSeconds))
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/**
 * Seconds still left, given the figure the server reported and when it arrived.
 *
 * Both timestamps come from THIS device's clock, so only the difference between
 * them is used and a wrong device time cancels out. A phone set ten minutes slow
 * would otherwise show ten minutes too many, and the customer would reach a
 * Snap page that has already expired.
 */
export const remainingSeconds = (secondsLeft: number, loadedAt: number, now: number): number =>
    Math.max(0, secondsLeft - Math.floor((now - loadedAt) / 1000))
