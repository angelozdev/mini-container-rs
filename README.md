# mini-container-rs

Una guía paso a paso para escribir en Rust un contenedor mínimo: un programa `mini-container run <comando>` que lanza un comando aislado con namespaces y limitado con cgroups.

La guía vive en la carpeta `guide/`, es un sitio hecho con Starlight y está escrita en español.

## Abrir la guía

Hace falta Node y pnpm. Desde la raíz del repo:

```sh
pnpm --dir guide install
pnpm --dir guide dev
```

Abre la dirección que imprime `pnpm`, normalmente `http://localhost:4321`.

## Tu código

La raíz de este repo todavía no tiene `Cargo.toml` ni `src/`. Los creas tú en la parte 0 de la guía, y desde ahí todo el código Rust vive en la raíz.
