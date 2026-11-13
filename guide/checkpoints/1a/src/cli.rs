pub struct CommandLine {
    pub program: String,
    pub args: Vec<String>,
}

pub enum Invocation {
    Run(CommandLine),
}

pub const USAGE: &str = "uso: mini-container run <programa> [argumentos...]";

pub fn parse(args: impl IntoIterator<Item = String>) -> Option<Invocation> {
    let mut args = args.into_iter();
    match args.next()?.as_str() {
        "run" => {
            let program = args.next()?;
            Some(Invocation::Run(CommandLine {
                program,
                args: args.collect(),
            }))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(parts: &[&str]) -> Vec<String> {
        parts.iter().copied().map(String::from).collect()
    }

    #[test]
    fn parses_run_with_program_and_args() {
        let Some(Invocation::Run(command)) = parse(strings(&["run", "/bin/sh", "-c", "exit 3"]))
        else {
            panic!("expected a run invocation");
        };

        assert_eq!(command.program, "/bin/sh");
        assert_eq!(command.args, strings(&["-c", "exit 3"]));
    }

    #[test]
    fn rejects_empty_args() {
        assert!(parse(strings(&[])).is_none());
    }

    #[test]
    fn rejects_run_without_program() {
        assert!(parse(strings(&["run"])).is_none());
    }

    #[test]
    fn rejects_unknown_subcommand() {
        assert!(parse(strings(&["start", "/bin/sh"])).is_none());
    }
}
