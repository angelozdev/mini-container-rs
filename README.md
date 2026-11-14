# mini-container-rs

Una guía paso a paso para escribir en Rust un contenedor mínimo: un programa `mini-container run <comando>` que lanza un comando aislado con namespaces y limitado con cgroups.

La guía vive en la carpeta `guide/`, es un sitio hecho con Starlight y está escrita en español.

## Abrir la guía

Hace falta Node 22.23.4 o más reciente (lo piden Astro 7.4.4 y `@astrojs/mdx` 8.1.5, según `guide/pnpm-lock.yaml`) y pnpm. El campo `packageManager` de `guide/package.json` fija pnpm 11.28.7. Desde la raíz del repo:

```sh
pnpm --dir guide install
pnpm --dir guide dev
```

Abre la dirección que imprime `pnpm`, normalmente `http://localhost:4321`.

## Tu código

Tu código Rust vive en la raíz de este repo, en `Cargo.toml` y `src/`. Los creas tú en la parte 0 de la guía: la guía no los trae hechos. Cuando los guardes con `git commit`, pasan a ser parte del repo.

## Comprobar tu código

Cada sección de código, de 1a a 3b, trae una prueba para tu programa. Se corre dentro de la máquina Linux, desde la raíz del repo y después de compilar con `cargo build`:

```sh
sudo guide/scripts/check-my-code.sh 1a
```

- `sudo`: corre el comando como administrador. La prueba lo pide siempre.
- `guide/scripts/check-my-code.sh`: el script que corre tu binario, `target/debug/mini-container`, con casos buenos y malos.
- `1a`: la sección cuya prueba se corre. Cambia el número por el de la sección que hiciste.
- Efecto: imprime `OK 1a` si tu programa hace lo que esa sección pide. Si no, dice qué caso falló.

## Comprobar la guía

Si cambias la guía, corre esto en el Mac, desde la raíz del repo y después de `pnpm --dir guide install`:

```sh
pnpm --dir guide check
```

- `pnpm --dir guide`: corre `pnpm` dentro de la carpeta `guide/`.
- `check`: construye el sitio y corre todas las pruebas de `guide/tests/`.
- Efecto: termina sin errores si el sitio compila y las pruebas pasan. No toca tu código: solo genera las carpetas `guide/dist/` y `guide/.astro/`, que git ignora.
