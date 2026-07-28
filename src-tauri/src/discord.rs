use serde::{Deserialize, Serialize};
use std::io::Write;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_CLIENT_ID: &str = "1326109973325678714";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordTimestamps {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordAssets {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub large_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub large_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub small_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub small_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordButton {
    pub label: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordActivity {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamps: Option<DiscordTimestamps>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<DiscordAssets>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub buttons: Option<Vec<DiscordButton>>,
}

enum PipeStream {
    #[cfg(target_os = "windows")]
    Windows(std::fs::File),
    #[cfg(not(target_os = "windows"))]
    Unix(std::os::unix::net::UnixStream),
}

impl PipeStream {
    fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()> {
        match self {
            #[cfg(target_os = "windows")]
            PipeStream::Windows(f) => f.write_all(buf),
            #[cfg(not(target_os = "windows"))]
            PipeStream::Unix(s) => s.write_all(buf),
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        match self {
            #[cfg(target_os = "windows")]
            PipeStream::Windows(f) => f.flush(),
            #[cfg(not(target_os = "windows"))]
            PipeStream::Unix(s) => s.flush(),
        }
    }
}

pub struct DiscordIpcClient {
    stream: Option<PipeStream>,
    client_id: String,
    connected: bool,
}

impl DiscordIpcClient {
    pub fn new() -> Self {
        Self {
            stream: None,
            client_id: DEFAULT_CLIENT_ID.to_string(),
            connected: false,
        }
    }

    fn connect_pipe() -> Option<PipeStream> {
        #[cfg(target_os = "windows")]
        {
            for i in 0..10 {
                let path = format!(r"\\.\pipe\discord-ipc-{}", i);
                if let Ok(file) = std::fs::OpenOptions::new()
                    .read(true)
                    .write(true)
                    .open(&path)
                {
                    return Some(PipeStream::Windows(file));
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let env_vars = ["XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"];
            let mut search_paths: Vec<String> = env_vars
                .iter()
                .filter_map(|v| std::env::var(v).ok())
                .collect();
            search_paths.push("/tmp".to_string());

            for base in search_paths {
                for i in 0..10 {
                    let path = format!("{}/discord-ipc-{}", base, i);
                    if let Ok(stream) = std::os::unix::net::UnixStream::connect(&path) {
                        return Some(PipeStream::Unix(stream));
                    }
                    let flatpak_path = format!("{}/app/com.discordapp.Discord/discord-ipc-{}", base, i);
                    if let Ok(stream) = std::os::unix::net::UnixStream::connect(&flatpak_path) {
                        return Some(PipeStream::Unix(stream));
                    }
                }
            }
        }

        None
    }

    fn send_frame(&mut self, opcode: u32, payload: &str) -> std::io::Result<()> {
        let stream = match self.stream.as_mut() {
            Some(s) => s,
            None => return Err(std::io::Error::new(std::io::ErrorKind::NotConnected, "Not connected")),
        };

        let len = payload.len() as u32;
        let mut header = Vec::with_capacity(8);
        header.extend_from_slice(&opcode.to_le_bytes());
        header.extend_from_slice(&len.to_le_bytes());

        stream.write_all(&header)?;
        stream.write_all(payload.as_bytes())?;
        stream.flush()?;

        Ok(())
    }

    pub fn ensure_connected(&mut self) -> bool {
        if self.connected && self.stream.is_some() {
            return true;
        }

        let was_connected = self.connected;
        self.disconnect();

        #[cfg(debug_assertions)]
        {
            if was_connected {
                println!("[Discord] Reconnecting...");
            } else {
                println!("[Discord] Initializing...");
            }
        }

        if let Some(stream) = Self::connect_pipe() {
            self.stream = Some(stream);
            let handshake_json = serde_json::json!({
                "v": 1,
                "client_id": self.client_id
            })
            .to_string();

            if self.send_frame(0, &handshake_json).is_ok() {
                self.connected = true;
                #[cfg(debug_assertions)]
                println!("[Discord] Connected");
                return true;
            }
        }

        #[cfg(debug_assertions)]
        println!("[Discord] Connection failed: Discord not running");
        self.disconnect();
        false
    }

    pub fn set_activity(&mut self, activity: Option<DiscordActivity>) -> Result<(), String> {
        #[cfg(debug_assertions)]
        println!("[Discord] Updating Rich Presence...");

        if !self.ensure_connected() {
            #[cfg(debug_assertions)]
            println!("[Discord] Discord not running");
            return Err("Discord IPC pipe not available".to_string());
        }

        let pid = std::process::id();
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
            .to_string();

        let payload = serde_json::json!({
            "cmd": "SET_ACTIVITY",
            "args": {
                "pid": pid,
                "activity": activity
            },
            "nonce": nonce
        })
        .to_string();

        if let Err(e) = self.send_frame(1, &payload) {
            #[cfg(debug_assertions)]
            println!("[Discord] Connection failed: {}", e);
            self.disconnect();
            Err(format!("Failed to send activity to Discord: {}", e))
        } else {
            #[cfg(debug_assertions)]
            println!("[Discord] Activity updated successfully");
            Ok(())
        }
    }

    pub fn disconnect(&mut self) {
        if self.connected {
            #[cfg(debug_assertions)]
            println!("[Discord] Disconnected");
        }
        self.stream = None;
        self.connected = false;
    }
}

pub struct DiscordState(pub Mutex<DiscordIpcClient>);
