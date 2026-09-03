# API Schema Flow

> **將 OpenAPI 的端點清單，轉換成可視化、可執行、可模擬的 API 工作流程。**

API Schema Flow 是一套開源、Local-first 的 API Workflow Workbench。長期產品會匯入 OpenAPI 規格、以互動式拓撲呈現 API 依賴、協助使用者審核有證據的流程推導、輸出標準 Arazzo 工作流，並透過具備狀態的 Mock Runtime 執行整段流程。

> 專案狀態：**Pre-alpha**。目前 Repository 已完成 M0 Foundation、M1 OpenAPI Ingestion Core，以及完整的 Headless M2 Workflow Layer：Arazzo Parse、Declared Graph、Evidence-based Inference、明確 Review Decision、Accepted Graph Materialization 與決定性 Arazzo Export。CLI 已提供 `validate`、`infer`、`review` 與 `export-arazzo`。視覺化 Workspace、Stateful Mock、Workflow Executor、Live Trace 與非 Arazzo Exporter 仍在 Roadmap 中，目前尚未發布 npm 套件。

## 現在已經能做什麼？

目前版本已具備：

- pnpm、Turborepo 與 TypeScript Strict Monorepo；
- Parser-independent 的 Domain、Diagnostics、Redaction、Project Config、Source Loader、OpenAPI、Arazzo、Flow、Inference、Review、Arazzo Exporter 與 CLI Package；
- 受 Policy 控制的本機與 HTTPS Source Loading，包含路徑、Symlink、Protocol、DNS/IP、Redirect、Timeout、大小、文件數量與 Reference Depth 限制；
- OpenAPI 3.0／3.1 決定性 Normalization、3.2 Compatibility Diagnostic、Multi-file `$ref` Graph、Fingerprint 與 Link Object；
- Arazzo 1.1.x JSON／YAML Parse／Preserve、Semantic Validation、Typed Runtime Expression AST、Dependency Analysis、Source URI Resolution、抽象 Operation Binding 與 Support Analysis；
- 將 OpenAPI Link 與 Arazzo Workflow 轉換成版本化 Declared Graph，包括 Endpoint Node、Workflow Step Node、Control Edge、Dependency Edge 與 Structural Data Mapping；
- 決定性的 Node、Edge、Mapping、Graph 與 Inference Candidate ID，並保留 Source Provenance 與跨標準宣告合併資訊；
- 保守的 Evidence-based Inference Engine，具備有界 Structural Index、Hard Blocker、可解釋 Scoring、Confidence Band、Declared-edge Suppression、Top-K Ranking、Benchmark Metrics，且永不自動接受 Candidate；
- Immutable 的 `accept`、`reject`、`edit` Review Decision，支援決定性 Identity、Revision Supersession、Stale／Orphaned 說明，以及 Accepted Inferred／Manual Edge Materialization；
- 明確 Workflow Plan 與決定性 Arazzo 1.1 YAML／JSON Export，具備 Canonical Ordering、精確 SHA-256 Content Hash、Parser Self-validation，且不會輸出 Candidate／Rejected Edge；
- 可自動辨識 OpenAPI 或 Arazzo 的 `schema-flow validate <file-or-url> [--json]`；
- 可組合 OpenAPI Ingestion、Declared Operation Graph 與 Inference 的 `schema-flow infer <openapi-file-or-url> [--json]`；
- 以 Decision Set 產生 Accepted-only Graph 的 `schema-flow review <openapi-file-or-url> --decisions <decision-set.json> [--json]`；
- 將明確排序的 Accepted Subset 輸出成 Arazzo 的 `schema-flow export-arazzo <openapi-file-or-url> --decisions <decision-set.json> --workflow <workflow-plan.json>`；
- Structured Diagnostic、Stable Source Pointer、敏感資料遮罩與穩定 Exit Code；
- 由正式 Parser 驗證的 OpenAPI、Arazzo、Declared Flow、Inference、Review 與 Export Fixture，以及 Unit、Integration、Conformance、Security、Performance、Benchmark、Golden 與 Boundary Test；
- 使用 Frozen Lockfile 的 GitHub Actions 驗證流程。

## 執行目前的垂直切片

環境需求：

- Node.js 24
- pnpm 11

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

node packages/cli/bin/schema-flow.mjs \
  validate examples/reservation/openapi.yaml
```

取得機器可讀的 Validation JSON：

```bash
node packages/cli/bin/schema-flow.mjs \
  validate examples/reservation/openapi.yaml \
  --json
