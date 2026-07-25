# 知境 KnowScape · 全面审查报告

**审查日期**: 2026-07-22
**审查人**: Inspector
**项目版本**: v0.1.0-dev

---

## 总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 代码质量 | ⭐⭐⭐☆☆ | Rust 和 TS 代码结构清晰，但有 unwrap 滥用、UTF-8 安全、事务缺失等问题 |
| 架构合理性 | ⭐⭐⭐⭐☆ | 前后端分层清晰，模块化良好，但前后端 API 契约脱节严重 |
| 安全性 | ⭐⭐☆☆☆ | CSP 禁用、无路径验证、API Key 可能泄露到日志 |
| 性能 | ⭐⭐⭐☆☆ | D3 重绘未优化、RAG 每章都调 embedding、Embedding 缓存无上限 |
| 文档完整性 | ⭐⭐☆☆☆ | 有 .env.example 和 config.toml.example，但缺少 README 和 API 文档 |

---

## Critical 问题（必须立即修复）

| # | 问题 | 位置 | 影响 | 建议修复 |
|---|------|------|------|----------|
| C-1 | CSP 安全策略被完全禁用 | `tauri.conf.json` | XSS 攻击无防护 | 设置合理 CSP 策略 |
| C-2 | 上传命令缺乏路径遍历防护 | `commands/mod.rs` upload_book | 可读取系统任意文件 | 添加路径白名单验证 |
| C-3 | delete_book_cascade 未使用事务 | `database/mod.rs` | 部分删除导致数据不一致 | 用 `conn.transaction()` 包裹 |
| C-4 | upsert_framework 非原子操作 | `database/mod.rs` | DELETE 成功但 INSERT 失败时数据丢失 | 改用 `INSERT OR REPLACE` |
| C-5 | API Key 在 Debug 输出中泄露 | `config.rs` LlmProvider | 日志中暴露密钥 | 手动实现 Debug 脱敏 |
| C-6 | strip_html_tags 中 script 检测逻辑错误 | `commands/mod.rs` | 脚本内容未被过滤 | 用状态机正确跟踪标签 |
| C-7 | truncate 按字节截断破坏 UTF-8 | `distill.rs` | 中文截断处乱码 | 用 char_indices 安全截断 |
| C-8 | GraphViz D3 内存泄漏 | `GraphViz.tsx` | 长时间使用后内存增长 | 清理 zoom/drag 事件监听器 |
| C-9 | Sidebar setTimeout 未清理 | `Sidebar.tsx` | 组件卸载后调 setState | 用 useRef + useEffect cleanup |
| C-10 | 缺少 .gitignore | 项目根目录 | .env/target 可能被提交 | 创建 .gitignore |

---

## High 问题（应优先修复）

| # | 问题 | 位置 | 影响 | 建议修复 |
|---|------|------|------|----------|
| H-1 | RAG 搜索每章都调 embedding（N 次 HTTP） | `rag.rs` L72-91 | 搜索极慢 | 预计算缓存或批量 embedding |
| H-2 | tokio::spawn 并发写进度可能倒退 | `distill.rs` L54-82 | 进度条跳动回退 | AtomicUsize 计数器 |
| H-3 | Embedding 缓存无上限 | `embedding.rs` | 长期运行内存泄漏 | 改用 LRU 缓存 |
| H-4 | chatStore isStreaming 永久卡死 | `chatStore.ts` L66-91 | 异常后 UI 冻结 | try/finally 重置状态 |
| H-5 | GraphWorkstation fetchData 闭包过期 | `GraphWorkstation.tsx` L43 | 重试用旧 bookId | 加入依赖数组 |
| H-6 | API 层硬编码 localhost | `api/index.ts` L49 | 生产环境不可用 | 读环境变量 |
| H-7 | 路由布局重复 4 次 | `App.tsx` L72-128 | 维护成本高 | 提取 WorkspaceSubLayout |
| H-8 | 配置文件从 CWD 加载无验证 | `config.rs` | 符号链接攻击风险 | 从固定路径加载 |
| H-9 | LLM Prompt 注入风险 | `distill.rs` | 恶意内容操控 LLM | 用 XML 标签隔离用户内容 |
| H-10 | GraphEdge 字段名不匹配 | `types.rs` vs `types/graph.ts` | 运行时数据丢失 | 统一字段命名 |

