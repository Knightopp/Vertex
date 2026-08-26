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
    pub hwnd: usize,
}

pub fn get_top_level_processes() -> Vec<WindowProcessInfo> {
    let mut processes: Vec<WindowProcessInfo> = Vec::new();

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

                // Resolve the exe path for this PID
                let exe_path = match get_process_path(pid) {
                    Some(p) => p,
                    None => return BOOL::from(true),
                };

                let file_name = std::path::Path::new(&exe_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default()
                    .to_lowercase();

                let title = get_window_title(hwnd);
                let title_lower = title.trim().to_lowercase();

                // Filter out background noise and system host processes
                let is_background = file_name == "searchhost.exe"
                    || file_name == "shellexperiencehost.exe"
                    || file_name == "startmenuexperiencehost.exe"
                    || file_name == "lockapp.exe"
                    || file_name == "textinputhost.exe"
                    || file_name == "dwm.exe"
                    || file_name == "sihost.exe"
                    || file_name == "taskhostw.exe"
                    || file_name == "ctfmon.exe"
                    || file_name == "runtimebroker.exe"
                    || file_name == "widgets.exe"
                    || file_name == "searchapp.exe"
                    || file_name == "backgroundtaskhost.exe"
                    || file_name == "fontdrvhost.exe"
                    || file_name == "smartscreen.exe"
                    || file_name == "securityhealthsystray.exe"
                    || file_name == "compattelrunner.exe"
                    || file_name == "conhost.exe"
                    || (file_name == "applicationframehost.exe"
                        && (title_lower.is_empty() || title_lower == "application frame host"))
                    || title_lower.is_empty()
                    || title_lower == "program manager"
                    || title_lower == "windows input experience"
                    || title_lower == "default ime"
                    || title_lower == "msctfime ui"
                    || title_lower == "media context notification"
                    || title_lower.contains("webhelper")
                    || title_lower.contains("crashpad");

                if !is_background {
                    let proc_info = WindowProcessInfo {
                        pid,
                        exe_path,
                        window_title: title,
                        hwnd: hwnd.0 as usize,
                    };

                    let processes = &mut *(lparam.0 as *mut Vec<WindowProcessInfo>);
                    processes.push(proc_info);
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
