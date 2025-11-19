import moment from "moment";
import type { Job } from "bullmq";
import { Box, Text, useInput } from "ink";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import Cell from "./Cell";
import JobAction from "./JobAction";
import { truncate } from "../utils";
import type { Config } from "../utils/config";

type JobListProps = {
  config: Config;
};

export type ExtendedJob = {
  status: Awaited<ReturnType<Job["getState"]>>;
} & Job;

export default function JobList({ config }: JobListProps) {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focused, setFocused] = useState<"left" | "right">("left");
  const [selectedJob, setSelectedJob] = useState<ExtendedJob | null>(null);

  const queryKey = useMemo(() => ["bullmq"], []);

  const updateJob = useCallback(
    (selectedJob: ExtendedJob) => {
      queryClient.setQueryData<ExtendedJob[]>(queryKey, (jobs) => {
        return jobs
          ? ([
              { ...selectedJob, status: "waiting" },
              ...jobs.filter((job) => job.id !== selectedJob.id),
            ] as ExtendedJob[])
          : [selectedJob];
      });
    },
    [queryKey, queryClient],
  );
  const removeJob = useCallback(
    (selectedJob: ExtendedJob) => {
      queryClient.setQueryData<ExtendedJob[]>(queryKey, (jobs) => {
        return jobs?.filter((job) => job.id !== selectedJob.id);
      });
    },
    [queryKey, queryClient],
  );

  const {
    data: [jobs, analytics],
  } = useQuery({
    queryKey,
    refetchInterval: 10_000,
    initialData: [[], { completed: 0, failed: 0 }],
    queryFn: async () => {
      return Promise.all([
        Promise.all(
          config.queues.map(async (queue) => {
            return queue.getJobs().then((jobs) =>
              Promise.all(
                jobs.map(
                  async (job) =>
                    ({
                      ...job,
                      queueName: job.queueName ?? queue.name,
                      status: await job.getState().catch(() => "undefined"),
                    }) as ExtendedJob,
                ),
              ),
            );
          }),
        ).then((jobs) => jobs.flat()),

        Promise.all(
          config.queues.map(async (queue) => ({
            completed: await queue.getCompletedCount(),
            failed: await queue.getFailedCount(),
          })),
        ).then((configs) =>
          configs.reduce(
            (acc, cur) => ({
              completed: acc.completed + cur.completed,
              failed: acc.failed + cur.failed,
            }),
            { completed: 0, failed: 0 },
          ),
        ),
      ]);
    },
  });

  const getQueue = useCallback(
    (queueName: string) => {
      return config.queues.find((queue) => queue.name === queueName);
    },
    [config],
  );

  const onMenuSelected = useCallback(
    async (value: string) => {
      switch (value.toLowerCase()) {
        case "retry":
        case "r":
          return selectedJob?.retry?.().then(() => {
            updateJob({ ...selectedJob, status: "waiting" } as ExtendedJob);
          });
        case "delete":
        case "d":
          if (selectedJob) {
            if (selectedJob?.remove)
              return selectedJob?.remove?.().then(() => {
                setSelectedJob(null);
                removeJob(selectedJob);
              });
            else {
              const queue = getQueue(selectedJob?.queueName);
              if (selectedJob.id)
                return queue?.remove?.(selectedJob.id).then(() => {
                  setSelectedJob(null);
                  removeJob(selectedJob);
                });
            }
          }
      }
    },
    [selectedJob, updateJob, removeJob, getQueue],
  );

  useInput((input, key) => {
    const leftPaneFocued = focused === "left";
    if (leftPaneFocued) {
      if (key.upArrow) setCurrentIndex((prev) => Math.max(0, prev - 1));
      if (key.downArrow)
        setCurrentIndex((previous) => Math.min(previous + 1, jobs.length - 1));
      onMenuSelected(input);
      if (focused === "left" && key.return) setFocused("right");
    }

    if (key.rightArrow || key.leftArrow) {
      setFocused(focused === "left" ? "right" : "left");
    }
  });

  useEffect(() => {
    const job = jobs[currentIndex];
    if (job) setSelectedJob(job);
  }, [currentIndex, jobs]);

  const formattedJobs = useMemo(
    () =>
      jobs.map((job) => ({
        id: truncate(job.id!, 16),
        queue: job.queueName,
        name: job.name,
        attempts: job.attemptsMade,
        status: job.status,
        time: moment(job.timestamp).fromNow(),
      })),
    [jobs],
  );

  return (
    <Box
      flexDirection="column"
      rowGap={0.4}
    >
      {analytics && (
        <Box
          flexDirection="row"
          columnGap={2}
        >
          <Text>Completed Jobs: {analytics.completed}</Text>
          <Text color="red">Failed Jobs: {analytics.failed}</Text>
        </Box>
      )}
      <Box
        flexDirection="row"
        gap={4}
      >
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={focused === "left" ? "green" : "grey"}
        >
          <Box
            flexDirection="row"
            borderBottom
            borderTop={false}
            borderLeft={false}
            borderRight={false}
            borderStyle="single"
            borderBottomColor={focused === "left" ? "green" : "grey"}
          >
            {formattedJobs[0] &&
              Object.keys(formattedJobs[0]).map((key) => (
                <Cell
                  key={key}
                  width="50%"
                >
                  <Text bold>{key}</Text>
                </Cell>
              ))}
          </Box>
          {formattedJobs.map((job, index) => {
            const selected = index === currentIndex;

            return (
              <Box
                key={job.id}
                gap={4}
                alignItems="center"
                padding={0.5}
                flexGrow={1}
                minWidth={120}
                height={4}
                flexDirection="row"
                borderStyle={selected ? "single" : undefined}
                borderColor={
                  selected
                    ? focused === "left"
                      ? "#008167"
                      : "grey"
                    : undefined
                }
              >
                {Object.entries(job).map(([key, value]) => (
                  <Cell
                    key={key}
                    width="35%"
                  >
                    <Text>{value}</Text>
                  </Cell>
                ))}
              </Box>
            );
          })}
        </Box>
        {selectedJob && (
          <Box
            padding={1}
            minWidth="25%"
            flexDirection="column"
            borderStyle="single"
            borderColor={focused === "right" ? "greenBright" : "grey"}
          >
            <JobAction
              job={selectedJob}
              onChange={onMenuSelected}
              isDisabled={focused !== "right"}
            />
            <Box>
              <Text>
                {JSON.stringify(
                  {
                    id: selectedJob.id,
                    failedReason: selectedJob.failedReason,
                    returnValue: selectedJob.returnvalue,
                    data: selectedJob.data,
                  },
                  undefined,
                  2,
                )}
              </Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
