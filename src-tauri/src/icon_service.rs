use std::path::{Path, PathBuf};
use std::process::Command;

pub fn get_or_extract_icon(exe_path: &str, hash: &str, app_data_dir: &Path) -> Option<PathBuf> {
    let icons_dir = app_data_dir.join("icons");
    if !icons_dir.exists() {
        std::fs::create_dir_all(&icons_dir).ok()?;
    }

    let icon_path = icons_dir.join(format!("{}.png", hash));

    // If it's already cached, just return it
    if icon_path.exists() {
        return Some(icon_path);
    }

    // Extract using PowerShell to avoid massive unsafe GDI/Win32 boilerplate in Rust
    let ps_script = format!(
        "Add-Type -AssemblyName System.Drawing; \
         $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('{}'); \
         if ($icon) {{ \
             $bmp = $icon.ToBitmap(); \
             $bmp.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png); \
         }}",
        exe_path.replace("'", "''"),
        icon_path.to_string_lossy().replace("'", "''")
    );

    let output = Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-Command", &ps_script])
        .output();

    if let Ok(out) = output {
        if out.status.success() && icon_path.exists() {
            return Some(icon_path);
        }
    }

    None
}
