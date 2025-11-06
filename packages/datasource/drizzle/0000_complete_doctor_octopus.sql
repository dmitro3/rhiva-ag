CREATE TABLE "pnls" (
	"position" text NOT NULL,
	"state" text NOT NULL,
	"feeUsd" double precision NOT NULL,
	"pnlUsd" double precision NOT NULL,
	"rewardUsd" double precision NOT NULL,
	"createdAt" date DEFAULT now() NOT NULL,
	"amountUsd" double precision NOT NULL,
	"claimedFeeUsd" double precision NOT NULL,
	"baseAmount" double precision DEFAULT 0 NOT NULL,
	"baseAmountUsd" double precision DEFAULT 0 NOT NULL,
	"quoteAmount" double precision DEFAULT 0 NOT NULL,
	"quoteAmountUsd" double precision DEFAULT 0 NOT NULL,
	"unclaimedBaseFee" double precision DEFAULT 0 NOT NULL,
	"unclaimedBaseFeeUsd" double precision DEFAULT 0 NOT NULL,
	"unclaimedQuoteFee" double precision DEFAULT 0 NOT NULL,
	"unclaimedQuoteFeeUsd" double precision DEFAULT 0 NOT NULL,
	"config" jsonb,
	CONSTRAINT "pnls_position_createdAt_unique" UNIQUE("position","createdAt")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"email" text,
	"displayName" text,
	"currentStreak" integer DEFAULT 1 NOT NULL,
	"uid" text NOT NULL,
	"referralCode" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lastLogin" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "mints" (
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text,
	"symbol" text,
	"decimals" integer NOT NULL,
	"tokenProgram" text NOT NULL,
	"extensions" jsonb
);
--> statement-breakpoint
CREATE TABLE "pool_reward_tokens" (
	"pool" text NOT NULL,
	"mint" text NOT NULL,
	CONSTRAINT "pool_reward_tokens_pool_mint_unique" UNIQUE("pool","mint")
);
--> statement-breakpoint
CREATE TABLE "pools" (
	"id" text PRIMARY KEY NOT NULL,
	"addressLookupTables" text[],
	"dex" text NOT NULL,
	"rewardTokens" text[],
	"baseToken" text NOT NULL,
	"quoteToken" text NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poolFilters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"data" jsonb NOT NULL,
	"user" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text,
	"wrappedDek" text,
	"external" boolean NOT NULL,
	"user" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_unique" UNIQUE("user")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" jsonb NOT NULL,
	"role" text NOT NULL,
	"thread" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"user" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user" uuid NOT NULL,
	"key" text NOT NULL,
	"xp" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user" uuid PRIMARY KEY NOT NULL,
	"slippage" double precision DEFAULT 0.5 NOT NULL,
	"rebalanceTime" double precision DEFAULT 60 NOT NULL,
	"gasPriorityFee" double precision DEFAULT 0.0001 NOT NULL,
	"enableAutoClaim" boolean DEFAULT false NOT NULL,
	"enableAutoCompound" boolean DEFAULT false NOT NULL,
	"enableNotifications" boolean DEFAULT true NOT NULL,
	"rebalanceType" text DEFAULT 'swapless' NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_user_unique" UNIQUE("user")
);
--> statement-breakpoint
CREATE TABLE "referrers" (
	"referer" uuid NOT NULL,
	"user" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrers_user_unique" UNIQUE("user"),
	CONSTRAINT "referrers_user_referer_unique" UNIQUE NULLS NOT DISTINCT("user","referer")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"amountUsd" double precision NOT NULL,
	"config" jsonb NOT NULL,
	"wallet" text NOT NULL,
	"pool" text NOT NULL,
	"active" boolean NOT NULL,
	"status" text NOT NULL,
	"state" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"user" uuid NOT NULL,
	"title" jsonb NOT NULL,
	"detail" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pnls" ADD CONSTRAINT "pnls_position_positions_id_fk" FOREIGN KEY ("position") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_reward_tokens" ADD CONSTRAINT "pool_reward_tokens_pool_pools_id_fk" FOREIGN KEY ("pool") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_reward_tokens" ADD CONSTRAINT "pool_reward_tokens_mint_mints_id_fk" FOREIGN KEY ("mint") REFERENCES "public"."mints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_baseToken_mints_id_fk" FOREIGN KEY ("baseToken") REFERENCES "public"."mints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_quoteToken_mints_id_fk" FOREIGN KEY ("quoteToken") REFERENCES "public"."mints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poolFilters" ADD CONSTRAINT "poolFilters_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_threads_id_fk" FOREIGN KEY ("thread") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrers" ADD CONSTRAINT "referrers_referer_users_id_fk" FOREIGN KEY ("referer") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrers" ADD CONSTRAINT "referrers_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_wallet_wallets_id_fk" FOREIGN KEY ("wallet") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_pool_pools_id_fk" FOREIGN KEY ("pool") REFERENCES "public"."pools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;