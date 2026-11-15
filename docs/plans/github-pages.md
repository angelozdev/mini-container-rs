# Publicar la guía en GitHub Pages: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la guía de `guide/` se lea en `https://angelozdev.github.io/mini-container-rs/`, con todos sus enlaces funcionando, y que se vuelva a publicar sola en cada push a `main`.

**Architecture:** Astro se configura con `site` y `base` desde un único módulo, `guide/src/lib/site.mjs`, que también usan los componentes y las pruebas. Los enlaces internos de las páginas MDX llevan la base escrita; `starlight-links-validator` ya conoce la base y rompe el build si falta en un enlace de Markdown. Un workflow de GitHub Actions corre `pnpm --dir guide check` y publica `guide/dist/` con las acciones oficiales de Pages.

**Tech Stack:** Astro 7.4.4 con Starlight 0.42.7, `starlight-links-validator` 0.27.0, `node --test`, pnpm 11.28.7, GitHub Actions y GitHub Pages.

**Spec:** las decisiones de abajo, tomadas en la conversación del 2026-11-14.

## Decisiones

- **URL:** `https://angelozdev.github.io/mini-container-rs/`, con ruta base (opción A). Sin dominio propio.
- **Enlaces en MDX:** se escribe la base en el enlace: `](/mini-container-rs/0-setup/a-linux-machine/)`. Es más simple que un plugin que reescriba los enlaces. Si la base cambia, el validador señala todos los enlaces que quedaron mal.
- **Acciones:** solo las oficiales de GitHub más `pnpm/action-setup`, sin `withastro/action`. Se fija la versión mayor vigente el 2026-11-14: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` y `pnpm/action-setup@v6`. No hace falta `actions/configure-pages`, porque Pages se activa una vez con `gh api`.
- **CI en PR:** el trabajo `build`, que compila y prueba, corre también en los `pull_request` hacia `main`. El trabajo `deploy` corre solo en `main`. Así el workflow se prueba en el PR antes de publicar nada.
- **Rama:** `feat/github-pages`, desde `main`.

## Global Constraints

- Base exacta: `/mini-container-rs`, sin barra final. `site` exacto: `https://angelozdev.github.io`.
- Node `22.23.4` en CI, el mínimo que pide el README. pnpm lo fija `packageManager` de `guide/package.json`: `pnpm@11.28.7`.
- El código, los nombres de las pruebas y los commits van en inglés. La prosa de la guía, en español.
- Las pruebas que hoy esperan una ruta desde la raíz pasan a esperar la ruta con base. Eso cambia lo que el sitio produce, no relaja la prueba. Ninguna prueba se borra ni se salta.
- La rama local `chore/guide-tooling` refactoriza `dev.test.mjs` y `support.mjs`, y no está en `main`. La que se mezcle segunda hace rebase sobre la otra.

## Review Focus

1. **Un enlace escrito en un componente, no en Markdown**, como el de `Term.astro` a `/glossary/#id`: el validador no lo ve. Debe llevar la base. Lo cubre `base-path.test.mjs` sobre todo `dist/`.
2. **Los CSS, los JS y el favicon con ruta desde la raíz:** en Pages, la página quedaría sin estilos. Debe salir todo con la base. Lo cubre la misma prueba, que también revisa `src` y los `<link href>`.
3. **Un `fetch` de prueba a una ruta sin base** recibe la página 404 y pasa sin comprobar nada. Por ejemplo, las dos pruebas de `dev.test.mjs` que recorren `["/", "/closing/", "/glossary/"]`. Deben exigir el estado 200. La tarea 1 añade esa aserción.
4. **Los enlaces a otra página con `#ancla`, los externos (`https://`, `//`) y los que solo son un ancla (`#x`):** los tres deben quedar como están, sin la base y sin marcarse como rotos. Lo cubre `base-path.test.mjs`.
5. **`404.html`:** Pages la sirve para cualquier ruta que no existe, y sus recursos también deben llevar la base. Está en `dist/`, así que lo cubre la prueba 1. La verificación en vivo de la tarea 2 pide una ruta inexistente.

---

### Task 1: la guía funciona bajo `/mini-container-rs/` en local

Se comprueba desde una entrada real: `pnpm --dir guide build && pnpm --dir guide preview`, abrir `http://localhost:4321/mini-container-rs/` y navegar, con estilos, sidebar, enlaces entre secciones y tarjetas del glosario.

**Files:**
- Create: `guide/src/lib/site.mjs`
- Create: `guide/tests/base-path.test.mjs`
- Modify: `guide/astro.config.mjs` (dentro de `defineConfig`)
- Modify: `guide/src/components/Term.astro:25`
- Modify: los enlaces desde la raíz en `guide/src/content/docs/index.mdx:72-77,133`, `closing.mdx:187` y `1-process/a-launch-a-shell.mdx:517`. Hay que confirmar la lista con el error del validador del paso 3.
- Modify: `guide/tests/support.mjs` (`pageUrlOf` y un helper nuevo), `closing.test.mjs:13-14`, `glossary.test.mjs:21,55-58`, `favicon.test.mjs:22` y `dev.test.mjs:20-25,146-157`

