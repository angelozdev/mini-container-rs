use std::fs::{self, Permissions};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

use anyhow::{Context, Result};
use nix::mount::{MntFlags, MsFlags, mount, umount2};
use nix::sys::stat::{Mode, SFlag, makedev, mknod};
use nix::unistd::{chdir, pivot_root};

pub const ROOTFS: &str = "/var/lib/mini-container/alpine";

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

pub fn enter_rootfs(rootfs: &Path) -> Result<()> {
    bind_mount_onto_itself(rootfs)?;
    mount_dev(&rootfs.join("dev"))?;
    switch_root(rootfs)
}

fn bind_mount_onto_itself(rootfs: &Path) -> Result<()> {
    mount(
        Some(rootfs),
        rootfs,
        None::<&str>,
        MsFlags::MS_BIND | MsFlags::MS_REC,
        None::<&str>,
    )
    .with_context(|| {
        format!(
            "could not find the alpine root filesystem at {}",
            rootfs.display()
        )
    })
}

fn mount_dev(dev: &Path) -> Result<()> {
    const MEMORY_DEVICES: u64 = 1;
    const NULL: u64 = 3;
    const ZERO: u64 = 5;

    mount(
        Some("tmpfs"),
        dev,
        Some("tmpfs"),
        MsFlags::empty(),
        None::<&str>,
    )
    .context("could not mount a tmpfs on /dev")?;
    create_device(&dev.join("null"), MEMORY_DEVICES, NULL)?;
    create_device(&dev.join("zero"), MEMORY_DEVICES, ZERO)
}

fn create_device(path: &Path, major: u64, minor: u64) -> Result<()> {
    const OPEN_TO_EVERYONE: u32 = 0o666;

    mknod(
        path,
        SFlag::S_IFCHR,
        Mode::from_bits_truncate(OPEN_TO_EVERYONE),
        makedev(major, minor),
    )
    .with_context(|| format!("could not create {}", path.display()))?;
    fs::set_permissions(path, Permissions::from_mode(OPEN_TO_EVERYONE))
        .with_context(|| format!("could not open {} to everyone", path.display()))
}

fn switch_root(rootfs: &Path) -> Result<()> {
    chdir(rootfs).context("could not enter the root filesystem")?;
    pivot_root(".", ".").context("could not pivot into the root filesystem")?;
    umount2(".", MntFlags::MNT_DETACH).context("could not detach the old root")?;
    chdir("/").context("could not move to the new root")
}
