use crate::db::Database;
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::Manager;
use tauri::State;

#[cfg(target_os = "windows")]
use crate::hash_service::{compute_sha256, get_file_metadata as get_fs_meta};
#[cfg(target_os = "windows")]
use crate::icon_service::get_or_extract_icon;
#[cfg(target_os = "windows")]
use crate::metadata_extractor::get_file_metadata;
#[cfg(target_os = "windows")]
use crate::window_enum::get_top_level_processes;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub exe_path: Option<String>,
    pub window_title: String,
    pub product_name: Option<String>,
    pub file_description: Option<String>,
    pub company_name: Option<String>,
    pub hash: Option<String>,
}

#[tauri::command]
pub fn get_running_processes(db: State<'_, Mutex<Database>>) -> Vec<ProcessInfo> {
    #[cfg(target_os = "windows")]
    {
        let windows = get_top_level_processes();
        let mut results = Vec::with_capacity(windows.len());

        let conn = if let Ok(guard) = db.lock() {
            Some(guard)
        } else {
            None
        };

        for w in windows {
            let path = Path::new(&w.exe_path);
            let name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            let meta = get_file_metadata(&w.exe_path);

            let mut hash = None;

            if let Some(ref db_guard) = conn {
                if let Ok((size, modified)) = get_fs_meta(path) {
                    let mut cached_hash: Option<String> = None;
                    let mut needs_hash = true;

                    if let Ok(mut stmt) = db_guard
                        .conn
                        .prepare("SELECT hash, size, modified_at FROM hash_cache WHERE path = ?")
                    {
                        if let Ok(mut rows) = stmt.query([&w.exe_path]) {
                            if let Ok(Some(row)) = rows.next() {
                                let c_hash: String = row.get(0).unwrap_or_default();
                                let c_size: u64 = row.get(1).unwrap_or(0);
                                let c_modified: u64 = row.get(2).unwrap_or(0);

                                if size == c_size && modified == c_modified {
                                    cached_hash = Some(c_hash);
                                    needs_hash = false;
                                }
                            }
                        }
                    }

                    if needs_hash {
                        if let Ok(computed) = compute_sha256(path) {
                            let _ = db_guard.conn.execute(
                                "INSERT OR REPLACE INTO hash_cache (hash, path, size, modified_at) VALUES (?, ?, ?, ?)",
                                (&computed, &w.exe_path, size, modified)
                            );
                            cached_hash = Some(computed);
                        }
                    }

                    hash = cached_hash;
                }
            }

            results.push(ProcessInfo {
                pid: w.pid,
                name,
                exe_path: Some(w.exe_path),
                window_title: w.window_title,
                product_name: meta.product_name,
                file_description: meta.file_description,
                company_name: meta.company_name,
                hash,
            });
        }

        results
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

#[tauri::command]
pub fn get_process_by_pid(pid: u32) -> Option<ProcessInfo> {
    #[cfg(target_os = "windows")]
    {
        let windows = get_top_level_processes();
        let w = windows.into_iter().find(|w| w.pid == pid)?;

        let path = Path::new(&w.exe_path);
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        let meta = get_file_metadata(&w.exe_path);

        Some(ProcessInfo {
            pid: w.pid,
            name,
            exe_path: Some(w.exe_path),
            window_title: w.window_title,
            product_name: meta.product_name,
            file_description: meta.file_description,
            company_name: meta.company_name,
            hash: None,
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[tauri::command]
pub fn get_process_icon(
    app_handle: tauri::AppHandle,
    exe_path: String,
    hash: String,
) -> Option<Vec<u8>> {
    #[cfg(target_os = "windows")]
    {
        let app_data_dir = app_handle.path().app_data_dir().unwrap_or_default();

        if let Some(icon_path) = get_or_extract_icon(&exe_path, &hash, &app_data_dir) {
            if let Ok(bytes) = std::fs::read(icon_path) {
                return Some(bytes);
            }
        }

        None
    }

    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActiveWindow {
    pub pid: u32,
    pub is_idle: bool, // We can determine this from get_idle_duration_ms
}

#[tauri::command]
pub fn get_active_window() -> Option<ActiveWindow> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0 == std::ptr::null_mut() {
                return None;
            }

            let mut pid = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));

            if pid != 0 {
                Some(ActiveWindow {
                    pid,
                    is_idle: false, // Updated by frontend combined with idle duration
                })
            } else {
                None
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}