**Interfaces:**
- Produces, en `guide/src/lib/site.mjs`:
  - `export const site = "https://angelozdev.github.io"`
  - `export const base = "/mini-container-rs"`
  - `export function withBase(path: string): string`: recibe una ruta que empieza con `/` y devuelve `base + path`. `withBase("/")` da `"/mini-container-rs/"`.
- Produces, en `guide/tests/support.mjs`:
  - reexporta `base` y `withBase`;
  - `pageUrlOf(docsPath)` devuelve `withBase("/<slug>/")`;
  - `export function builtFileOf(href: string): string`: quita la base, la query y el ancla, y devuelve el archivo de `dist/`. Por ejemplo, `"/mini-container-rs/glossary/#pid"` da `dist/glossary/index.html` y `"/mini-container-rs/favicon.svg"` da `dist/favicon.svg`.

- [ ] **Step 1: Escribe la prueba que falla**, `guide/tests/base-path.test.mjs`. Recorre todos los `dist/**/*.html` y saca cada valor de `href=` y `src=`.
  - `test("every root-relative href and src in the built site starts with the base")`: cada valor que empieza con `/`, y no con `//`, cumple `startsWith(base + "/")`. El mensaje nombra la página y el valor.
  - `test("every internal link in the built site points to a file that exists")`: para cada valor que empieza con `base + "/"`, `existsSync(builtFileOf(value))`.
  - `test("the built pages declare the canonical URL under the site and the base")`: el `href` del `<link rel="canonical">` de `dist/index.html` es exactamente `https://angelozdev.github.io/mini-container-rs/`. Se lee con `attributeOf`, sin depender del orden de los atributos.
  - Los valores `#...`, `http://`, `https://` y `//` se ignoran en las tres pruebas.

- [ ] **Step 2: Comprueba que falla.** Corre `pnpm --dir guide build && node --test guide/tests/base-path.test.mjs`. Lo esperado es que las tres fallen: la primera con un valor como `/glossary/`, y la tercera porque falta el canonical.

- [ ] **Step 3: Crea `site.mjs` y conéctalo en `astro.config.mjs`** con `site` y `base` importados. Corre `pnpm --dir guide build`. Lo esperado es que **falle**, con `starlight-links-validator` listando los enlaces MDX sin base. Esa lista es la que se arregla en el paso 4.

- [ ] **Step 4: Escribe la base en cada enlace que listó el validador** y en el `href` del `LinkCard` de `index.mdx:133`. En `Term.astro`, el `href` del glosario pasa a ser `withBase(\`/glossary/#${id}\`)`. Corre `pnpm --dir guide build`: debe compilar sin errores del validador.

- [ ] **Step 5: Corre la prueba nueva.** `node --test guide/tests/base-path.test.mjs`: deben pasar las 3.

- [ ] **Step 6: Corre todas las pruebas** con `pnpm --dir guide check`. Lo esperado es que fallen las que esperan rutas desde la raíz: `closing`, `glossary`, `favicon`, `dev` y las que usan `pageUrlOf`. Anota cuáles, para el paso 7. Todavía no hay commit: la suite no está en verde.

- [ ] **Step 7: Haz que las pruebas esperen la base.**
  - En `support.mjs`, cambia `pageUrlOf` y añade `builtFileOf`, según *Interfaces*.
  - En `closing.test.mjs` y `glossary.test.mjs`, `closingHref` y `glossaryHref` pasan a `withBase("/closing/")` y `withBase("/glossary/")`. `hrefOf` de `glossary.test.mjs` usa `withBase`.
  - En `favicon.test.mjs:22`, cambia `join(builtFolder, ...)` por `builtFileOf(href)`.
  - En `dev.test.mjs`, las rutas de `sequencePages` y las de los dos recorridos de `:146` y `:153` pasan por `withBase`. Esos dos recorridos ganan `assert.equal(response.status, 200, ...)`, como las demás pruebas del archivo (Review Focus 3).

- [ ] **Step 8: Corre todo otra vez** con `pnpm --dir guide check`. Deben pasar todas: las 1043 de antes más las 3 nuevas, o sea 1046.

- [ ] **Step 9: Comprueba a mano.** Corre `pnpm --dir guide preview` y abre `http://localhost:4321/mini-container-rs/`. La portada debe tener estilos. Prueba un enlace de la tabla «El mapa», una tarjeta de término con «Ver en el glosario →», y una ruta inexistente, que debe dar la página 404 con estilos.

- [ ] **Step 10: Commit.**

```bash
git add guide/src/lib/site.mjs guide/astro.config.mjs guide/src/components/Term.astro guide/src/content/docs guide/tests
git commit -m "feat(guide): serve the guide under the /mini-container-rs base for GitHub Pages"
```