```

驗證 Canonical Arazzo Workflow：

```bash
node packages/cli/bin/schema-flow.mjs \
  validate examples/reservation/arazzo.yaml
```

從 OpenAPI 產生 Evidence-based Dependency Candidate：

```bash
node packages/cli/bin/schema-flow.mjs \
  infer fixtures/inference/cli/openapi.yaml
```

取得機器可讀的 Inference JSON：

```bash
node packages/cli/bin/schema-flow.mjs \
  infer fixtures/inference/cli/openapi.yaml \
  --json
```

Inference 可使用 `--minimum-confidence <0..1>`、`--top-k <n>`、`--max-candidates <n>` 與 `--include-low` 調整輸出，也可沿用 `--allow-path`、`--allow-http`、`--allow-private-network` 與 Retrieval Budget 等既有 Source Policy 參數。

套用 Canonical Review Decision 並檢視 Accepted Graph：

```bash
node packages/cli/bin/schema-flow.mjs \
  review fixtures/review/reservation/openapi.yaml \
  --decisions fixtures/review/reservation/decision-set.json \
  --json
```

將明確排序的 Accepted Subset 匯出成 Canonical Arazzo YAML：

```bash
node packages/cli/bin/schema-flow.mjs \
  export-arazzo fixtures/review/reservation/openapi.yaml \
  --decisions fixtures/review/reservation/decision-set.json \
  --workflow fixtures/review/reservation/workflow-plan.json \
  --format yaml
```

使用 `--output <path>` 寫入檔案；除非明確提供 `--force`，否則不會覆寫既有檔案。`--format json` 代表輸出 Arazzo JSON，`--json` 則代表輸出機器可讀的 CLI Report。

執行 Repository 品質檢查：

```bash
pnpm ci:verify
pnpm test:flow-fixtures
pnpm test:inference-benchmark
pnpm test:inference-performance
pnpm test:review
pnpm test:export-arazzo
pnpm test:review-export-fixtures
```

成功驗證 OpenAPI 時會得到：

```text
API Schema Flow

✓ OpenAPI document loaded
✓ OpenAPI 3.1.0 detected
✓ 4 operations normalized
✓ 6 schemas discovered
✓ 0 errors
✓ 0 warnings

Validation completed successfully.
```

Arazzo 驗證成功時會顯示：

```text
API Schema Flow

✓ Arazzo document loaded
✓ Arazzo 1.1.0 detected
✓ 1 workflows normalized
✓ 4 steps inspected
Support: supported
✓ 1 sources loaded
✓ 0 errors
✓ 0 warnings

