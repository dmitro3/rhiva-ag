import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Rhiva",
  description:
    "Learn how to provide and manage liquidity positions across multiple dexes.",
  appearance: "force-dark",
  themeConfig: {
    logo: "/favicon.ico",
    nav: [
      { text: "Home", link: "/" },
      { text: "Overview", link: "/overview" },
      { text: "User Guide", link: "/user-guide" },
    ],
    footer: {
      copyright: "Copyright © Rhiva.fun",
    },
    sidebar: {
      "/overview/": [
        {
          text: "Overview",
          items: [
            { text: "What we build", link: "/overview" },
            {
              text: "Products",
              items: [
                { text: "Web", link: "/overview/products/web" },
                { text: "Bot", link: "/overview/products/bot" },
              ],
            },
          ],
        },
      ],
      "/user-guide/": [
        {
          text: "User Guide",
          items: [
            { text: "Getting Started", link: "/user-guide" },
            { text: "Sign Up", link: "/user-guide/auth" },
            {
              text: "Dashboard",
              items: [
                {
                  text: "Explore",
                  items: [
                    { text: "Tokens", link: "/user-guide/tokens" },
                    { text: "Pools", link: "/user-guide/pools" },
                  ],
                },
                { text: "AI", link: "/user-guide/ai" },
                { text: "Rewards", link: "/user-guide/rewards" },
                { text: "Portfolio", link: "/user-guide/portfolio" },
                { text: "Settings", link: "/user-guide/settings" },
              ],
            },
            {
              text: "Position",
              items: [
                {
                  text: "Open Position",
                  link: "/user-guide/position/open-position",
                },
                {
                  text: "Close Position",
                  link: "/user-guide/position/close-position",
                },
                {
                  text: "Claim Rewards",
                  link: "/user-guide/position/claim-rewards",
                },
                {
                  text: "Rebalance & Reposition",
                  link: "/user-guide/position/rebalance-reposition",
                },
                {
                  text: "Autoclaim & Autocompound",
                  link: "/user-guide/position/autoclaim-autocompound",
                },
              ],
            },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: "twitter", link: "https://x.com/rhiva" },
      { icon: "github", link: "https://github.com/rhivadotfun" },
    ],
  },
});
