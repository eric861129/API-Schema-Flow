# Roadmap

> 狀態：規劃基準  
> 最後更新：2026-09-01  
> Roadmap 採成果導向，不承諾日期。

## 原則

每個 Milestone 都必須產生可操作、可測試的成果。不得先建立大量框架，再把整合與驗證無限延後。Milestone Preview 可以只完成完整 MVP 路徑的一部分，但必須有明確入口、輸出與 Exit Criteria。

## M0 — Foundation and Governance

**目標：** 建立可安全開始實作的專案與架構邊界。

交付內容：

- 文件包與 ADR 通過負責人審閱；
- 名稱、License、支援版本與安全回報方式完成決策；
- Monorepo、TypeScript、pnpm、Turborepo、Lint、Typecheck、Unit Test 與 Changesets 完成初始化；
- 建立 Domain、Diagnostics、Redaction 與 Config Skeleton；
- 建立最小 Reservation Fixture；
- CI 可在主要作業系統執行 Build、Test、Markdown Link 與 Package Boundary Checks；
- 完成 Parser 與 Runtime Validator 的短期選型 Spike。

離開條件：

- Root Quality Commands 全部通過；
- 核心 Package 不依賴 React、Fastify、MSW 或 Parser-specific Type；
- ADR-0001–0005 已接受或有明確修訂；
- GitHub Issue、PR、Security 與 Contribution 流程可用；
- 沒有未決定的 License、Package Name 或核心標準版本。

## M1 — OpenAPI Ingestion and Normalized Core

**目標：** 將真實 OpenAPI 安全、穩定地轉成版本無關模型。

交付內容：

- 本機 YAML/JSON 與受政策控制的 URL 匯入；
- OpenAPI 3.0.x、3.1.x 解析與 `$ref` Resolution；
- 3.2.x Compatibility Diagnostics；
- Normalized Operation、Schema、Security、Example、Server 與 Link Model；
- Stable IDs、Source Pointer 與 Structured Diagnostics；
- CLI `validate` 與機器可讀輸出；
- Reservation、Petstore、Multi-file、Invalid、Malicious Fixtures；
- Parser/Normalizer Determinism 與效能基準。

離開條件：

- Canonical Fixtures 可離線、可重現地匯入；
- 同一輸入產生相同 Stable IDs 與 Diagnostics；
- Remote Loader 通過 SSRF、Size、Depth、Redirect 與 Timeout 測試；
- UI/CLI 尚未完成也能透過 CLI/Fixture 看見完整 Normalized 結果；
- Parser 原生 Type 不洩漏到 Domain Public API。

## M2 — Arazzo and Evidence-based Inference

> 狀態：**已完成（M2-A～M2-D）**。Headless Core 已涵蓋 Arazzo、Declared Graph、Inference Candidate、Review Decision、Accepted Graph 與 Canonical Arazzo Export。

**目標：** 將端點資料提升為標準化、可解釋的 Workflow 候選。

交付內容：

- Arazzo 1.1.x Parse、Validate、Preserve 與 Support Analysis；
- OpenAPI Link 轉換為 Declared Edge；
- Runtime Expression AST；
- Evidence-based Inference Pipeline；
- Confidence、Score Breakdown、Ambiguity 與 Stable Candidate ID；
- Accept/Reject/Edit Decision Model；
- Arazzo Canonical Export 的核心轉換；
- Inference Benchmark Dataset 與 Report。

離開條件：

- Inferred Edge 永不自動成為 Accepted；
- High-confidence Benchmark Precision 達 PRD 門檻；
- Generic `id` Ambiguous/Negative Fixtures 通過；
- Arazzo Import→Domain→Export 語意可 Round-trip；
- 官方 Schema 與規格文字的已知差異由 Compatibility Exception Registry 管理；
- CLI/測試可輸出 Candidate、Evidence 與 Support Diagnostics。

## M3 — Interactive Workflow Workspace

**目標：** 讓使用者能在視覺工作台理解、審核並編輯 Workflow。

交付內容：

- React + Vite Workspace；
- React Flow Endpoint/Workflow Nodes；
- ELK Layered Layout 與大型圖降級模式；
- Search、Filter、Group、Outline View；
- Schema/Operation/Edge Inspector；
- Declared、Manual、Inferred 的非顏色唯一編碼；
- Candidate Accept/Reject/Edit；
- Project Save/Load、Layout 與 Decision Persistence；
- Keyboard-only Review Journey；
- Arazzo Preview 與 Mermaid Preview。

