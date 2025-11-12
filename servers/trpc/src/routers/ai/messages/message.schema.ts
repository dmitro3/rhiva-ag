import z from "zod/v3";
import z4 from "zod/v4";
import { agentOutputSchema } from "@rhiva-ag/mcp";
import {
  threadSelectSchema,
  whereOperator,
  orderByOperator,
} from "@rhiva-ag/datasource";

export const messageFilterSchema = z4.object({
  thread: whereOperator(threadSelectSchema.shape.id),
});

export const messageSortSchema = orderByOperator(z4.enum(["createdAt"]));

export const agentMessageSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  content: agentOutputSchema,
  role: z.enum(["system", "assistant"]),
});
export const userMessageSchema = z.object({
  id: z.string(),
  role: z.literal("user"),
  content: z.object({
    text: z.string(),
  }),
  createdAt: z.date(),
});

export const messageOutputSchema = z.union([
  agentMessageSchema,
  userMessageSchema,
]);
