import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  theme: {
    fontFamily: {
      times: "'Times New Roman', 'Times', 'serif'",
    },
    colors: {
      primary: {
        DEFAULT: "#00D897",
        secondary: {
          DEFAULT: "#00DDBB",
        },
      },
      light: {
        DEFAULT: "#F3F3F3",
        secondary: {
          DEFAULT: "#A2A2A2",
        },
      },
      dark: {
        DEFAULT: "#000B1A",
        secondary: {
          DEFAULT: "#010E1F",
        },
        tetiary: {
          DEFAULT: "#000B1A",
        },
      },
      gray: {
        DEFAULT: "#737373",
      },
    },
  },
  presets: [presetWind3()],
});
