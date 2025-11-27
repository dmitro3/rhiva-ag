import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Rhiva",
  description:
    "Learn how to provide and manage liquidity positions across multiple dexes.",
  themeConfig: {
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
                { text: "Rhiva Lens", link: "/overview/products/rhiva-lens" },
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
            { text: "Connect Wallet", link: "/api-examples" },
            {
              text: "Dashboard",
              items: [
                { text: "Explore", items: [{ text: "Tokens", link: "" }] },
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
