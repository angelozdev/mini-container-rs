#[derive(Debug, PartialEq, Eq)]
pub struct CommandLine {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug, PartialEq, Eq)]
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
