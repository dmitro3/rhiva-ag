"use client";
import type z from "zod/v3";
import type z4 from "zod/v4";
import { object, string } from "yup";
import { FiSend } from "react-icons/fi";
import { useRouter } from "next/navigation";
import type { messageOutputSchema } from "@rhiva-ag/trpc";
import type { threadSelectSchema } from "@rhiva-ag/datasource";
import { Field, FormikContext, useFormik, Form } from "formik";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Chat from "@/components/ai/Chat";
import Header from "@/components/ai/Header";
import BounceDot from "@/components/BounceDot";
import EmptyChat from "@/components/ai/EmptyChat";
import ChatSidebar from "@/components/ai/ChatSidebar";
import { useTRPC, useTRPCClient } from "@/trpc.client";

type AiPageClientProps = {
  searchParams: { prompt?: string };
};

type Message = z.infer<typeof messageOutputSchema>;
type Thread = z4.infer<typeof threadSelectSchema>;

export default function AiPageClient({ searchParams }: AiPageClientProps) {
  const intentProcesses = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const trpc = useTRPC();
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [currentThread, setCurrentThread] = useState<Thread | undefined>(
    undefined,
  );

  const messageKey = useMemo(
    () => ["messages", currentThread?.id],
    [currentThread],
  );

  const { data: threads } = useQuery(trpc.ai.thread.list.queryOptions());
  const updateMessages = useCallback(
    <T extends unknown[]>(messages: Omit<Message, "thread">[], key?: T) => {
      queryClient.setQueryData<Omit<Message, "thread">[]>(
        key ?? messageKey,
        (oldData) => {
          const existing = oldData ?? [];
          const map = new Map(existing.map((message) => [message.id, message]));
          for (const message of messages) map.set(message.id, message);
          return Array.from(map.values());
        },
      );
    },
    [queryClient, messageKey],
  );
  const updateThreads = useCallback(
    (...threads: Thread[]) => {
      queryClient.setQueryData<Thread[]>(
        trpc.ai.thread.list.queryKey(),
        (oldData) => {
          const existing = oldData ?? [];
          const map = new Map(existing.map((item) => [item.id, item]));
          for (const item of threads) map.set(item.id, item);
          return Array.from(map.values());
        },
      );
    },
    [queryClient, trpc],
  );

  const { mutateAsync, isPending } = useMutation(
    trpc.ai.message.create.mutationOptions({
      onSuccess(data) {
        if (data) {
          updateThreads(data.thread);
          setCurrentThread(data.thread);
          updateMessages(data.messages, ["messages", data.thread.id]);
        }
      },
    }),
  );

  const sendMessage = useCallback(
    async (
      values: { prompt: string },
      resetForm?: (values: {
        values: {
          prompt: string;
        };
      }) => void,
    ) => {
      let thread = currentThread?.id;
      if (!thread) {
        const newThread = await trpcClient.ai.thread.create.mutate({});
        updateThreads(newThread);
        setCurrentThread(newThread);
        thread = newThread.id;
      }

      const data = {
        thread,
        role: "user" as const,
        id: crypto.randomUUID(),
        content: {
          text: values.prompt,
        },
        createdAt: new Date(),
      };
      updateMessages([data]);
      resetForm?.({ values: { prompt: "" } });

      await mutateAsync({
        ...data,
        prompt: values.prompt!,
      });
    },
    [mutateAsync, updateMessages, currentThread, trpcClient, updateThreads],
  );

  const formikContext = useFormik({
    validationSchema: object({
      prompt: string().trim().required(),
    }),
    initialValues: {
      prompt: "",
    },
    async onSubmit(values, { resetForm }) {
      return sendMessage({ prompt: values.prompt! }, resetForm);
    },
  });

  const { resetForm } = formikContext;

  const handleNewChat = useCallback(() => {
    setCurrentThread(undefined);
    resetForm({ values: { prompt: "" } });
    queryClient.setQueryData(["messages", null], []);
  }, [queryClient, resetForm]);

  const handleThreadSelect = useCallback(
    (thread: z4.infer<typeof threadSelectSchema>) => {
      resetForm({ values: { prompt: "" } });
      setIsCollapsed(true);
      setCurrentThread(thread);
    },
    [resetForm],
  );

  const { data: messages } = useQuery({
    queryKey: messageKey,
    enabled: Boolean(currentThread?.id),
    queryFn: async () => {
      const messages = await trpcClient.ai.message.list.query({
        filter: currentThread
          ? {
              thread: { eq: currentThread.id },
            }
          : undefined,
      });

      return messages;
    },
  });

  useEffect(() => {
    const el = listRef.current;
    if (el && messages?.length)
      el.scrollTo({
        top: el.scrollHeight,
        behavior: "smooth",
      });
  }, [messages?.length]);

  useEffect(() => {
    if (intentProcesses.current) return;
    intentProcesses.current = true;
    if (searchParams.prompt && searchParams.prompt.trim().length > 0) {
      sendMessage({ prompt: searchParams.prompt });
      router.replace("/ai");
    }
  }, [searchParams.prompt, sendMessage, router]);

  return (
    <FormikContext value={formikContext}>
      <Form className="flex-1 flex h-screen overflow-hidden">
        <ChatSidebar
          threads={threads}
          isCollapsed={isCollapsed}
          activeThread={currentThread}
          onThreadSelect={handleThreadSelect}
          setIsCollapsed={setIsCollapsed}
          onNewChat={handleNewChat}
        />
        <div className="flex-1 flex flex-col backdrop-blur-2xl overflow-hidden">
          <Header
            canBack
            onMenuClick={() => setIsCollapsed(false)}
            className="sticky top-0 z-10 sm:bg-white/10 sm:backdrop-blur-3xl"
          />
          <div className="flex-1 flex flex-col space-y-4 overflow-y-scroll p-4">
            {messages?.length
              ? messages.map((message) => (
                  <Chat
                    key={message.id}
                    message={message}
                  />
                ))
              : !isPending && (
                  <EmptyChat onPrompt={(prompt) => sendMessage({ prompt })} />
                )}
            {isPending && <BounceDot />}
          </div>
          <div className="sticky bottom-0 flex sm:items-center sm:justify-center sm:bg-white/10">
            <div className="flex items-center space-x-4 p-4 z-10 sm:self-center w-full sm:max-w-7xl">
              <Field
                as="textarea"
                name="prompt"
                placeholder="Ask me anything..."
                className="flex-1 p-3 bg-transparent border border-white/10 rounded focus:border-primary"
              />
              <button
                type="submit"
                className="size-12 aspect-square flex items-center justify-center bg-primary/20 p-2 rounded"
              >
                <FiSend size={18} />
              </button>
            </div>
          </div>
        </div>
      </Form>
    </FormikContext>
  );
}
