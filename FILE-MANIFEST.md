# 文件包清單

> 文件包版本：0.1.0  
> 建立日期：2026-09-01  
> 狀態：Owner Review Draft

## 1. 摘要

這個文件包用於 API Schema Flow 正式開工前的產品、技術、安全、品質與開源治理審查。除本清單外，共包含 **47 份 Markdown 文件**。

建議先閱讀：

1. `docs/00-DOCUMENT-INDEX.md`
2. `docs/01-PRODUCT-VISION.md`
3. `docs/02-PRD.md`
4. `docs/03-MVP-SCOPE-AND-ACCEPTANCE.md`
5. `docs/25-OPEN-DECISIONS.md`
6. `docs/30-IMPLEMENTATION-READINESS-CHECKLIST.md`

## 2. 檔案

| 路徑 | 用途 | 行數 | SHA-256 前 12 碼 |
|---|---|---:|---|
| `.github/ISSUE_TEMPLATE/bug_report.md` | 安全的可重現 Bug 回報模板。 | 84 | `6b52bff39b38` |
| `.github/ISSUE_TEMPLATE/feature_request.md` | 以使用者成果與 Scope Guard 為核心的提案模板。 | 76 | `36cfba9189d2` |
| `.github/ISSUE_TEMPLATE/inference_quality_report.md` | False positive/negative 與 Evidence 品質回報模板。 | 85 | `97970b1261c2` |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 的需求、測試、安全、相容與文件檢查。 | 96 | `2aeae490666f` |
| `CHANGELOG.md` | 版本變更、Breaking Change 與 Known Limitations 格式。 | 33 | `6f5e58d1807f` |
| `CODE_OF_CONDUCT.md` | 開源社群行為規範。 | 27 | `400bdf8114aa` |
| `CONTRIBUTING.md` | 貢獻流程、開發規範、DCO 與 Package Boundary。 | 134 | `bbd993583a9e` |
| `README.md` | English public project entry, honest pre-alpha positioning and quickstart target. | 154 | `5a52ac00942d` |
| `README.zh-TW.md` | 繁體中文公開入口與 MVP 能力摘要。 | 115 | `499c83957838` |
| `ROADMAP.md` | 成果導向 Milestone、依賴順序與退出條件。 | 183 | `beed4aec247c` |
| `SECURITY.md` | 漏洞回報、安全支援範圍與敏感資料處理。 | 65 | `d2abe2bac2ba` |
| `docs/00-DOCUMENT-INDEX.md` | 文件閱讀順序、狀態與 ADR 索引。 | 107 | `b2956b486f24` |
| `docs/01-PRODUCT-VISION.md` | 產品定位、核心價值、原則與長期方向。 | 125 | `a61d7ed199f3` |
| `docs/02-PRD.md` | 完整產品需求、功能需求、非目標、風險與 Release Gate。 | 220 | `943a247faa83` |
| `docs/03-MVP-SCOPE-AND-ACCEPTANCE.md` | MVP 邊界、垂直切片與 Given/When/Then 驗收。 | 205 | `1a2fb4cac809` |
| `docs/04-PERSONAS-AND-USE-CASES.md` | 前端、QA、後端、Tech Lead 等 Persona 與情境。 | 157 | `66b3aa8f67b4` |
| `docs/05-SUCCESS-METRICS.md` | 價值、品質、可信度與開源健康指標。 | 131 | `655a9e57cc4a` |
| `docs/06-SYSTEM-ARCHITECTURE.md` | Container、Package、Data Flow、錯誤與部署架構。 | 471 | `c302e010e7b2` |
| `docs/07-DOMAIN-MODEL.md` | Normalized Domain Model、ID、Graph、Mock、Trace 與 Invariants。 | 424 | `9f2bc99114b9` |
| `docs/08-OPENAPI-INGESTION-SPEC.md` | OpenAPI 來源、解析、$ref、安全與正規化規格。 | 254 | `0b30664209cb` |
| `docs/09-ARAZZO-WORKFLOW-SPEC.md` | Arazzo-first、支援矩陣、Runtime Expression 與 Round-trip。 | 322 | `d11628b61581` |
| `docs/10-FLOW-INFERENCE-SPEC.md` | Evidence、Confidence、Rules、Decision 與 Benchmark。 | 318 | `7eb387f83518` |
| `docs/11-STATEFUL-MOCK-RUNTIME-SPEC.md` | CRUD 狀態機、Session、Seed、Fault、Snapshot 與 Adapter。 | 395 | `7b374f9b432a` |
| `docs/12-EXECUTION-AND-LIVE-TRACE-SPEC.md` | Workflow Executor、Retry、Timeout、Transport 與 Trace。 | 348 | `83fd7ebb11bd` |
| `docs/13-WEB-APP-UX-SPEC.md` | Workspace 資訊架構、Canvas、Inspector、Review 與可及性。 | 446 | `08fd0f3591a4` |
| `docs/14-CLI-SPEC.md` | CLI Commands、Flags、輸出、Exit Code 與安全行為。 | 339 | `1528ccde6eea` |
| `docs/15-PROJECT-CONFIG-SPEC.md` | Config、Project 格式、Schema Version、Migration 與例子。 | 355 | `bad3b35967f9` |
| `docs/16-EXPORT-SPEC.md` | Arazzo、Mermaid、Project、Run Report 的輸出契約。 | 258 | `af7919a07c0f` |
| `docs/17-FLOW-AWARE-DIFF-SPEC.md` | Post-MVP Schema Diff 至 Workflow Impact 規格。 | 223 | `3410d5bdc6f6` |
| `docs/18-NON-FUNCTIONAL-REQUIREMENTS.md` | 效能、可靠性、安全、可及性、相容與維護門檻。 | 167 | `63b01bcb691a` |
| `docs/19-SECURITY-THREAT-MODEL.md` | 資產、邊界、SSRF、XSS、Secret、Session 與供應鏈威脅。 | 257 | `84a5b06690dd` |
| `docs/20-TEST-STRATEGY.md` | Unit、Property、Fixture、Conformance、E2E、安全與效能測試。 | 348 | `1656d24ea567` |
| `docs/21-RELEASE-AND-VERSIONING.md` | SemVer、Pre-release、Schema Migration 與 Release Checklist。 | 204 | `6d6a7c7d7088` |
| `docs/22-REPOSITORY-STRUCTURE.md` | Turborepo/pnpm Monorepo、Package 邊界與初始化順序。 | 260 | `34cf9fa18912` |
| `docs/23-REQUIREMENTS-TRACEABILITY.md` | Requirement 至 Spec、Package、Test、Milestone 的追蹤。 | 151 | `2564ded32d16` |
| `docs/24-GLOSSARY.md` | 產品、標準與工程名詞的統一定義。 | 79 | `0be6e9e9ae9a` |
| `docs/25-OPEN-DECISIONS.md` | Owner 在開工前需接受或修改的具體決策。 | 370 | `3dd9389bb7fe` |
| `docs/26-END-TO-END-EXAMPLE.md` | 空間預約 Canonical Example、Arazzo、Mock、Trace 與驗收。 | 488 | `80fe5f9a3b72` |
| `docs/27-OPEN-SOURCE-GOVERNANCE.md` | 角色、決策、Release、維護、License 與 Vendor 中立。 | 217 | `84c936c96ffd` |
| `docs/28-STANDARDS-BASELINE.md` | OpenAPI/Arazzo 與主要技術的 2026-09-01 基線。 | 238 | `f2884417fb71` |
| `docs/29-DEMO-AND-LAUNCH-PLAN.md` | Hero Demo、Playground、發布階段、渠道與指標。 | 260 | `daccfacf172b` |
| `docs/30-IMPLEMENTATION-READINESS-CHECKLIST.md` | Owner Review Gate 與正式寫 Implementation Plan 前檢查。 | 213 | `26380d368e8e` |
| `docs/adr/0001-ARAZZO-FIRST.md` | Arazzo 作為正式 Workflow 交換格式的決策。 | 101 | `61b8ffaffec0` |
| `docs/adr/0002-NORMALIZED-DOMAIN-MODEL.md` | 自有框架無關 Domain Model 的決策。 | 98 | `b1dfeaac47c3` |
| `docs/adr/0003-SHARED-MOCK-RUNTIME.md` | Mock Runtime 與 Fastify/MSW Adapter 分離的決策。 | 114 | `c1e13e8d6dfe` |
| `docs/adr/0004-EVIDENCE-BASED-INFERENCE.md` | 推導需可解釋且人工審核的決策。 | 107 | `392ca56571bf` |
| `docs/adr/0005-LOCAL-FIRST.md` | Local-first、No Telemetry 預設的決策。 | 94 | `db4803088065` |

## 3. 使用注意

- 所有 `Draft`/`Proposed` 文件都需由 Project Owner 審閱；
- ADR 接受後將狀態改為 `Accepted`；
- `README` 的 CLI 指令目前是目標介面，不代表 npm 套件已發布；
- 本包不包含正式 `LICENSE` 文字；Owner 採用 Apache-2.0 後，建立 Repo 時應加入官方完整 License；
- 詳細 Implementation Plan 刻意不在本包內，應在產品與架構文件通過後，先針對 M0–M1 另行撰寫；
- SHA 僅用於確認本次交付內容；任何修改後都應重新產生清單。
