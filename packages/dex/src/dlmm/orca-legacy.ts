import Decimal from "decimal.js";
import { mapFilter } from "@rhiva-ag/shared";
import {
  isVersionedTransaction,
  Percentage,
} from "@orca-so/whirlpools-sdk/common-sdk";
import {
  type VersionedTransaction,
  PublicKey,
  type TransactionInstruction,
  type Blockhash,
} from "@solana/web3.js";
import {
  toTx,
  WhirlpoolIx,
  TickArrayUtil,
  type Whirlpool,
  type Position,
  type WhirlpoolClient,
  type WhirlpoolContext,
  type WhirlpoolAccountFetcherInterface,
  type IncreaseLiquidityQuote,
} from "@orca-so/whirlpools-sdk";

type SharedBuildCreatePositionArgs = {
  pool: Whirlpool;
  owner: PublicKey;
  inputMint: PublicKey;
  lowerTick: number;
  upperTick: number;
  quote: IncreaseLiquidityQuote;
};

type BuildCreatePositionArgs = (
  | {
      strategyType: "Full";
    }
  | {
      strategyType: "Custom";
    }
) &
  SharedBuildCreatePositionArgs;

export class OrcaLegacyDLMM {
  readonly context: WhirlpoolContext;
  readonly fetcher: WhirlpoolAccountFetcherInterface;

  constructor(readonly client: WhirlpoolClient) {
    this.fetcher = this.client.getFetcher();
    this.context = this.client.getContext();
  }

  readonly buildCreatePosition = async (
    args: BuildCreatePositionArgs & {
      appendInstructions?: TransactionInstruction | TransactionInstruction[];
    },
  ) => {
    const { pool, quote, owner, lowerTick, upperTick, appendInstructions } =
      args;
    const transactions: VersionedTransaction[] = [];
    const latestBlockhash = await this.context.connection.getLatestBlockhash();
    const txConfig = {
      latestBlockhash,
      maxSupportedTransactionVersion: 0,
      blockhashCommitment: "confirmed",
      computeBudgetOption: {
        type: "none",
      },
    } as const;
    this.context.provider.wallet.publicKey = owner;

    if (args.strategyType === "Custom") {
      const whirlpool = pool.getAddress();

      const uninitializedTickArrays =
        await TickArrayUtil.getUninitializedArraysPDAs(
          [lowerTick, upperTick],
          this.context.program.programId,
          whirlpool,
          pool.getData().tickSpacing,
          this.fetcher,
          {},
        );

      transactions.push(
        ...mapFilter(uninitializedTickArrays, (ta) => {
          const txBuilder = toTx(
            this.context,
            WhirlpoolIx.initTickArrayIx(this.context.program, {
              whirlpool,
              funder: owner,
              tickArrayPda: ta.pda,
              startTick: ta.startIndex,
            }),
          );

          const { transaction, signers } = txBuilder.buildSync(txConfig);
          if (isVersionedTransaction(transaction)) {
            transaction.sign(signers);
            return transaction;
          }

          return null;
        }),
      );
    }
    const { tx, positionMint } = await pool.openPosition(
      lowerTick,
      upperTick,
      quote,
      owner,
      owner,
    );
    if (appendInstructions)
      tx.addInstructions([
        {
          signers: [],
          cleanupInstructions: [],
          instructions: Array.isArray(appendInstructions)
            ? appendInstructions
            : [appendInstructions],
        },
      ]);
    const { signers, transaction } = tx.buildSync(txConfig);
    if (isVersionedTransaction(transaction)) {
      transaction.sign(signers);
      transactions.push(transaction);
    }

    return {
      transactions,
      positionMint,
    };
  };

