use anyhow::{Context, Result};
use nix::sys::prctl::set_pdeathsig;
use nix::sys::signal::{SigSet, Signal};

pub fn block_interrupts() -> Result<()> {
    interrupts()
        .thread_block()
        .context("could not block SIGINT")
}

pub fn unblock_interrupts() -> Result<()> {
    interrupts()
        .thread_unblock()
        .context("could not unblock SIGINT")
}

pub fn die_with_parent() -> Result<()> {
    set_pdeathsig(Signal::SIGKILL).context("could not ask to die with the parent")
}

fn interrupts() -> SigSet {
    let mut signals = SigSet::empty();
    signals.add(Signal::SIGINT);
    signals
}

#[cfg(test)]
mod tests {
    use super::*;
    use nix::sys::prctl::get_pdeathsig;

    fn blocked_signals() -> SigSet {
        SigSet::thread_get_mask().unwrap()
    }

    #[test]
    fn blocking_interrupts_adds_sigint_to_the_mask() {
        block_interrupts().unwrap();
        let blocked = blocked_signals().contains(Signal::SIGINT);
        unblock_interrupts().unwrap();

        assert!(blocked);
    }

    #[test]
    fn unblocking_interrupts_removes_sigint_from_the_mask() {
        block_interrupts().unwrap();
        unblock_interrupts().unwrap();

        assert!(!blocked_signals().contains(Signal::SIGINT));
    }

    #[test]
    fn dying_with_the_parent_asks_for_sigkill() {
        die_with_parent().unwrap();
        let asked = get_pdeathsig().unwrap();
        set_pdeathsig(None).unwrap();

        assert_eq!(asked, Some(Signal::SIGKILL));
    }
}
