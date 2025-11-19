import { render as _render } from "ink";
import { defaultTheme, extendTheme, ThemeProvider } from "@inkjs/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import JobList from "./components/JobList";
import type { Config } from "./utils/config";

export type { Config } from "./utils/config";

const queryClient = new QueryClient();
const customTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: () => ({
          color: "green",
        }),
      },
    },
    Select: {
      styles: {
        focusIndicator: () => ({ color: "green" }),
        selectedIndicator: () => ({ color: "green" }),
        label({ isFocused, isSelected }) {
          let color: string | undefined;
          if (isSelected) color = "green";
          if (isFocused) color = "green";
          return { color };
        },
      },
    },
  },
});

export const render = (config: Config) =>
  _render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={customTheme}>
        <JobList config={config} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
