use rusqlite::Connection;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct OldAppRecord {
    pub id: String,
    pub exe_path: String,
    pub display_name: String,
    pub category: String,
    pub total_seconds: i64,
    pub last_played_at: Option<i64>,
    pub status: String,
    pub genre: String,
    pub cover_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MigrationData {
    pub apps: Vec<OldAppRecord>,
}

#[tauri::command]
pub fn migrate_old_data() -> Result<MigrationData, String> {
    // Determine the path to the old database
    // Usually %LOCALAPPDATA%\com.arctrack.app\arctrack.db
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Could not find LOCALAPPDATA environment variable".to_string())?;

    let db_path = PathBuf::from(local_app_data)
        .join("com.arctrack.app")
        .join("arctrack.db");

    if !db_path.exists() {
        return Err("No old ArcTrack database found.".to_string());
    }

    let conn =
        Connection::open(db_path).map_err(|e| format!("Failed to open old database: {}", e))?;

    // ArcTrack schema sometimes doesn't have status, genre, cover_path if it wasn't fully migrated.
    // We will select them, and if it fails, we fall back to the basic query.
    let query_full = "SELECT id, exe_path, display_name, category, total_seconds, last_played_at, status, genre, cover_path FROM apps";
    let query_basic =
        "SELECT id, exe_path, display_name, category, total_seconds, last_played_at FROM apps";

    let mut records = Vec::new();

    if let Ok(mut stmt) = conn.prepare(query_full) {
        let apps = stmt.query_map([], |row| {
            Ok(OldAppRecord {
                id: row.get(0)?,
                exe_path: row.get(1)?,
                display_name: row.get(2)?,
                category: row.get(3)?,
                total_seconds: row.get(4)?,
                last_played_at: row.get(5)?,
                status: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                genre: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                cover_path: row.get(8)?,
            })
        });

        if let Ok(mapped_apps) = apps {
            for app in mapped_apps {
                if let Ok(app_record) = app {
                    records.push(app_record);
                }
            }
        }
    } else if let Ok(mut stmt) = conn.prepare(query_basic) {
        let apps = stmt.query_map([], |row| {
            Ok(OldAppRecord {
                id: row.get(0)?,
                exe_path: row.get(1)?,
                display_name: row.get(2)?,
                category: row.get(3)?,
                total_seconds: row.get(4)?,
                last_played_at: row.get(5)?,
                status: String::new(),
                genre: String::new(),
                cover_path: None,
            })
        });

        if let Ok(mapped_apps) = apps {
            for app in mapped_apps {
                if let Ok(app_record) = app {
                    records.push(app_record);
                }
            }
        }
    } else {
        return Err("Failed to query apps table.".to_string());
    }

    Ok(MigrationData { apps: records })
}
