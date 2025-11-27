import { router } from "../trpc";
import { aiRoute } from "./ai/ai.route";
import { pnlRoute } from "./pnls/pnl.route";
import { statRoute } from "./stat/stat.route";
import { userRoute } from "./users/user.route";
import { poolRoute } from "./pools/pool.route";
import { referRoute } from "./refer/refer.route";
import { tokenRoute } from "./tokens/token.route";
import { walletRoute } from "./wallets/wallet.route";
import { rewardRoute } from "./rewards/reward.route";
import { settingsRoute } from "./settings/settings.route";
import { positionRoute } from "./positions/position.route";
import { poolFilterRoute } from "./pool-filters/pool-filter.route";
import { notificationRoute } from "./notifications/notification.route";

export const appRouter = router({
  ai: aiRoute,
  pnl: pnlRoute,
  stat: statRoute,
  pool: poolRoute,
  user: userRoute,
  token: tokenRoute,
  refer: referRoute,
  reward: rewardRoute,
  wallet: walletRoute,
  position: positionRoute,
  settings: settingsRoute,
  poolFilter: poolFilterRoute,
  notification: notificationRoute,
});

export type AppRouter = typeof appRouter;
