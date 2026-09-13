import type { MovementRecord } from "../../../types/domain";

export type AccountBalancePoint = { timestamp: number; value: number };

function accountDelta(movement: MovementRecord, accountId: number) {
  if (movement.status !== "posted") return 0;
  let delta = 0;
  if (movement.destinationAccountId === accountId) delta += movement.destinationAmount ?? 0;
  if (movement.sourceAccountId === accountId) delta -= movement.sourceAmount ?? 0;
  return delta;
}

export function buildAccountBalanceEvolution({
  accountId,
  currentBalance,
  movements,
  now = Date.now(),
  windowDays = 90,
}: {
  accountId: number;
  currentBalance: number;
  movements: readonly MovementRecord[];
  now?: number;
  windowDays?: number;
}): AccountBalancePoint[] {
  const cutoff = now - windowDays * 86_400_000;
  const relevant = movements
    .filter((movement) => movement.status === "posted" && (movement.sourceAccountId === accountId || movement.destinationAccountId === accountId))
    .map((movement) => ({ timestamp: new Date(movement.occurredAt).getTime(), delta: accountDelta(movement, accountId) }))
    .filter((point) => Number.isFinite(point.timestamp) && point.timestamp >= cutoff && point.timestamp <= now)
    .sort((left, right) => right.timestamp - left.timestamp);

  const points: AccountBalancePoint[] = [{ timestamp: now, value: currentBalance }];
  let runningBalance = currentBalance;
  for (const point of relevant) {
    runningBalance -= point.delta;
    points.push({ timestamp: point.timestamp, value: runningBalance });
  }
  points.push({ timestamp: cutoff, value: runningBalance });
  return points.reverse();
}
