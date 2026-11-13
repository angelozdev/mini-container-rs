use std::convert::Infallible;
use std::os::unix::process::{CommandExt, ExitStatusExt};
use std::path::Path;
use std::process::{Command, ExitCode, ExitStatus};

use anyhow::{Context, Result};

use crate::cgroup::{self, Cgroup, MEMORY_MAX};
use crate::cli::CommandLine;
use crate::{filesystem, namespaces};

pub fn run(command: &CommandLine) -> Result<ExitCode> {
    let executable = std::env::current_exe()?;
    namespaces::unshare_namespaces()?;
    namespaces::set_hostname(namespaces::HOSTNAME)?;
    let cgroup = Cgroup::create(&format!("mini-container-{}", std::process::id()))?;
    cgroup.limit_memory(MEMORY_MAX)?;
    let status = Command::new(executable)
        .arg("child")
        .arg(cgroup.path())
        .arg(&command.program)
        .args(&command.args)
        .status()
        .context("could not launch the program")?;
    let oom_kills = cgroup.oom_kills()?;
    if oom_kills > 0 {
        eprintln!("the kernel killed a process for running out of memory (oom_kill: {oom_kills})");
    }
    Ok(ExitCode::from(exit_code(status)))
}

pub fn init(cgroup: &Path, command: &CommandLine) -> Result<Infallible> {
    cgroup::join(cgroup)?;
    namespaces::unshare_mounts()?;
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
