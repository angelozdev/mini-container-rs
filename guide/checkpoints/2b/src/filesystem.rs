use anyhow::{Context, Result};
use nix::mount::{MsFlags, mount};

pub fn make_mounts_private() -> Result<()> {
    mount(
        None::<&str>,
        "/",
        None::<&str>,
        MsFlags::MS_REC | MsFlags::MS_PRIVATE,
        None::<&str>,
    )
    .context("could not make the mounts private")
}

pub fn mount_proc() -> Result<()> {
    mount(
        Some("proc"),
        "/proc",
        Some("proc"),
        MsFlags::empty(),
        None::<&str>,
    )
    .context("could not mount /proc")
}