### Task 2: cada push a `main` publica la guía en Pages

Se comprueba desde una entrada real: el check del workflow en verde en el PR y, después del merge, `https://angelozdev.github.io/mini-container-rs/` respondiendo en el navegador.

**Files:**
- Create: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: `pnpm --dir guide check`, que construye `guide/dist/` y corre las pruebas (tarea 1).

- [ ] **Step 1: Escribe `.github/workflows/pages.yml`.**
  - `on`: `push` a `main`, `pull_request` hacia `main` y `workflow_dispatch`.
  - `permissions`: `contents: read`, `pages: write` e `id-token: write`.
  - `concurrency`: grupo `pages`, con `cancel-in-progress: false`.
  - Trabajo `build`, en `ubuntu-latest`:
    1. `actions/checkout@v7`;
    2. `pnpm/action-setup@v6` con `package_json_file: guide/package.json`;
    3. `actions/setup-node@v7` con `node-version: 22.23.4`, `cache: pnpm` y `cache-dependency-path: guide/pnpm-lock.yaml`;
    4. `pnpm --dir guide install --frozen-lockfile`;
    5. `pnpm --dir guide check`;
    6. `actions/upload-pages-artifact@v5` con `path: guide/dist`.
  - Trabajo `deploy`: `needs: build`, `if: github.event_name != 'pull_request'`, `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`. Un solo paso: `actions/deploy-pages@v5` con `id: deployment`.

- [ ] **Step 2: Activa Pages con la fuente «GitHub Actions».**

```bash
gh api -X POST repos/angelozdev/mini-container-rs/pages -f build_type=workflow
gh api repos/angelozdev/mini-container-rs/pages --jq '.build_type + " " + .html_url'
```

Lo esperado es `workflow https://angelozdev.github.io/mini-container-rs/`.

- [ ] **Step 3: Commit, push y PR.**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: build, test and publish the guide to GitHub Pages"
git push -u origin feat/github-pages
gh pr create --base main --title "Publish the guide to GitHub Pages" --body "<resumen y plan de prueba>"
```

- [ ] **Step 4: Comprueba que el CI del PR pasa.** Corre `gh pr checks --watch`. El trabajo `build` debe quedar en `pass` y `deploy` en `skipping`. Si `build` falla, lee el log con `gh run view --log-failed`, corrige y vuelve al paso 3. No se mezcla con el check en rojo.

- [ ] **Step 5: Merge.** Lo decide Angelo. Después, corre `gh run watch` sobre la corrida de `main`: deben quedar `build` y `deploy` en `success`.

- [ ] **Step 6: Comprueba el sitio en vivo.**

```bash
curl -sL -o /dev/null -w "%{http_code}\n" https://angelozdev.github.io/mini-container-rs
curl -s -o /dev/null -w "%{http_code}\n" https://angelozdev.github.io/mini-container-rs/0-setup/a-linux-machine/
curl -s -o /dev/null -w "%{http_code}\n" https://angelozdev.github.io/mini-container-rs/glossary/
curl -s -o /dev/null -w "%{http_code}\n" https://angelozdev.github.io/mini-container-rs/no-such-page/
```

Lo esperado es `200`, `200`, `200` y `404`. Después, abre la portada en el navegador y comprueba los estilos, un enlace de «El mapa» y una tarjeta del glosario.

### Task 3: el README enlaza a la guía publicada

Depende del PR #1 (`docs/readme`, el README en inglés) mezclado y de la tarea 2 en vivo. Se comprueba desde una entrada real: la portada del repo en GitHub muestra el enlace, y el enlace abre la guía.

**Files:**
- Modify: `README.md`, en la intro y en *Getting started*

- [ ] **Step 1: Crea la rama `docs/readme-pages-link` desde `main`**, ya con el PR #1 y la tarea 2 dentro.
- [ ] **Step 2: En la intro del README**, añade una línea: `**Read the guide online:** https://angelozdev.github.io/mini-container-rs/ (in Spanish).`
- [ ] **Step 3: En *Getting started***, la dirección local pasa de `http://localhost:4321` a `http://localhost:4321/mini-container-rs/`, porque con la base el servidor de desarrollo sirve ahí.
- [ ] **Step 4: Verifica.** `pnpm --dir guide check` debe pasar, aunque el README no entra en las pruebas. Además, `curl -s -o /dev/null -w "%{http_code}\n" https://angelozdev.github.io/mini-container-rs/` debe dar `200`.
- [ ] **Step 5: Commit y push.**

```bash
git add README.md
git commit -m "docs: link the README to the guide on GitHub Pages and to the local base URL"
git push -u origin docs/readme-pages-link
gh pr create --base main --title "Link the README to the guide on GitHub Pages" --body "<resumen>"
```

## Excepciones a los tramos verticales

Ninguna. Cada tarea termina en algo que se abre o se corre: el sitio local bajo la base, el sitio en Pages y el enlace en la portada del repo.
