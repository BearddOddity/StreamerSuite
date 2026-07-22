// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Invoked by the NSIS uninstaller (before it deletes app files) so saved
    // Multi-Chat Client IDs/Secrets and tokens don't silently survive an
    // uninstall — Windows Credential Manager isn't part of what an
    // uninstaller cleans up on its own. Exits immediately, no window opens.
    if std::env::args().any(|a| a == "--clear-credentials") {
        chatconfluence_lib::multichat::wipe_all_credentials();
        return;
    }
    chatconfluence_lib::run();
}
