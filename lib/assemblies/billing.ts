/** Add one join→leave session (epoch seconds) onto an accumulated total. */
export function addSession(accumulatedSeconds: number, joinedAt: number, leftAt: number): number {
  return accumulatedSeconds + Math.max(0, leftAt - joinedAt);
}

/** Sum of each participant's minutes, rounded up per participant. */
export function totalParticipantMinutes(perParticipantSeconds: number[]): number {
  return perParticipantSeconds.reduce((sum, s) => sum + Math.ceil(s / 60), 0);
}
