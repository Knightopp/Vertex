mod commands;
mod db;
#[cfg(target_os = "windows")]
mod hash_service;
#[cfg(target_os = "windows")]
mod icon_service;
#[cfg(target_os = "windows")]
mod metadata_extractor;
#[cfg(target_os = "windows")]
mod window_enum;

use commands::migration::migrate_old_data;
use commands::system::get_idle_duration_ms;
use db::Database;
use std::sync::Mutex;
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
use tauri::{Emitter, Manager, State};

struct DeepLinkState(Mutex<Option<String>>);

#[tauri::command]
fn get_deep_link(state: State<DeepLinkState>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            println!("ARGS: {:?}", std::env::args().collect::<Vec<_>>());

            app.manage(DeepLinkState(Mutex::new(None)));
            let db = Database::new(app.handle()).expect("Failed to initialize database");
            app.manage(Mutex::new(db));

            let args: Vec<String> = std::env::args().collect();
            if args.contains(&"--hidden".to_string()) {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide().unwrap();
                }
            }

            #[cfg(desktop)]
            {
                // Configure tray menu
                let quit_i = MenuItem::with_id(app, "quit", "Quit Vertex", true, None::<&str>).unwrap();
                let show_i =
                    MenuItem::with_id(app, "show", "Open Dashboard", true, None::<&str>).unwrap();
                let menu = Menu::with_items(app, &[&show_i, &quit_i]).unwrap();

                if let Some(tray) = app.tray_by_id("main") {
                    tray.set_menu(Some(menu)).unwrap();
                    tray.on_menu_event(|app, event| match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().unwrap();
                                window.set_focus().unwrap();
                            }
                        }
                        _ => {}
                    });
                    tray.on_tray_icon_event(|tray, event| match event {
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    window.hide().unwrap();
                                } else {
                                    window.show().unwrap();
                                    window.set_focus().unwrap();
                                }
                            }
                        }
                        _ => {}
                    });
                }
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::process::get_running_processes,
            commands::process::get_process_by_pid,
            commands::process::get_process_icon,
            commands::process::get_active_window,
            get_idle_duration_ms,
            migrate_old_data,
            commands::system::set_autostart,
            commands::system::launch_game,
            get_deep_link,
        ]);

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(url) = args.iter().find(|a| a.starts_with("vazorism://")) {
                let _ = std::fs::write(
                    "C:\\Users\\ABHIRAM C S\\Desktop\\Tracker\\exported\\debug_deep_link.txt",
                    url,
                );
                let state: State<DeepLinkState> = app.state();
                *state.0.lock().unwrap() = Some(url.clone());
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("deep-link-received", args.clone());
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
