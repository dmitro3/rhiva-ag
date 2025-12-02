ALTER TABLE "pnls" RENAME COLUMN "rewardUsd" TO "claimedRewardsUsd";--> statement-breakpoint
ALTER TABLE "pnls" ALTER COLUMN "pnlUsd" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "pnls" drop column "amountUsd";--> statement-breakpoint
ALTER TABLE "pnls" ALTER COLUMN "claimedFeeUsd" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pnls" drop column "claimedFeeUsd";--> statement-breakpoint
ALTER TABLE "pnls" ADD COLUMN "claimedBaseFee" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pnls" ADD COLUMN "claimedQuoteFee" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pnls" ADD COLUMN "claimedBaseFeeUsd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pnls" ADD COLUMN "claimedQuoteFeeUsd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pnls" ADD COLUMN "unclaimedRewardsFee" double precision[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "pnls" ADD COLUMN "unclaimedRewardsFeeUsd" double precision[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "pnls" ADD COLUMN "claimedFeeUsd" double precision GENERATED ALWAYS AS (COALESCE("pnls"."claimedBaseFee"::decimal) + COALESCE("pnls"."claimedQuoteFee"::decimal, 0)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "pnls" ADD COLUMN "amountUsd" double precision GENERATED ALWAYS AS (COALESCE("pnls"."baseAmountUsd"::decimal) + COALESCE("pnls"."quoteAmountUsd"::decimal, 0)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "pnls" ADD COLUMN "unclaimedFeeUsd" double precision GENERATED ALWAYS AS (COALESCE("pnls"."unclaimedBaseFeeUsd"::decimal) + COALESCE("pnls"."unclaimedQuoteFeeUsd"::decimal, 0)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "pnls" DROP COLUMN "feeUsd";

ALTER TABLE "pnls" ALTER COLUMN "claimedRewardsUsd" DROP DEFAULT;
ALTER TABLE "pnls" DROP COLUMN "claimedRewardsUsd";
ALTER TABLE "pnls" ADD COLUMN "claimedRewardsUsd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
