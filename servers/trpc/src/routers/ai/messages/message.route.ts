import z from "zod/v3";
import z4 from "zod/v4";
import { OpenAI } from "openai";
import { run } from "@openai/agents";
import { TRPCError } from "@trpc/server";
import type { NonNullable } from "@rhiva-ag/shared";
import type { agentOutputSchema } from "@rhiva-ag/mcp";
import { and, eq, getTableColumns, type SQL } from "drizzle-orm";
import { setDefaultOpenAIKey, setTracingExportApiKey } from "@openai/agents";
import {
  messages,
  threads,
  threadSelectSchema,
  buildOrderByClauseFromObject,
  buildDrizzleWhereClauseFromObject,
} from "@rhiva-ag/datasource";

import { getEnv } from "../../../env";
import { privateProcedure, router } from "../../../trpc";
import {
  messageFilterSchema,
  messageSortSchema,
  messageOutputSchema,
} from "./message.schema";

setDefaultOpenAIKey(getEnv("OPEN_API_KEY"));
setTracingExportApiKey(getEnv("OPEN_API_KEY"));

export const messageRoute = router({
  create: privateProcedure
    .input(
      z4.object({
        prompt: z4.string(),
        id: z4.uuid().optional(),
        thread: threadSelectSchema.shape.id.optional(),
      }),
    )
    .output(
      z.object({
        thread: z.object({
          id: z.string(),
          user: z.string(),
          createdAt: z.date(),
          name: z.string().nullable(),
        }),
        messages: z.array(messageOutputSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const client = new OpenAI({
        apiKey: getEnv("OPEN_API_KEY"),
      });
      let thread = input.thread
        ? await ctx.drizzle.query.threads.findFirst({
            where: eq(threads.id, input.thread),
          })
        : null;
      if (!thread) {
        const conversation = await client.conversations.create({});
        [thread] = await ctx.drizzle
          .insert(threads)
          .values({ id: conversation.id, user: ctx.user.id })
          .returning();
      }

      if (thread) {
        const agent = await ctx.mcpClient.createAgent({
          modelSettings: {
            maxTokens: 30_000,
          },
        });

        const response = await run(agent, input.prompt, {
          conversationId: thread.id,
        });
        const finalOutput = response.finalOutput as NonNullable<
          z.infer<typeof agentOutputSchema>
        >;

        if (finalOutput) {
          let name = finalOutput.summary?.slice(0, 32);
          name = name ? name : input.prompt.slice(0, 32);
          const [newThread] = await ctx.drizzle
            .update(threads)
            .set({ name, id: thread.id })
            .where(eq(threads.id, thread.id))
            .returning();
          if (newThread) thread = newThread;
        }

        const newMessages = await ctx.drizzle
          .insert(messages)
          .values([
            {
              id: input.id,
              role: "user",
              thread: thread.id,
              content: { text: input.prompt },
            },
            ...(finalOutput
              ? [
                  {
                    role: "assistant" as const,
                    thread: thread.id,
                    content: finalOutput,
                  },
                ]
              : []),
          ])
          .returning();
        return {
          thread,
          messages: newMessages as unknown as z.infer<
            typeof messageOutputSchema
          >[],
        };
      }

      throw new TRPCError({ code: "NOT_FOUND", message: "thread not found." });
    }),
  list: privateProcedure
    .input(
      z4
        .object({
          limit: z4.number().int().optional(),
          offset: z4.number().int().optional(),
          sortBy: messageSortSchema.optional(),
          filter: messageFilterSchema.partial().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      let where: (SQL<unknown> | undefined)[] | undefined,
        orderBy: SQL<unknown>[] | undefined;
      if (input) {
        if (input.sortBy) orderBy = buildOrderByClauseFromObject(input.sortBy);
        if (input.filter)
          where = buildDrizzleWhereClauseFromObject(input.filter);
      }

      const query = ctx.drizzle
        .select(getTableColumns(messages))
        .from(messages)
        .innerJoin(
          threads,
          and(eq(threads.user, ctx.user.id), eq(threads.id, messages.thread)),
        );
      if (input?.limit) query.limit(input.limit);
      if (input?.offset) query.offset(input.offset);

      if (where) query.where(and(...where));
      if (orderBy) query.orderBy(...orderBy);

      const response = await query.execute();

      return z.array(messageOutputSchema).parse(response);
    }),
});
