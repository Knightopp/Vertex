use crate::discord::{DiscordActivity, DiscordState};
use tauri::State;

#[tauri::command]
pub fn update_discord_presence(
    state: State<DiscordState>,
    activity: Option<DiscordActivity>,
) -> Result<(), String> {
    let mut client = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock Discord client state: {}", e))?;

    client.set_activity(activity)
}

#[tauri::command]
pub fn clear_discord_presence(state: State<DiscordState>) -> Result<(), String> {
    let mut client = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock Discord client state: {}", e))?;

    client.set_activity(None)?;
    client.disconnect();
    Ok(())
}