離開條件：

- Reservation Flow 可由使用者完整審核並形成 Accepted Graph；
- 500 Operations 的解析、Layout、搜尋達 NFR；
- Canvas 與 Outline View 語意一致；
- Project Reload 後 Decision/Layout 穩定；
- UI 不直接使用 Parser/ELK 原生物件作為持久化模型；
- Candidate、Accepted、Rejected 不會在 UI 或 Export 混淆。

## M4 — Stateful Mock, Execution, and Live Trace

**目標：** 讓使用者在後端未完成前執行並觀察完整 API Workflow。

交付內容：

- Shared Mock Runtime 與 Fastify Adapter；
- Session Isolation、Seed、Reset、Snapshot、Restore；
- Generated CRUD Resource Lifecycle；
- Delay、Jitter、Forced Status、Failure Rate、Timeout；
- Arazzo 同步 OpenAPI Execution Profile；
- Input/Parameter/Request Body Mapping；
- Output Extraction、Criteria、Bounded Retry、Cancellation；
- Direct Mock/HTTP Transport；
- Live Trace、Attempt、State Mutation Timeline；
- JSON Run Report 與 Redaction；
- Optional Live Transport 只有在安全 Gate 通過時加入。

離開條件：

- Reservation Workflow 可 POST 建立後以回傳 ID GET 同一 Entity；
- 第一次 429、第二次成功只造成一次 State Mutation；
- 不同 Session 不得互相看到資料、Fault Counter 或 ID Sequence；
- 相同 Seed、Inputs、Version 產生可重現結果；
- Unsupported Arazzo Feature 在發送 Request 前阻擋；
- Authorization、Cookie、Token 不進入任何 Trace/Export；
- Mock Runtime 與 Fastify Adapter Contract Tests 通過。

## M5 — CLI, Export, Playground, and Release Hardening

**目標：** 形成外部開發者能安裝、理解、驗證與貢獻的 MVP。

交付內容：

- `open`、`validate`、`infer`、`mock`、`run`、`export`；
- 穩定 Exit Code、JSON Output 與 Shell Behavior；
- Arazzo、Mermaid、Project JSON、Run Report Export；
- MSW Adapter 與 Static Playground；若品質未達標可列為 Should，不阻擋核心 MVP；
- 三組公開 Synthetic Examples；
- README Hero Demo、文件站與支援矩陣；
- Accessibility、Security、Cross-platform E2E、Performance 與 Package Inspection；
- npm Pre-release、Provenance 與 GitHub Release；
- Known Limitations、Migration 與 Changelog。

離開條件：

- 全新環境可在五分鐘內完成 Import→Review→Mock→Run→Export；
- CLI 在支援平台上有一致 Exit Codes；
- Playground 不上傳或保存使用者規格；
- Hero Demo 每一步皆由 Release Build 真實重現；
- Requirements Traceability、Security Gate 與 Release Checklist 全部通過；
- npm 套件內容、License、Attestation 與 Quickstart 經驗證；
- README 沒有把未實作或 Post-MVP 功能寫成已提供。

## v1.0 — Stable Workflow Workbench

v1.0 前至少具備：

- 穩定 Project/Config/Run Schema 與 Migration Policy；
- OpenAPI 3.0/3.1 正式支援與清楚的 3.2 相容層級；
- Arazzo Execution Profile 行為固定；
- 可公開承諾的 Security、Deprecation 與 Compatibility Policy；
- Inference Benchmark 經多種真實但可公開/匿名化案例驗證；
- 至少一個版本週期的外部使用與 Migration 經驗；
- 可重現的 Issue、Release 與安全修補流程。

## Post-MVP

依使用者證據排序，而非預先全部開發：

1. Flow-aware OpenAPI Diff 與 GitHub Action；
2. Observed Edge：HAR、OpenTelemetry 或 Proxy Trace；
3. 可插拔 Persistence Adapter；
4. AsyncAPI 與 Arazzo 非同步步驟執行；
5. 受限且可沙箱化的 Custom Resolver；
6. 團隊協作、Cloud Sync 與權限；
7. AI-assisted Flow Suggestion，必須保留 Evidence 與人工審核；
8. PDF/Postman/其他生態 Exporter，依實際需求決定。
