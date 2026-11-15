# mini-container-rs

Una guía paso a paso para escribir, tú mismo y en Rust, un contenedor mínimo. Sin Docker: con las mismas piezas del kernel de Linux que Docker usa por dentro, los *namespaces* y los *cgroups*.

Al terminar tienes un programa que lanza un comando con su propio nombre de máquina, su propia lista de procesos, sus propios archivos y un tope de memoria. Y puedes explicar, con lo que construiste, qué es un contenedor y en qué se diferencia de una máquina virtual.

La guía está en español. Vive en [`guide/`](guide/), como un sitio hecho con [Astro Starlight](https://starlight.astro.build/).

## Qué vas a construir

Un programa llamado `mini-container`, que se usa así:

```sh
sudo ./target/debug/mini-container run /bin/sh
```

El comando corre como un proceso normal, pero el kernel le muestra un mundo recortado. Lo construyes por partes, y cada parte termina en algo que corres y ves en la terminal:

| Parte | Qué logras |
| --- | --- |
| 0 · Preparación | Una máquina Linux de OrbStack, el proyecto de Rust creado y el editor configurado |
| 1 · Lanzar un proceso | `mini-container run /bin/sh` abre un shell y devuelve su código de salida, todavía sin aislamiento |
| 2 · Namespaces | Un hostname propio, ser el PID 1 de una lista de procesos propia y ver solo los archivos de Alpine |
| 3 · cgroups | Un límite de 50 MB de RAM, y limpieza completa aunque pulses Ctrl-C |
| Cierre | Comparar tu programa con Docker: el tuyo hace el papel de `runc` |

La parte 4, OverlayFS, llegará más adelante.

## Cómo se aprende con esta guía

- **Tú tecleas todo el código.** La guía lo da en trozos pequeños y explica cada línea. Teclea, no copies: el que teclea lee cada línea.
- **Cada sección termina en algo que corres.** Primero ves el resultado, después entiendes por qué.
- **Las dudas se las preguntas a un agente**, como Claude Code. Pídele pistas antes que respuestas.
- **Cada sección de código trae una prueba** para tu programa. Te dice si hace lo que la sección pide.

## Requisitos

La guía está escrita y probada con:

- Un Mac con Apple silicon.
- [OrbStack](https://orbstack.dev/), con una máquina Ubuntu 26.04 `aarch64`. Ahí se compila y se corre el programa, porque los namespaces y los cgroups solo existen en Linux. La sección 0a crea la máquina e instala Rust dentro.
- `rustup` en el Mac, para que el editor revise tu código como código de Linux.
- [Zed](https://zed.dev/) como editor. La sección 0b lo configura. Otro editor sirve, pero tendrás que configurarlo tú.
- Para abrir la guía: Node 22.23.4 o más reciente y pnpm. Node lo piden Astro 7.4.4 y `@astrojs/mdx` 8.1.5, según `guide/pnpm-lock.yaml`, y el campo `packageManager` de `guide/package.json` fija pnpm 11.28.7.

## Empezar

```sh
git clone https://github.com/angelozdev/mini-container-rs.git
cd mini-container-rs
pnpm --dir guide install
pnpm --dir guide dev
```

Abre la dirección que imprime `pnpm`, normalmente `http://localhost:4321`, y empieza por la sección 0a.

La guía escribe la carpeta del repo como `/Users/tu-usuario/mini-container-rs`. Cada vez que la veas, lee la tuya.

## Qué hay en el repo

```text
mini-container-rs/
├── guide/
│   ├── src/content/docs/   las secciones de la guía, en MDX
│   ├── checkpoints/        el código de referencia de cada sección
│   ├── scripts/            la prueba de tu código, check-my-code.sh
│   └── tests/              las pruebas de la propia guía
├── Cargo.toml              ┐ tu código: no viene en el repo,
└── src/                    ┘ lo creas tú en la sección 0b
```

`guide/checkpoints/` tiene la solución de cada sección: la guía se comprueba contra ella. Si estás aprendiendo, no la abras. Para saber si tu código está bien, usa la prueba de la sección.

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

## Licencia

[MIT](LICENSE).
