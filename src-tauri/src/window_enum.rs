use std::collections::HashMap;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use windows::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM, MAX_PATH, RECT};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowLongW, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
    GetWindowThreadProcessId, IsWindowVisible, GWL_EXSTYLE, WS_EX_TOOLWINDOW,
};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowProcessInfo {
    pub pid: u32,
    pub exe_path: String,
    pub window_title: String,
}

pub fn get_top_level_processes() -> Vec<WindowProcessInfo> {
    let mut processes: Vec<WindowProcessInfo> = Vec::new();

    // Use an unsafe block for FFI calls
    unsafe {
        let ptr = &mut processes as *mut Vec<WindowProcessInfo> as isize;
        EnumWindows(Some(enum_window_callback), LPARAM(ptr)).unwrap_or(());
    }

    // Deduplicate by executable path, preferring entries with longer window titles
    let mut unique = HashMap::new();
    for p in processes {
        let key = p.exe_path.to_lowercase();
        if let Some(existing) = unique.get(&key) {
            let existing: &WindowProcessInfo = existing;
            if existing.window_title.len() < p.window_title.len() {
                unique.insert(key, p);
            }
        } else {
            unique.insert(key, p);
        }
    }

    unique.into_values().collect()
}

unsafe extern "system" fn enum_window_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    if IsWindowVisible(hwnd).as_bool() {
        let style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        if (style & WS_EX_TOOLWINDOW.0) == 0 {
            let mut pid = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));

            if pid != 0 {
                // Ignore zero-sized hidden tool windows
                let mut rect = RECT::default();
                let _ = GetWindowRect(hwnd, &mut rect);
                if rect.right - rect.left <= 0 || rect.bottom - rect.top <= 0 {
                    return BOOL::from(true);
                }

                if let Some(exe_path) = get_process_path(pid) {
                    let path_lower = exe_path.to_lowercase();
                    // Ignore Windows system apps and UWP background apps
                    if path_lower.contains("c:\\windows\\")
                        || path_lower.contains("windowsapps")
                        || path_lower.contains("systemapps")
                    {
                        return BOOL::from(true);
                    }

                    let title = get_window_title(hwnd);
                    let title_lower = title.to_lowercase();

                    // Filter out background noise: actual user-facing apps always have a window title
                    // Also filter out common invisible helper windows that somehow get marked as visible
                    if !title.is_empty()
                        && !title_lower.contains("webhelper")
                        && !title_lower.contains("crashpad")
                        && title != "default ime"
                        && title != "msctfime ui"
                    {
                        let proc_info = WindowProcessInfo {
                            pid,
                            exe_path,
                            window_title: title,
                        };

                        let processes = &mut *(lparam.0 as *mut Vec<WindowProcessInfo>);
                        processes.push(proc_info);
                    }
                }
            }
        }
    }
    BOOL::from(true)
}

fn get_process_path(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buffer = [0u16; MAX_PATH as usize * 2];
        let mut size = buffer.len() as u32;

        let result = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(buffer.as_mut_ptr()),
            &mut size,
        );
        CloseHandle(handle).ok()?;

        if result.is_ok() {
            let path = OsString::from_wide(&buffer[..size as usize]);
            Some(path.to_string_lossy().into_owned())
        } else {
            None
        }
    }
}

fn get_window_title(hwnd: HWND) -> String {
    unsafe {
        let length = GetWindowTextLengthW(hwnd);
        if length == 0 {
            return String::new();
        }

        let mut buffer = vec![0u16; (length + 1) as usize];
        let copied = GetWindowTextW(hwnd, &mut buffer);

        if copied > 0 {
            OsString::from_wide(&buffer[..copied as usize])
                .to_string_lossy()
                .into_owned()
        } else {
            String::new()
        }
    }
}
