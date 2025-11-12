import type z from "zod/v3";
import type { userMessageSchema } from "@rhiva-ag/trpc";

type UserMessageProps = {
  message: z.infer<typeof userMessageSchema>;
};
export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="self-end flex flex-col max-w-md bg-white/10 p-2 rounded-xl">
      <p className="text-wrap">{message.content.text}</p>
    </div>
  );
}