  readonly buildPreloadedCreatePosition = async (
    args: Omit<BuildCreatePositionArgs, "priceChanges" | "strategyType"> & {
      lowerTick: number;
      upperTick: number;
      appendInstructions?: TransactionInstruction[];
    },
  ) => {
    const { pool, quote, owner, lowerTick, upperTick, appendInstructions } =
      args;
    this.context.provider.wallet.publicKey = owner;

    const transactions: VersionedTransaction[] = [];
    const latestBlockhash = await this.context.connection.getLatestBlockhash();
    const txConfig = {
      latestBlockhash,
      maxSupportedTransactionVersion: 0,
      blockhashCommitment: "confirmed",
      computeBudgetOption: {
        type: "none",
      },
    } as const;

    const whirlpool = pool.getAddress();

    const uninitializedTickArrays =
      await TickArrayUtil.getUninitializedArraysPDAs(
        [lowerTick, upperTick],
        this.context.program.programId,
        whirlpool,
        pool.getData().tickSpacing,
        this.fetcher,
        {},
      );

    transactions.push(
      ...mapFilter(uninitializedTickArrays, (ta) => {
        const txBuilder = toTx(
          this.context,
          WhirlpoolIx.initTickArrayIx(this.context.program, {
            whirlpool,
            funder: owner,
            tickArrayPda: ta.pda,
            startTick: ta.startIndex,
          }),
        );

        const { transaction, signers } = txBuilder.buildSync(txConfig);
        if (isVersionedTransaction(transaction)) {
          transaction.sign(signers);
          return transaction;
        }

        return null;
      }),
    );

    const { tx, positionMint } = await pool.openPosition(
      lowerTick,
      upperTick,
      quote,
      owner,
      owner,
    );
    if (appendInstructions)
      tx.addInstructions([
        {
          signers: [],
          cleanupInstructions: [],
          instructions: appendInstructions,
        },
      ]);
    const { signers, transaction } = tx.buildSync(txConfig);
    if (isVersionedTransaction(transaction)) {
      transaction.sign(signers);
      transactions.push(transaction);
    }

    return {
      transactions,
      positionMint,
    };
  };

  readonly buildClaimReward = async ({
    owner,
    latestBlockhash,
    prependInstructions,
    position: positionPubkey,
  }: {
    owner: PublicKey;
    position: PublicKey | Position;
    prependInstructions?: TransactionInstruction | TransactionInstruction[];
    latestBlockhash?: {
      blockhash: Blockhash;
      lastValidBlockHeight: number;
    };
  }) => {
    this.context.provider.wallet.publicKey = owner;

    const position =
      positionPubkey instanceof PublicKey
        ? await this.client.getPosition(positionPubkey)
        : positionPubkey;
    const transactions: VersionedTransaction[] = [];
    latestBlockhash = latestBlockhash
      ? latestBlockhash
      : await this.context.connection.getLatestBlockhash();
    const txConfig = {
      latestBlockhash,
      maxSupportedTransactionVersion: 0,
      blockhashCommitment: "confirmed",
      computeBudgetOption: {
        type: "none",
      },
    } as const;

    const collectFeeTxBuilder = await position.collectFees();
    if (prependInstructions)
      collectFeeTxBuilder.prependInstructions([
        {
          signers: [],
          cleanupInstructions: [],
          instructions: Array.isArray(prependInstructions)
            ? prependInstructions
            : [prependInstructions],
        },
      ]);
    const { transaction, signers } = collectFeeTxBuilder.buildSync(txConfig);
    if (isVersionedTransaction(transaction)) {
      transaction.sign(signers);
      transactions.push(transaction);
    }
    const collectRewardTxBuilders = await position.collectRewards();
    for (const txBuilder of collectRewardTxBuilders) {
      const { transaction, signers } = txBuilder.buildSync(txConfig);
      if (isVersionedTransaction(transaction)) {
        transaction.sign(signers);
        transactions.push(transaction);
      }
    }

    return transactions;
  };

  readonly buildClosePosition = async ({
    pool,
    owner,
    slippage,
    position,
    prependInstructions,
  }: {
    pool: Whirlpool;
    position: Position;
    slippage: number;
    owner: PublicKey;
    prependInstructions?: TransactionInstruction[] | TransactionInstruction;
  }) => {
    this.context.provider.wallet.publicKey = owner;

    const transactions: VersionedTransaction[] = [];
    const latestBlockhash = await this.context.connection.getLatestBlockhash();
    const txConfig = {
      latestBlockhash,
      maxSupportedTransactionVersion: 0,
      blockhashCommitment: "confirmed",
      computeBudgetOption: {
        type: "none",
      },
    } as const;

    const closePositionTxBuilders = await pool.closePosition(
      position.getAddress(),
      Percentage.fromDecimal(new Decimal(slippage)),
    );

    for (const [index, txBuilder] of closePositionTxBuilders.entries())
      if (index === 0 && prependInstructions) {
        txBuilder.prependInstructions([
          {
            signers: [],
            cleanupInstructions: [],
            instructions: Array.isArray(prependInstructions)
              ? prependInstructions
              : [prependInstructions],
          },
        ]);

        const { transaction, signers } = txBuilder.buildSync(txConfig);
        if (isVersionedTransaction(transaction)) {
          transaction.sign(signers);
          transactions.push(transaction);
        }
      }

    return transactions;
  };
}
