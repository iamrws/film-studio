use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Project metadata returned to the frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub title: String,
    pub file_path: String,
    pub modified: String,
    pub size_bytes: u64,
}

/// List all .filmstudio project files in a directory
#[tauri::command]
fn list_projects(directory: String) -> Result<Vec<ProjectInfo>, String> {
    let dir = PathBuf::from(&directory);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("filmstudio") {
            if let Ok(metadata) = fs::metadata(&path) {
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs().to_string())
                    .unwrap_or_default();

                // Try to read the title from the JSON
                let title = fs::read_to_string(&path)
                    .ok()
                    .and_then(|content| {
                        serde_json::from_str::<serde_json::Value>(&content).ok()
                    })
                    .and_then(|v| {
                        v.get("metadata")
                            .and_then(|m| m.get("title"))
                            .and_then(|t| t.as_str().map(String::from))
                    })
                    .unwrap_or_else(|| {
                        path.file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("Untitled")
                            .to_string()
                    });

                projects.push(ProjectInfo {
                    title,
                    file_path: path.to_string_lossy().to_string(),
                    modified,
                    size_bytes: metadata.len(),
                });
            }
        }
    }

    // Sort by modified time descending
    projects.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(projects)
}

/// Get the default projects directory (Documents/Film Studio)
#[tauri::command]
fn get_projects_dir() -> Result<String, String> {
    let home = dirs_next::document_dir()
        .or_else(dirs_next::home_dir)
        .ok_or("Could not determine home directory")?;

    let projects_dir = home.join("Film Studio");
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir).map_err(|e| e.to_string())?;
    }

    Ok(projects_dir.to_string_lossy().to_string())
}

/// Ensure a directory exists, creating it recursively if needed
#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// Get app data directory for storing config
#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }

    Ok(path.to_string_lossy().to_string())
}

/// Download a file from a URL to a local path
#[tauri::command]
async fn download_file(url: String, output_path: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    // Ensure parent directory exists
    if let Some(parent) = PathBuf::from(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(&output_path, &bytes).map_err(|e| e.to_string())?;
    Ok(output_path)
}

/// Open a file or folder in the system's default application
#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        opener::open(&path).map_err(|e| e.to_string())
    } else if let Some(parent) = p.parent() {
        opener::open(parent.to_string_lossy().as_ref()).map_err(|e| e.to_string())
    } else {
        Err("Invalid path".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            get_projects_dir,
            ensure_dir,
            get_app_data_dir,
            download_file,
            reveal_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
