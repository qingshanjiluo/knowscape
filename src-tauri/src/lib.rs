mod commands;
mod config;
mod database;
mod distill;
mod embedding;
mod error;
mod llm;
mod rag;
mod types;

pub struct AppState {
    pub db: database::Database,
    pub config: config::AppConfig,
    pub llm_pool: llm::LlmPool,
}

pub fn run() {
    let _ = dotenvy::dotenv();

    let config = config::load();
    let llm_pool = llm::LlmPool::new(&config.llm);

    let db_path = if config.database.path.contains('/') || config.database.path.contains('\\') {
        config.database.path.clone()
    } else {
        dirs::data_local_dir()
            .map(|d| d.join("knowscape").join(&config.database.path).to_string_lossy().to_string())
            .unwrap_or_else(|| config.database.path.clone())
    };

    if let Some(parent) = std::path::Path::new(&db_path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let db = database::Database::new(&db_path).expect("Failed to open database");
    db.initialize().expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { db, config: config.clone(), llm_pool })
        .invoke_handler(tauri::generate_handler![
            commands::upload_book,
            commands::list_books,
            commands::start_distillation,
            commands::get_distillation_status,
            commands::get_chapter,
            commands::get_framework,
            commands::get_graph_data,
            commands::delete_book,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
