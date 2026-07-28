use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

const DEFAULT_CLIENT_ID: &str = "1526109973325676714";

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

pub struct DiscordIpcClientWrapper {
    client: Option<DiscordIpcClient>,
    client_id: String,
    connected: bool,
}

impl DiscordIpcClientWrapper {
    pub fn new() -> Self {
        Self {
            client: None,
            client_id: DEFAULT_CLIENT_ID.to_string(),
            connected: false,
        }
    }

    pub fn ensure_connected(&mut self) -> bool {
        if self.connected && self.client.is_some() {
            return true;
        }

        #[cfg(debug_assertions)]
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

        match DiscordIpcClient::new(&self.client_id) {
            Ok(mut client) => {
                if client.connect().is_ok() {
                    self.client = Some(client);
                    self.connected = true;
                    #[cfg(debug_assertions)]
                    println!("[Discord] Connected");
                    return true;
                }
            }
            Err(_) => {}
        }

        #[cfg(debug_assertions)]
        println!("[Discord] Connection failed: Discord not running");
        self.disconnect();
        false
    }

    pub fn set_activity(&mut self, activity: Option<DiscordActivity>) -> Result<(), String> {
        #[cfg(debug_assertions)]
        println!("[Discord] Updating Rich Presence...");

        if activity.is_none() {
            #[cfg(debug_assertions)]
            println!("[Discord] Activity payload: null");
            if let Some(ref mut client) = self.client {
                let _ = client.clear_activity();
            }
            return Ok(());
        }

        // Print complete activity payload in JSON format before sending
        let activity_payload = activity.clone().unwrap();
        #[cfg(debug_assertions)]
        {
            if let Ok(payload_json) = serde_json::to_string(&activity_payload) {
                println!("[Discord] Activity payload: {}", payload_json);
            }
        }

        if !self.ensure_connected() {
            #[cfg(debug_assertions)]
            println!("[Discord] Discord not running");
            return Err("Discord IPC pipe not available".to_string());
        }

        let client = match self.client.as_mut() {
            Some(c) => c,
            None => return Err("Discord IPC client not connected".to_string()),
        };

        // Map DiscordActivity into discord_rich_presence::activity::Activity
        let mut discord_activity = activity::Activity::new();

        if let Some(details) = &activity_payload.details {
            discord_activity = discord_activity.details(details);
        }

        if let Some(state) = &activity_payload.state {
            discord_activity = discord_activity.state(state);
        }

        if let Some(ts) = &activity_payload.timestamps {
            let mut timestamps = activity::Timestamps::new();
            if let Some(start) = ts.start {
                timestamps = timestamps.start(start as i64);
            }
            if let Some(end) = ts.end {
                timestamps = timestamps.end(end as i64);
            }
            discord_activity = discord_activity.timestamps(timestamps);
        }

        if let Some(ast) = &activity_payload.assets {
            let mut assets = activity::Assets::new();
            if let Some(large_image) = &ast.large_image {
                assets = assets.large_image(large_image);
            }
            if let Some(large_text) = &ast.large_text {
                assets = assets.large_text(large_text);
            }
            if let Some(small_image) = &ast.small_image {
                assets = assets.small_image(small_image);
            }
            if let Some(small_text) = &ast.small_text {
                assets = assets.small_text(small_text);
            }
            discord_activity = discord_activity.assets(assets);
        }

        if let Some(btns) = &activity_payload.buttons {
            let buttons = btns
                .iter()
                .map(|b| activity::Button::new(&b.label, &b.url))
                .collect();
            discord_activity = discord_activity.buttons(buttons);
        }

        if let Err(e) = client.set_activity(discord_activity) {
            #[cfg(debug_assertions)]
            println!("[Discord] Connection failed: {}", e);
            self.disconnect();
            Err(format!("Failed to set activity: {}", e))
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
            if let Some(mut client) = self.client.take() {
                let _ = client.close();
            }
        }
        self.client = None;
        self.connected = false;
    }
}

pub struct DiscordState(pub Mutex<DiscordIpcClientWrapper>);
