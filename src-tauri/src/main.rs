// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows::Win32::System::Threading::{GetCurrentProcess, SetPriorityClass, ABOVE_NORMAL_PRIORITY_CLASS};
        let _ = SetPriorityClass(GetCurrentProcess(), ABOVE_NORMAL_PRIORITY_CLASS);
    }

    let args: Vec<String> = std::env::args().collect();
    let _ = std::fs::write(
        "C:\\Users\\ABHIRAM C S\\Desktop\\Tracker\\exported\\debug_main_args.txt",
        args.join("\n"),
    );

    app_lib::run()
}
