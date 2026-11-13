import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";

export default defineConfig({
  integrations: [
    starlight({
      title: "mini-container",
      defaultLocale: "root",
      locales: {
        root: { label: "Español", lang: "es" },
      },
      plugins: [starlightLinksValidator()],
      customCss: ["./src/styles/guide.css"],
      sidebar: [
        { label: "Portada", slug: "index" },
        {
          label: "0 · Preparación",
          items: [{ autogenerate: { directory: "0-setup" } }],
        },
        {
          label: "1 · Lanzar un proceso",
          items: [{ autogenerate: { directory: "1-process" } }],
        },
      ],
    }),
  ],
});