Validation completed successfully.
```

Inference 輸出會包含 Candidate 數量、Confidence Band、已評估與被阻擋的 Pair、被 Declared Mapping 抑制的數量、Evidence Rule ID、Diagnostic 與決定性的 Candidate 資料。每個 Inference 結果都固定維持 `provenance: inferred`、`status: candidate`。只有明確且有效的 M2-D Decision 能改變 Authoritative Graph：`accept` 形成 `inferred + accepted`、`edit` 形成 `manual + accepted`；`reject`、Stale、Orphaned、Superseded、Conflict 或 Invalid Decision 都不會建立 Edge。

## 為什麼需要這個專案？

OpenAPI 很擅長描述單一 API Operation，卻很難直接回答流程層級的問題：

- 哪個 Response 欄位會成為下一個 Request 參數？
- 登入、預約、結帳與重試流程分別經過哪些 API？
- 後端欄位改名時，哪些前端流程與測試情境會受影響？
- 後端尚未完成時，前端與 QA 如何操作具有真實生命週期的假資料？

API Schema Flow 不取代 OpenAPI，而是在它之上補上「可執行工作流程層」。

## 功能狀態

| 能力 | 目前 Repository | MVP 方向 |
|---|---|---|
| OpenAPI 匯入 | 本機／HTTPS YAML 與 JSON、受 Policy 控制的 Multi-file `$ref`、決定性 Fingerprint | 擴充公開 Conformance Corpus 與 Browser Source Adapter |
| OpenAPI Normalization | Stable ID、Source Pointer、Schema、Security、Server、Link Object、Compatibility 與 Ambiguity Diagnostic | 持續提供正規化欄位給 Flow 與 Inference Layer |
| Arazzo Core | Arazzo 1.1.x Parse／Preserve、Semantic Validation、Runtime Expression AST、DAG Analysis、URI 與抽象 Operation Resolution、Support Profile | 視覺編輯與支援子集合執行 |
| Declared Flow Graph | OpenAPI Link 與 Arazzo Step Order、`dependsOn`、Runtime Expression Mapping 已轉成版本化 `declared + accepted` Graph | 作為 Inference、Review UI、Export、Execution 與 Change Impact 的共同輸入 |
| Evidence-based Inference | 已實作 Candidate、明確 Accept／Reject／Edit、Stale／Orphan Detection、Revision Supersession 與 Accepted Inferred／Manual Edge Materialization | Web Workspace 的互動式 Review 與 Project File Persistence |
| CLI | 已有 `validate`、`infer`、`review` 與 `export-arazzo` | 預計增加 `open`、`mock`、`run`、Mermaid Export 與 Report Export |
| 視覺拓撲 | 目前只有設計規格與概念圖 | React Flow 節點與連線，使用 ELK Layered Layout |
| 依賴推導 | Declared Relationship、Inferred Candidate、Immutable Review Decision 與 Accepted-only Graph Materialization 都已實作；Candidate 不會自動接受 | 互動式 Review UI 與 Durable Project Snapshot Persistence |
| Stateful Mock | 尚未實作 | In-memory CRUD、固定 Seed、Session 隔離、Reset 與 Snapshot |
| Workflow Execution | 尚未實作 | 同步 OpenAPI Step、Mapping、Output、Criteria、Timeout 與有限 Retry |
| Live Trace 與 Export | 已實作決定性、可由 Parser 驗證的 Arazzo 1.1 YAML／JSON Export | Live Trace、Mermaid、Project JSON 與執行報告 |
| 變更影響 | Post-MVP | Flow-aware OpenAPI Diff 與 GitHub 整合 |

## 目標使用體驗

最終希望提供：

```bash
# 規劃中的 CLI 體驗；npm 套件尚未發布。
npx schema-flow open ./openapi.yaml
```

執行後開啟本機 Web Workspace，使用者可以：

1. 查看 Endpoint Node、Request 與 Response Schema；
2. 審核 Declared、Manual 與 Inferred 依賴；
3. 接受、拒絕或修改欄位映射；
4. 匯出符合標準的 Arazzo Workflow；
5. 啟動彼此隔離的 Stateful Mock Session；
6. 執行工作流並查看逐步 Live Trace。

## 差異化原則

API Schema Flow 不會把所有自動產生的連線都視為事實。每條 Edge 都要記錄來源：

- **Declared**：來自 Arazzo 或 OpenAPI Link Object。
- **Manual**：由使用者建立或修改。
- **Inferred**：由確定性規則推導，包含 Confidence 與 Evidence Breakdown。
- **Observed**：保留給未來從 Trace、HAR、OpenTelemetry 或 Proxy Traffic 取得的證據。

M2-B 只產生標準明確宣告的 `declared + accepted` Edge。M2-C 只產生 `inferred + candidate`：先套用安全 Hard Constraint，弱 Generic ID 證據會被限制在可見 Confidence 以下，而且 Candidate 絕不會被系統自行轉成正式 Accepted Graph Truth。M2-D 加入明確的人工作業邊界，將有效 Decision Materialize 成 Accepted Inferred／Manual Edge，並且只會把明確排序的 Accepted Subset 輸出成 Arazzo。

## 架構摘要

```mermaid
flowchart LR
    OA[OpenAPI Sources] --> ING[Parser Adapter + Normalizer]
    AR[Arazzo Sources] --> WF[Arazzo Model]
    ING --> FLOW[Declared Flow Graph]
    WF --> FLOW
    ING --> INF[Evidence-based Inference]
    FLOW --> INF
    INF --> REVIEW[Review Decisions]
    FLOW --> REVIEW
    REVIEW --> GRAPH[Accepted Graph]
    GRAPH --> UI[Interactive Workspace]
    GRAPH --> EXP[Arazzo / Mermaid Export]
    GRAPH --> RUN[Workflow Executor]
    RUN --> RT[Shared Mock Runtime]
    RT --> FAST[Fastify Adapter]
    RT --> MSW[MSW Adapter]
    RUN --> TRACE[Live Trace / Run Report]
