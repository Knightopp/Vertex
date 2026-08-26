/// Returns the number of milliseconds since the user last provided input
/// (mouse movement, keyboard press). Used for idle detection during playtime tracking.
///
/// Uses the Win32 `GetLastInputInfo` API on Windows.
/// Returns 0 on non-Windows platforms (future-proofing).
#[tauri::command]
pub fn get_battery_status() -> Option<(u8, bool)> {
    #[cfg(target_os = "windows")]
    {
        #[repr(C)]
        struct SystemPowerStatus {
            ac_line_status: u8,
            battery_flag: u8,
            battery_life_percent: u8,
            system_status_flag: u8,
            battery_life_time: u32,
            battery_full_life_time: u32,
        }
        extern "system" {
            fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SystemPowerStatus) -> i32;
        }
        unsafe {
            let mut status = SystemPowerStatus {
                ac_line_status: 0,
                battery_flag: 0,
                battery_life_percent: 0,
                system_status_flag: 0,
                battery_life_time: 0,
                battery_full_life_time: 0,
            };
            if GetSystemPowerStatus(&mut status) != 0 {
                if status.battery_life_percent <= 100 {
                    return Some((status.battery_life_percent, status.ac_line_status != 0));
                }
            }
        }
    }
    None
}

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
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd")
            .creation_flags(0x08000000)
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

#[tauri::command]
pub fn lock_pc() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let _ = windows::Win32::System::Shutdown::LockWorkStation();
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not implemented on this OS".into())
    }
}

#[tauri::command]
pub fn shutdown_pc() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("shutdown")
            .creation_flags(0x08000000)
            .args(["/s", "/f", "/t", "0"])
            .spawn()
            .map_err(|e| format!("Failed to shutdown PC: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not implemented on this OS".into())
    }
}

