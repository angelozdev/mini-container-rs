import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";
import { terminalWindow } from "./src/lib/terminal-window.mjs";

const syntaxColors = [
  { scopes: ["comment", "punctuation.definition.comment"], color: "var(--n-faint)" },
  {
    scopes: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new"],
    color: "var(--n-t-purple)",
  },
  {
    scopes: ["entity.name.function", "support.function", "meta.function-call", "entity.name.function.macro"],
    color: "var(--n-t-blue)",
  },
  { scopes: ["string", "string.quoted", "punctuation.definition.string"], color: "var(--n-t-green)" },
  {
    scopes: ["entity.name.type", "entity.name.class", "support.type", "support.class", "constant.numeric", "constant.language"],
    color: "var(--n-t-orange)",
  },
];

function useNotionSyntaxColors(theme) {
  const [base] = theme.settings;
  theme.fg = "var(--n-text)";
  theme.colors["editor.foreground"] = "var(--n-text)";
  theme.settings = [
    { ...base, settings: { ...base.settings, foreground: "var(--n-text)" } },
    ...syntaxColors.map(({ scopes, color }) => ({ scope: scopes, settings: { foreground: color } })),
  ];
  return theme;
}

export default defineConfig({
  integrations: [
    starlight({
      title: "mini-container",
      defaultLocale: "root",
      locales: {
        root: { label: "Español", lang: "es" },
      },
      plugins: [starlightLinksValidator()],
      customCss: ["./src/styles/tokens.css", "./src/styles/notion.css", "./src/styles/guide.css", "./src/styles/stepper.css", "./src/styles/glossary.css", "./src/styles/page-props.css", "./src/styles/section-marks.css", "./src/styles/reading-bar.css", "./src/styles/diagram-grid.css", "./src/styles/exercises-card.css", "./src/styles/terminal-window.css"],
      components: {
        Header: "./src/components/Header.astro",
        PageTitle: "./src/components/PageTitle.astro",
        TableOfContents: "./src/components/TableOfContents.astro",
      },
      expressiveCode: {
        defaultProps: { wrap: true },
        plugins: [terminalWindow()],
        customizeTheme: useNotionSyntaxColors,
        minSyntaxHighlightingColorContrast: 0,
      },
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
        {
          label: "2 · Namespaces",
          items: [{ autogenerate: { directory: "2-namespaces" } }],
        },
        {
          label: "3 · cgroups",
          items: [{ autogenerate: { directory: "3-cgroups" } }],
        },
        { label: "Glosario", slug: "glossary" },
      ],
    }),
  ],
});
