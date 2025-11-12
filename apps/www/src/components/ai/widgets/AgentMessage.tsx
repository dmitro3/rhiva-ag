import type z from "zod/v3";
import type { agentMessageSchema } from "@rhiva-ag/trpc";

import { PoolCard } from "./PoolCard";
import { TokenCard } from "./TokenCard";
import { SummaryCard } from "./SummaryCard";

type AgentMessageProps = {
  message: z.infer<typeof agentMessageSchema>;
};
export function AgentMessage({ message }: AgentMessageProps) {
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex space-x-2 overflow-x-scroll">
        {message.content.pools?.map((pool) => (
          <PoolCard
            key={pool.address}
            pool={pool}
          />
        ))}
      </div>
      <div className="flex space-x-2 overflow-x-scroll">
        {message.content.tokens?.map((token) => (
          <TokenCard
            key={token.address}
            token={token}
          />
        ))}
      </div>
      {message.content.summary && (
        <SummaryCard summary={message.content.summary} />
      )}
    </div>
  );
}
