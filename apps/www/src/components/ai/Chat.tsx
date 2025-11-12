import type z from "zod/v3";
import type { messageOutputSchema } from "@rhiva-ag/trpc";

import { UserMessage, AgentMessage } from "./widgets";

type ChatProps = {
  message: z.infer<typeof messageOutputSchema>;
};

export default function Chat({ message }: ChatProps) {
  if (message.role === "user") return <UserMessage message={message} />;
  else return <AgentMessage message={message} />;
}
