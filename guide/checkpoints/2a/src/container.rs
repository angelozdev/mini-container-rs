use std::os::unix::process::ExitStatusExt;
use std::process::{Command, ExitCode, ExitStatus};

use anyhow::{Context, Result};

use crate::cli::CommandLine;
use crate::namespaces;

pub fn run(command: &CommandLine) -> Result<ExitCode> {
    namespaces::unshare_namespaces()?;
    namespaces::set_hostname(namespaces::HOSTNAME)?;
    let status = Command::new(&command.program)
        .args(&command.args)
        .status()
        .context("could not launch the program")?;
    Ok(ExitCode::from(exit_code(status)))
}

fn exit_code(status: ExitStatus) -> u8 {
    const SIGNAL_EXIT_BASE: u8 = 128;

    match status.code() {
        Some(code) => code as u8,
        None => SIGNAL_EXIT_BASE + status.signal().unwrap_or_default() as u8,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_exit_keeps_its_code() {
        assert_eq!(exit_code(ExitStatus::from_raw(3 << 8)), 3);
    }

    #[test]
    fn signal_exit_is_128_plus_signal() {
        assert_eq!(exit_code(ExitStatus::from_raw(9)), 137);
    }
}