#[tauri::command]
pub fn sleep_pc() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("rundll32.exe")
            .creation_flags(0x08000000)
            .args(["powrprof.dll,SetSuspendState", "0,1,0"])
            .spawn()
            .map_err(|e| format!("Failed to sleep PC: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not implemented on this OS".into())
    }
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct InstalledApp {
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn get_installed_apps() -> Vec<InstalledApp> {
    #[cfg(target_os = "windows")]
    {
        let mut apps = Vec::new();
        let mut dirs = Vec::new();

        if let Ok(progdata) = std::env::var("ProgramData") {
            dirs.push(std::path::PathBuf::from(progdata).join("Microsoft\\Windows\\Start Menu\\Programs"));
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            dirs.push(std::path::PathBuf::from(appdata).join("Microsoft\\Windows\\Start Menu\\Programs"));
        }

        for dir in dirs {
            if dir.exists() {
                scan_lnk_files(&dir, &mut apps);
            }
        }

        apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        apps.dedup_by(|a, b| a.name.to_lowercase() == b.name.to_lowercase());
        apps
    }
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

fn scan_lnk_files(dir: &std::path::Path, apps: &mut Vec<InstalledApp>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_lnk_files(&path, apps);
            } else if let Some(ext) = path.extension() {
                if ext.to_string_lossy().to_lowercase() == "lnk" {
                    if let Some(stem) = path.file_stem() {
                        let name = stem.to_string_lossy().to_string();
                        let lower = name.to_lowercase();
                        if !lower.contains("uninstall") && !lower.contains("help") && !lower.contains("readme") {
                            apps.push(InstalledApp {
                                name,
                                path: path.to_string_lossy().to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn set_volume(level: f32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
        use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
        use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
        
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                .map_err(|e| format!("COM error: {}", e))?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)
                .map_err(|e| format!("Failed to get device: {}", e))?;
            let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
                .map_err(|e| format!("Failed to get volume interface: {}", e))?;
            
            let bounded_level = level.clamp(0.0, 100.0) / 100.0;
            volume.SetMasterVolumeLevelScalar(bounded_level, std::ptr::null())
                .map_err(|e| format!("Failed to set volume: {}", e))?;
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not implemented on this OS".into())
    }
}

#[tauri::command]
pub fn mute_volume() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
        use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
        use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
        
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                .map_err(|e| format!("COM error: {}", e))?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)
                .map_err(|e| format!("Failed to get device: {}", e))?;
            let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
                .map_err(|e| format!("Failed to get volume interface: {}", e))?;
            
            volume.SetMute(true, std::ptr::null())
                .map_err(|e| format!("Failed to mute: {}", e))?;
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not implemented on this OS".into())
    }
}

#[tauri::command]
pub fn take_screenshot(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Graphics::Gdi::{
            BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, GetDC, SelectObject,
            SRCCOPY, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, GetDIBits
        };
        use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};
        use std::path::PathBuf;
        use chrono::Local;

        unsafe {
            let w = GetSystemMetrics(SM_CXSCREEN);
            let h = GetSystemMetrics(SM_CYSCREEN);
            
            let hdc_screen = GetDC(None);
            let hdc_mem = CreateCompatibleDC(hdc_screen);
            let hbm = CreateCompatibleBitmap(hdc_screen, w, h);
            
            SelectObject(hdc_mem, hbm);
            BitBlt(hdc_mem, 0, 0, w, h, hdc_screen, 0, 0, SRCCOPY)
                .map_err(|e| format!("BitBlt failed: {}", e))?;
                
            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w,
                    biHeight: -h,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            
            let mut pixels: Vec<u8> = vec![0; (w * h * 4) as usize];
            GetDIBits(hdc_screen, hbm, 0, h as u32, Some(pixels.as_mut_ptr() as *mut _), &mut bmi, DIB_RGB_COLORS);

            // Convert BGRA to RGBA
            for chunk in pixels.chunks_exact_mut(4) {
                chunk.swap(0, 2);
            }

            let img = image::RgbaImage::from_raw(w as u32, h as u32, pixels)
                .ok_or("Failed to create image buffer")?;
                
            let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
            let desktop_dir = app_handle.path().desktop_dir().unwrap_or_else(|_| PathBuf::from("."));
            let screenshots_dir = desktop_dir.join("Vertex Agent").join("Screenshots");
            std::fs::create_dir_all(&screenshots_dir).map_err(|e| e.to_string())?;
            
            let filepath = screenshots_dir.join(format!("Screenshot_{}.png", timestamp));
            img.save(&filepath).map_err(|e| format!("Failed to save: {}", e))?;
            
            Ok(filepath.to_string_lossy().into_owned())
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not implemented on this OS".into())
    }
}

use std::sync::Mutex;
use std::process::{Child, Command as ProcessCommand};

lazy_static::lazy_static! {
    static ref FF_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
}

#[tauri::command]
pub fn start_recording(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    use std::os::windows::process::CommandExt;
    let mut proc = FF_PROCESS.lock().unwrap();
    if proc.is_some() {
        return Err("Recording already in progress".into());
    }

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let desktop_dir = app_handle.path().desktop_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let recordings_dir = desktop_dir.join("Vertex Agent").join("Recordings");
    std::fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;
    
    let filepath = recordings_dir.join(format!("Record_{}.mp4", timestamp));
    
    // Attempt to spawn ffmpeg using gdigrab
    let child = ProcessCommand::new("ffmpeg")
        .creation_flags(0x08000000)
        .args(&[
            "-f", "gdigrab",
            "-framerate", "30",
            "-i", "desktop",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            filepath.to_str().unwrap()
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg (ensure it is in PATH): {}", e))?;
        
    *proc = Some(child);
    Ok(filepath.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn stop_recording() -> Result<(), String> {
    let mut proc = FF_PROCESS.lock().unwrap();
    if let Some(mut child) = proc.take() {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            // FFmpeg needs 'q' or graceful SIGINT to finish encoding headers.
            // A simple kill corrupts mp4. Using taskkill to send close signal to ffmpeg window/console.
            let _ = ProcessCommand::new("taskkill")
                .creation_flags(0x08000000)
                .args(&["/PID", &child.id().to_string()])
                .status();
        }
        let _ = child.wait();
        Ok(())
    } else {
        Err("No active recording".into())
    }
}
