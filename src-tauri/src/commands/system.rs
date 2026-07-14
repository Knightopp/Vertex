/// Returns the number of milliseconds since the user last provided input
/// (mouse movement, keyboard press). Used for idle detection during playtime tracking.
///
/// Uses the Win32 `GetLastInputInfo` API on Windows.
/// Returns 0 on non-Windows platforms (future-proofing).
#[tauri::command]
pub fn get_idle_duration_ms() -> u64 {
    #[cfg(target_os = "windows")]
    {
        use std::mem;

        #[repr(C)]
        struct LastInputInfo {
            cb_size: u32,
            dw_time: u32,
        }

        extern "system" {
            fn GetLastInputInfo(plii: *mut LastInputInfo) -> i32;
            fn GetTickCount() -> u32;
        }

        unsafe {
            let mut lii = LastInputInfo {
                cb_size: mem::size_of::<LastInputInfo>() as u32,
                dw_time: 0,
            };

            if GetLastInputInfo(&mut lii) != 0 {
                let current_tick = GetTickCount();
                // Handle tick count wraparound (happens every ~49.7 days)
                let idle_ms = if current_tick >= lii.dw_time {
                    current_tick - lii.dw_time
                } else {
                    // Wraparound case
                    (u32::MAX - lii.dw_time) + current_tick + 1
                };
                idle_ms as u64
            } else {
                0
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        0
    }
}

#[tauri::command]
pub fn set_autostart(enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::env;
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let path = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";

        let key = hkcu
            .open_subkey_with_flags(path, KEY_SET_VALUE)
            .map_err(|e| format!("Failed to open registry key: {}", e))?;

        let app_name = "Vazorism";

        if enable {
            let exe_path =
                env::current_exe().map_err(|e| format!("Failed to get exe path: {}", e))?;

            // Critical fix: wrap the path in double quotes and add --hidden
            let value = format!("\"{}\" --hidden", exe_path.display());

            key.set_value(app_name, &value)
                .map_err(|e| format!("Failed to set registry value: {}", e))?;
        } else {
            let _ = key.delete_value(app_name); // Ignore error if it doesn't exist
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Autostart only implemented for Windows".into())
    }
}

#[tauri::command]
pub fn launch_game(path_or_url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path_or_url])
            .spawn()
            .map_err(|e| format!("Failed to launch game: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Game launching only supported on Windows".into())
    }
}
