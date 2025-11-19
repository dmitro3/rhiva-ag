import { Box } from "ink";
import { useState } from "react";
import type { Job } from "bullmq";
import { Select, Spinner } from "@inkjs/ui";

type JobActionProps = {
  job: Job;
  onChange: (value: string) => Promise<void> | undefined;
} & Pick<React.ComponentProps<typeof Select>, "isDisabled">;

export default function JobAction({ onChange, ...props }: JobActionProps) {
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState<string | undefined>(
    undefined,
  );

  return (
    <Box flexDirection="row">
      {loading && (
        <Spinner
          label={loadingLabel}
          type="balloon"
        />
      )}
      <Select
        options={[
          { label: "[R]etry", value: "retry" },
          { label: "[D]elete", value: "delete" },
        ]}
        onChange={(value) => {
          setLoading(true);
          setLoadingLabel(value);
          onChange?.(value)?.finally(() => setLoading(false));
        }}
        {...props}
      />
    </Box>
  );
}
