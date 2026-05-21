#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error_overlay;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window must exist from tauri.conf.json");

            // Show the window 1500ms after launch as a fallback in case the
            // page load event never fires (e.g. renderer failure path).
            let win_fallback = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(3000));
                let _ = win_fallback.show();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
