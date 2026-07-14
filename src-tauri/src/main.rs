// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let _ = std::fs::write(
        "C:\\Users\\ABHIRAM C S\\Desktop\\Tracker\\exported\\debug_main_args.txt",
        args.join("\n"),
    );

    app_lib::run()
}
