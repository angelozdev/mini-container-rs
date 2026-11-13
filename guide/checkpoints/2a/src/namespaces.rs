use anyhow::{Context, Result};
use nix::sched::{CloneFlags, unshare};
use nix::unistd::sethostname;

pub const HOSTNAME: &str = "container";

pub fn unshare_namespaces() -> Result<()> {
    unshare(CloneFlags::CLONE_NEWUTS)
        .context("could not create the namespaces: did you run it with sudo?")
}

pub fn set_hostname(name: &str) -> Result<()> {
    sethostname(name).context("could not set the hostname")
}
