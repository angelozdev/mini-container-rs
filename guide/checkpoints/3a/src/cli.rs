use std::path::PathBuf;

#[derive(Debug, PartialEq, Eq)]
pub struct CommandLine {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Invocation {
    Run(CommandLine),
    Child {
        cgroup: PathBuf,
        command: CommandLine,
    },
}

pub const USAGE: &str = "usage: mini-container run <program> [args...]";

pub fn parse(args: impl IntoIterator<Item = String>) -> Option<Invocation> {
    let mut args = args.into_iter();
    match args.next()?.as_str() {
        "run" => Some(Invocation::Run(parse_command(args)?)),
        "child" => {
            let cgroup = PathBuf::from(args.next()?);
            Some(Invocation::Child {
                cgroup,
                command: parse_command(args)?,
            })
        }
        _ => None,
    }
}

fn parse_command(mut args: impl Iterator<Item = String>) -> Option<CommandLine> {
    let program = args.next()?;
    Some(CommandLine {
        program,
        args: args.collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(parts: &[&str]) -> Vec<String> {
        parts.iter().copied().map(String::from).collect()
    }

    #[test]
    fn parses_run_with_program_and_args() {
        let invocation = parse(strings(&["run", "/bin/sh", "-c", "exit 3"]));

        assert_eq!(
            invocation,
            Some(Invocation::Run(CommandLine {
                program: "/bin/sh".to_string(),
                args: strings(&["-c", "exit 3"]),
            }))
        );
    }

    #[test]
    fn parses_child_with_cgroup_and_command() {
        let invocation = parse(strings(&[
            "child",
            "/sys/fs/cgroup/mini-container-4172",
            "/bin/ps",
            "-o",
            "pid,comm",
        ]));

        assert_eq!(
            invocation,
            Some(Invocation::Child {
                cgroup: PathBuf::from("/sys/fs/cgroup/mini-container-4172"),
                command: CommandLine {
                    program: "/bin/ps".to_string(),
                    args: strings(&["-o", "pid,comm"]),
                },
            })
        );
    }

    #[test]
    fn rejects_child_without_program() {
        assert_eq!(
            parse(strings(&["child", "/sys/fs/cgroup/mini-container-4172"])),
            None
        );
    }

    #[test]
    fn rejects_empty_args() {
        assert_eq!(parse(strings(&[])), None);
    }

    #[test]
    fn rejects_run_without_program() {
        assert_eq!(parse(strings(&["run"])), None);
    }

    #[test]
    fn rejects_unknown_subcommand() {
        assert_eq!(parse(strings(&["start", "/bin/sh"])), None);
    }
}
