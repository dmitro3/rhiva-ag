export const CONCURRENT_WORK = 100;
export const supportedDexes = ["orca", "meteora", "raydium-clmm"] as const;

export enum Work {
  retry = "retry",
  syncPosition = "sync-position",
  positionManager = "position-manager",
  syncTransaction = "sync-transaction",
  syncPositionSchedule = "sync-position-schedule",
}
