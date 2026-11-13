mod cli;
mod container;
mod namespaces;

use std::env;
use std::process::ExitCode;

fn main() -> anyhow::Result<ExitCode> {
    match cli::parse(env::args().skip(1)) {
        Some(cli::Invocation::Run(command)) => container::run(&command),
        None => {
            eprintln!("{}", cli::USAGE);
            Ok(ExitCode::from(2))
        }
    }
}