```

目前已完成的 Core 會將 Framework 與 Parser 細節封裝在 Package Boundary 之後，讓 Domain、Diagnostics、Redaction、Config、Source Loading、OpenAPI Normalization、Arazzo Normalization、Declared Graph Projection、Evidence-based Inference、Review Materialization、Arazzo Export 與 CLI 不直接依賴未來的 React、Fastify、MSW 或 ELK Adapter。OpenAPI 與 Arazzo Parser Package 維持雙向獨立；`@api-schema-flow/flow` 組合標準已宣告語意、`@api-schema-flow/inference` 產生 Candidate、`@api-schema-flow/review` 套用明確 Decision，而 `@api-schema-flow/exporter-arazzo` 只序列化 Accepted Graph Truth。

## 目前的 Repository 結構

```text
packages/
  domain/
  diagnostics/
  redaction/
  config/
  source-loader/
  openapi/
  arazzo/
  flow/
  inference/
  review/
  exporter-arazzo/
  cli/
examples/
  reservation/
fixtures/
  openapi/
  arazzo/
  flow/
  inference/
  review/
docs/
  adr/
  design/
  reports/
  spikes/
  superpowers/specs/
  superpowers/plans/
tooling/
.github/workflows/
```

完整規劃請參考 [Repository Structure](docs/22-REPOSITORY-STRUCTURE.md)。

## 專案邊界

MVP 不會嘗試成為：

- 完整 Postman 替代品或 API Gateway；
- 正式生產流量 Proxy；
- 任意 JavaScript 執行沙箱；
- 僅憑 OpenAPI 就自動宣稱商業流程正確的工具；
- 需要登入、雲端儲存與多人協作的平台。

## 文件入口

完整文件請從 [文件索引](docs/00-DOCUMENT-INDEX.md) 開始。

重要文件：

- [產品需求文件 PRD](docs/02-PRD.md)
- [MVP 範圍與驗收](docs/03-MVP-SCOPE-AND-ACCEPTANCE.md)
- [系統架構](docs/06-SYSTEM-ARCHITECTURE.md)
- [OpenAPI Ingestion 規格](docs/08-OPENAPI-INGESTION-SPEC.md)
- [Arazzo Workflow 規格](docs/09-ARAZZO-WORKFLOW-SPEC.md)
- [Flow Inference 規格](docs/10-FLOW-INFERENCE-SPEC.md)
- [CLI 規格](docs/14-CLI-SPEC.md)
- [安全威脅模型](docs/19-SECURITY-THREAT-MODEL.md)
- [測試策略](docs/20-TEST-STRATEGY.md)
- [M0/M1-A Implementation Plan](docs/superpowers/plans/2026-09-01-m0-m1a-foundation.md)
- [M1-B Ingestion Hardening Plan](docs/superpowers/plans/2026-09-01-m1b-ingestion-hardening.md)
- [M2-A Arazzo Core Plan](docs/superpowers/plans/2026-09-01-m2a-arazzo-core.md)
- [M2-B Declared Flow Graph Design](docs/superpowers/specs/2026-09-02-m2b-declared-flow-graph-design.md)
- [M2-B Declared Flow Graph Plan](docs/superpowers/plans/2026-09-02-m2b-declared-flow-graph.md)
- [M2-C Evidence-Based Inference Design](docs/superpowers/specs/2026-09-02-m2c-inference-core-design.md)
- [M2-C Evidence-Based Inference Plan](docs/superpowers/plans/2026-09-02-m2c-inference-core.md)
- [M2-D Review 與 Arazzo Export Design](docs/superpowers/specs/2026-09-03-m2d-review-arazzo-export-design.md)
- [M2-D Review 與 Arazzo Export Plan](docs/superpowers/plans/2026-09-03-m2d-review-arazzo-export.md)
- [M2-D 驗證報告](docs/reports/m2d-review-arazzo-export-verification.md)

English: [README.md](README.md)

## 安全與隱私

本專案採 Local-first，預設不傳送 Telemetry。Remote OpenAPI Source 必須經過 M1-B Retrieval Policy：預設僅允許 HTTPS 與 Public-network IP、限制 Canonical Local Root、每次 Redirect 重新驗證、限制資源用量，且不自動帶入憑證。OpenAPI、Arazzo、Flow、Inference、Review 與 Export Diagnostic 在進入外部輸出前都會執行敏感資料遮罩；Declared／Reviewed Graph 只儲存 Structural Selector、Evidence Identifier 與 Source Pointer，不會保存 Runtime Secret Value。Candidate、Rejected、Stale、Orphaned、Superseded 與 Invalid Decision 不會進入 Arazzo Output；帶有 Credential 的 Source URL 與 Credential-shaped Generated Value 會被阻擋。詳見 [SECURITY.md](SECURITY.md) 與 [安全威脅模型](docs/19-SECURITY-THREAT-MODEL.md)。

## License

本專案採用 [Apache License 2.0](LICENSE)。
