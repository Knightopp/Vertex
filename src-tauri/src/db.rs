use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

pub struct Database {
    pub conn: Connection,
}

impl Database {
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));

        if !app_dir.exists() {
            fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
        }

        let db_path = app_dir.join("vazorism.db");
        let conn = Connection::open(db_path)?;

        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS hash_cache (
                hash TEXT PRIMARY KEY,
                path TEXT,
                size INTEGER,
                modified_at INTEGER
            );
            
            CREATE TABLE IF NOT EXISTS applications (
                id TEXT PRIMARY KEY,
                hash TEXT,
                title TEXT,
                type TEXT
            );
            
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                app_id TEXT,
                official_name TEXT,
                developer TEXT,
                publisher TEXT
            );
            
            CREATE TABLE IF NOT EXISTS cover_art (
                app_id TEXT PRIMARY KEY,
                local_path TEXT,
                url TEXT
            );
            
            CREATE TABLE IF NOT EXISTS icons (
                hash TEXT PRIMARY KEY,
                local_path TEXT
            );
            
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                app_id TEXT,
                started_at INTEGER,
                ended_at INTEGER,
                state TEXT
            );
            
            CREATE TABLE IF NOT EXISTS playtime (
                app_id TEXT PRIMARY KEY,
                total_seconds INTEGER DEFAULT 0,
                last_played INTEGER,
                launch_count INTEGER DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS manual_overrides (
                app_id TEXT PRIMARY KEY,
                forced_type TEXT
            );
            
            CREATE TABLE IF NOT EXISTS metadata_cache (
                hash TEXT PRIMARY KEY,
                source TEXT,
                raw_json TEXT,
                last_search INTEGER
            );
            ",
        )?;
        Ok(())
    }
}
