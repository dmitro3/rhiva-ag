import { render as _render } from "ink";
import { defaultTheme, extendTheme, ThemeProvider } from "@inkjs/ui";

import JobList from "./components/JobList";
import type { Config } from "./utils/config";

export type { Config } from "./utils/config";

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
    <ThemeProvider theme={customTheme}>
      <JobList config={config} />
    </ThemeProvider>,
  );
