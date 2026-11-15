# mini-container-rs

A step-by-step guide to writing a minimal container yourself, in Rust. No Docker: just the same Linux kernel features that Docker uses under the hood, *namespaces* and *cgroups*.

By the end you have a program that runs a command with its own hostname, its own process list, its own files and a memory limit. And you can explain, with what you built, what a container is and how it differs from a virtual machine.

**The guide is written in Spanish.** It lives in [`guide/`](guide/), as a site built with [Astro Starlight](https://starlight.astro.build/).

## What you build

A program called `mini-container`, used like this:

```sh
sudo ./target/debug/mini-container run /bin/sh
```

The command runs as a normal process, but the kernel shows it a trimmed-down world. You build it part by part, and every part ends with something you run and see in the terminal:

| Part | What you get |
| --- | --- |
| 0 · Setup | An OrbStack Linux machine, the Rust project created and the editor configured |
| 1 · Launch a process | `mini-container run /bin/sh` opens a shell and returns its exit code, still without isolation |
| 2 · Namespaces | Its own hostname, being PID 1 of its own process list, and seeing only Alpine's files |
| 3 · cgroups | A 50 MB RAM limit, and a full cleanup even when you press Ctrl-C |
| Closing | Comparing your program with Docker: yours plays the role of `runc` |

Part 4, OverlayFS, is coming later.

## How the guide teaches

- **You type all the code.** The guide gives it in small pieces and explains every line. Type it, don't copy it: whoever types reads every line.
- **Every section ends with something you run.** You see the result first, then you understand why.
- **You ask your questions to a coding agent**, such as Claude Code. Ask it for hints before answers.
- **Every code section comes with a test** for your program. It tells you whether it does what the section asks.

## Requirements

The guide is written and tested with:

- A Mac with Apple silicon.
- [OrbStack](https://orbstack.dev/), with an Ubuntu 26.04 `aarch64` machine. That is where the program is built and run, because namespaces and cgroups only exist on Linux. Section 0a creates the machine and installs Rust in it.
- `rustup` on the Mac, so the editor checks your code as Linux code.
- [Zed](https://zed.dev/) as the editor. Section 0b configures it. Another editor works, but you will have to configure it yourself.
- To open the guide: Node 22.23.4 or newer, and pnpm. Astro 7.4.4 and `@astrojs/mdx` 8.1.5 require that Node version, according to `guide/pnpm-lock.yaml`, and the `packageManager` field of `guide/package.json` pins pnpm 11.28.7.

## Getting started

```sh
git clone https://github.com/angelozdev/mini-container-rs.git
cd mini-container-rs
pnpm --dir guide install
pnpm --dir guide dev
```

Open the address that `pnpm` prints, usually `http://localhost:4321`, and start with section 0a.

The guide writes the repo folder as `/Users/tu-usuario/mini-container-rs`, where *tu-usuario* means "your user". Whenever you see it, read your own path.

## What's in the repo

```text
mini-container-rs/
├── guide/
│   ├── src/content/docs/   the guide's sections, in MDX
│   ├── checkpoints/        the reference code for each section
│   ├── scripts/            the test for your code, check-my-code.sh
│   └── tests/              the tests for the guide itself
├── Cargo.toml              ┐ your code: not in the repo,
└── src/                    ┘ you create it in section 0b
```

`guide/checkpoints/` holds the solution for each section: the guide is checked against it. If you are learning, don't open it. To find out whether your code is right, use the section's test.

## Check your code

Every code section, from 1a to 3b, comes with a test for your program. Run it inside the Linux machine, from the repo root, after building with `cargo build`:

```sh
sudo guide/scripts/check-my-code.sh 1a
```

- `sudo`: runs the command as administrator. The test always asks for it.
- `guide/scripts/check-my-code.sh`: the script that runs your binary, `target/debug/mini-container`, with good and bad cases.
- `1a`: the section whose test runs. Change it to the section you finished.
- Effect: prints `OK 1a` if your program does what that section asks. If not, it says which case failed.

## Check the guide

If you change the guide, run this on the Mac, from the repo root, after `pnpm --dir guide install`:

```sh
pnpm --dir guide check
```

- `pnpm --dir guide`: runs `pnpm` inside the `guide/` folder.
- `check`: builds the site and runs every test in `guide/tests/`.
- Effect: finishes without errors if the site builds and the tests pass. It doesn't touch your code: it only creates the `guide/dist/` and `guide/.astro/` folders, which git ignores.

## License

[MIT](LICENSE).
