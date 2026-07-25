# 知境 KnowScape · 修复日志

**修复日期**: 2026-07-22
**修复人**: Inspector

---

## 已修复的 Critical 问题

| # | 问题 | 修复方案 | 修改文件 | 验证状态 |
|---|------|----------|----------|----------|
| C-1 | CSP 安全策略被完全禁用 | 设置合理 CSP 策略（允许 self + inline style + 数据 URI） | `tauri.conf.json` | ⏳ 待验证 |
| C-3 | delete_book_cascade 未使用事务 | 用 `conn.transaction()` 包裹所有 DELETE 语句 | `database/mod.rs` | ✅ cargo check 通过 |
| C-4 | upsert_framework 非原子操作 | 改用 `INSERT OR REPLACE` 单条语句 | `database/mod.rs` | ✅ cargo check 通过 |
| C-5 | API Key 在 Debug 输出中泄露 | 手动实现 Debug trait，api_key 替换为 "[REDACTED]" | `config.rs` | ✅ cargo check 通过 |
| C-7 | truncate 按字节截断破坏 UTF-8 | 改用 char_indices() 安全截断 | `distill.rs` | ✅ cargo check 通过 |
| C-9 | Sidebar setTimeout 未清理 | 用 useRef + useEffect cleanup 模式 | `Sidebar.tsx` | ✅ tsc 通过 |
| C-10 | 缺少 .gitignore | 创建根目录 .gitignore，覆盖 .env/target/node_modules 等 | `.gitignore` | ✅ 已创建 |

---

## 已修复的 High 问题

| # | 问题 | 修复方案 | 修改文件 | 验证状态 |
|---|------|----------|----------|----------|
| H-4 | chatStore isStreaming 永久卡死 | 用 try/finally 确保 isStreaming 总是重置 | `chatStore.ts` | ✅ tsc 通过 |
| H-7 | 路由布局重复 4 次 | 提取 WorkspaceSubLayout 组件，5 条路由共用 | `App.tsx` | ✅ tsc 通过 |

---

## 已修复的前置问题（上传功能）

| # | 问题 | 修复方案 | 修改文件 | 验证状态 |
|---|------|----------|----------|----------|
| 前置-1 | 后端 read_to_string 无法读 EPUB/PDF | 添加 epub crate 解析 EPUB 二进制 | `commands/mod.rs`, `Cargo.toml` | ✅ cargo check 通过 |
| 前置-2 | File input 只传文件名不传内容 | 前端用 FileReader 读内容，EPUB 转 base64 | `bookStore.ts`, `api/index.ts` | ✅ tsc 通过 |
| 前置-3 | 后端无 EPUB 解析器 | 新增 parse_epub_from_bytes + strip_html_tags | `commands/mod.rs` | ✅ cargo check 通过 |
| 前置-4 | 滚动问题（所有页面不可滚动） | 内容区改为 flex 容器，子路由改用 flex-1 min-h-0 | `App.tsx`, `AppLayout.tsx` | ✅ 已修复 |

---

## 待修复问题

| # | 问题 | 优先级 | 计划版本 | 原因 |
|---|------|--------|----------|------|
| C-2 | 上传命令缺乏路径遍历防护 | Critical | v0.2 | 需设计白名单机制 |
| C-6 | strip_html_tags script 检测逻辑错误 | Critical | v0.2 | 需重写为状态机 |
| C-8 | GraphViz D3 内存泄漏 | Critical | v0.2 | 需重构 zoom/drag 生命周期 |
| H-1 | RAG 搜索每章调 embedding | High | v0.3 | 需预计算缓存架构 |
| H-2 | tokio::spawn 进度倒退 | High | v0.2 | 需 AtomicUsize 计数器 |
| H-3 | Embedding 缓存无上限 | High | v0.2 | 需引入 lru crate |
| H-5 | GraphWorkstation 闭包过期 | High | v0.2 | 需加入依赖数组 |
| H-6 | API 层硬编码 localhost | High | v0.2 | 需读环境变量 |
| H-8 | 配置文件从 CWD 加载 | High | v0.3 | 需改为固定路径 |
| H-9 | LLM Prompt 注入风险 | High | v0.3 | 需 XML 标签隔离 |
| H-10 | GraphEdge 字段名不匹配 | High | v0.2 | 需统一 types.ts 字段 |

---

## 修复统计

| 指标 | 数量 |
|------|------|
| 本次修复 Critical | 7 |
| 本次修复 High | 2 |
| 本次修复前置问题 | 4 |
| 待修复 Critical | 3 |
| 待修复 High | 8 |
| 修改文件总数 | 12 |
| 编译验证通过 | ✅ Rust + TypeScript |
