#[derive(Debug, PartialEq, Eq)]
pub struct CommandLine {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Invocation {
    Run(CommandLine),
    Child(CommandLine),
}

pub const USAGE: &str = "usage: mini-container run <program> [args...]";

pub fn parse(args: impl IntoIterator<Item = String>) -> Option<Invocation> {
    let mut args = args.into_iter();
    let invocation = match args.next()?.as_str() {
        "run" => Invocation::Run,
        "child" => Invocation::Child,
        _ => return None,
    };
    let program = args.next()?;
    Some(invocation(CommandLine {
        program,
        args: args.collect(),
    }))
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
    fn parses_child_with_program_and_args() {
        let invocation = parse(strings(&["child", "/bin/ps", "-o", "pid,comm"]));

        assert_eq!(
            invocation,
            Some(Invocation::Child(CommandLine {
                program: "/bin/ps".to_string(),
                args: strings(&["-o", "pid,comm"]),
            }))
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
