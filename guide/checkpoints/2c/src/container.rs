use std::convert::Infallible;
use std::os::unix::process::{CommandExt, ExitStatusExt};
use std::path::Path;
use std::process::{Command, ExitCode, ExitStatus};

use anyhow::{Context, Result};

use crate::cli::CommandLine;
use crate::{filesystem, namespaces};

pub fn run(command: &CommandLine) -> Result<ExitCode> {
    let executable = std::env::current_exe()?;
    namespaces::unshare_namespaces()?;
    namespaces::set_hostname(namespaces::HOSTNAME)?;
    let status = Command::new(executable)
        .arg("child")
        .arg(&command.program)
        .args(&command.args)
        .status()
        .context("could not launch the program")?;
    Ok(ExitCode::from(exit_code(status)))
}

pub fn init(command: &CommandLine) -> Result<Infallible> {
    filesystem::make_mounts_private()?;
    filesystem::enter_rootfs(Path::new(filesystem::ROOTFS))?;
    filesystem::mount_proc()?;
    let error = Command::new(&command.program).args(&command.args).exec();
    Err(error).with_context(|| format!("could not run `{}`", command.program))
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
