mod cgroup;
mod cli;
mod container;
mod filesystem;
mod namespaces;
mod signals;

use std::env;
use std::process::ExitCode;

fn main() -> anyhow::Result<ExitCode> {
    match cli::parse(env::args().skip(1)) {
        Some(cli::Invocation::Run(command)) => container::run(&command),
        Some(cli::Invocation::Child { cgroup, command }) => {
            match container::init(&cgroup, &command)? {}
        }
        None => {
            eprintln!("{}", cli::USAGE);
            Ok(ExitCode::from(2))
        }
    }
}