---

## Medium 问题（建议修复）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| M-1 | unwrap() 滥用 4 处 | `llm.rs`, `lib.rs` | panic 导致崩溃 |
| M-2 | list_books 静默吞 count_chapters 错误 | `commands/mod.rs` L194 | 错误不可见 |
| M-3 | parse_chapters 仅支持 # 标题 | `commands/mod.rs` | 大量 MD 文件无法分章 |
| M-4 | config 加载失败被静默忽略 | `config.rs` | 配置错误不可见 |
| M-5 | Mutex 在 async 中阻塞 tokio 线程 | `database/mod.rs` | 高并发下性能下降 |
| M-6 | LLM 错误响应截断过短 | `llm.rs` L139 | 调试困难 |
| M-7 | Embedding 模型名硬编码 | `embedding.rs` | 无法切换模型 |
| M-8 | Ollama 端口硬编码检测 | `llm.rs` L87 | 非标端口失效 |
| M-9 | as any 类型断言 3 处 | `DistillPanel.tsx` | 类型安全破坏 |
| M-10 | rehype-raw 允许原始 HTML | `package.json` | XSS 风险 |

---

## Low / 建议项

| # | 问题 | 位置 |
|---|------|------|
| L-1 | 不必要的 .clone() 调用多处 | `distill.rs`, `commands/mod.rs` |
| L-2 | BoxStream 类型仅用一次 | `llm.rs` |
| L-3 | _title 变量未使用 | `distill.rs` L171 |
| L-4 | Mock 数据打入生产 bundle | 多个组件 |
| L-5 | Date.now() 生成 ID 碰撞风险 | `bookStore.ts`, `chatStore.ts` |
| L-6 | GraphWorkstation 硬编码颜色 | `GraphWorkstation.tsx` |
| L-7 | ChatPanel width 三元运算冗余 | `ChatPanel.tsx` L109 |
| L-8 | tokio features = ["full"] 过大 | `Cargo.toml` |

---

## 安全审查总结

| 级别 | 数量 | 关键问题 |
|------|------|----------|
| Critical | 2 | CSP 禁用、路径遍历 |
| High | 3 | .gitignore 缺失、.env 泄露、Prompt 注入 |
| Medium | 2 | rehype-raw XSS、配置文件路径 |
| Low | 1 | strip_html_tags 实现简陋 |

**TLS 评估**: 使用 rustls（纯 Rust TLS），不依赖系统 OpenSSL，安全性良好。

---

## 数据一致性检查

| 检查项 | 结果 |
|--------|------|
| BookInfo 前后端对齐 | ✅ 一致（camelCase serde） |
| BookProgress 对齐 | ✅ 一致 |
| DistillPoint 对齐 | ✅ 一致 |
| FrameworkTree 对齐 | ✅ 一致 |
| GraphEdge 字段名 | ❌ `relationType` vs `type` 不匹配 |
| ChapterContent.annotations | ⚠️ 前端有，后端无 |
| 前端独有类型 | ⚠️ Annotation/Citation/Chat 等后端未实现 |

---

## 整体建议

1. **立即修复** C-1~C-10 和 H-1~H-10（本报告对应的 FIX_LOG.md 已记录修复方案）
2. **短期改进**: 对齐前后端 API 契约，添加 rehype-sanitize，完善 .gitignore
3. **中期目标**: 实现缺失的 12 个 IPC 命令，添加 Rust 单元测试，完善 CSP
4. **长期规划**: 实现 REST API 回退、添加 EmbeddingProvider 到 AppState、支持增量蒸馏
