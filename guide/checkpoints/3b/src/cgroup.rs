use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

const CGROUP_ROOT: &str = "/sys/fs/cgroup";
pub const MEMORY_MAX: &str = "50M";

pub struct Cgroup {
    path: PathBuf,
}

impl Cgroup {
    pub fn create(name: &str) -> Result<Self> {
        let path = Path::new(CGROUP_ROOT).join(name);
        fs::create_dir(&path)
            .with_context(|| format!("could not create the cgroup {}", path.display()))?;
        Ok(Self { path })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn limit_memory(&self, max: &str) -> Result<()> {
        self.write("memory.max", max)?;
        self.write("memory.swap.max", "0")
    }

    pub fn oom_kills(&self) -> Result<u64> {
        let events_path = self.path.join("memory.events");
        let events = fs::read_to_string(&events_path)
            .with_context(|| format!("could not read {}", events_path.display()))?;
        parse_oom_kills(&events).context("memory.events has no oom_kill counter")
    }

    fn write(&self, file: &str, value: &str) -> Result<()> {
        let path = self.path.join(file);
        fs::write(&path, value)
            .with_context(|| format!("could not write {value} to {}", path.display()))
    }
}

impl Drop for Cgroup {
    fn drop(&mut self) {
        if let Err(error) = fs::remove_dir(&self.path) {
            eprintln!(
                "could not remove the cgroup {}: {error}",
                self.path.display()
            );
        }
    }
}

pub fn join(path: &Path) -> Result<()> {
    let procs = path.join("cgroup.procs");
    fs::write(&procs, std::process::id().to_string())
        .with_context(|| format!("could not join the cgroup {}", path.display()))
}

fn parse_oom_kills(events: &str) -> Option<u64> {
    events
        .lines()
        .find_map(|line| line.strip_prefix("oom_kill ")?.parse().ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_oom_kill_counter() {
        let events = "low 0\nhigh 0\nmax 68\noom 1\noom_kill 1\noom_group_kill 0\n";

        assert_eq!(parse_oom_kills(events), Some(1));
    }

    #[test]
    fn missing_counter_is_none() {
        let events = "low 0\nhigh 0\nmax 68\noom 1\noom_group_kill 0\n";

        assert_eq!(parse_oom_kills(events), None);
    }

    #[test]
    fn dropping_removes_the_folder() {
        let path = std::env::temp_dir().join(format!("mini-container-drop-{}", std::process::id()));
        fs::create_dir(&path).unwrap();

        drop(Cgroup { path: path.clone() });

        assert!(!path.exists());
    }
}
