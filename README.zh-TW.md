# API Schema Flow

> **將 OpenAPI 的端點清單，轉換成可視化、可執行、可模擬的 API 工作流程。**

API Schema Flow 是一套開源、Local-first 的 API Workflow Workbench。長期產品會匯入 OpenAPI 規格、以互動式拓撲呈現 API 依賴、協助使用者審核有證據的流程推導、輸出標準 Arazzo 工作流，並透過具備狀態的 Mock Runtime 執行整段流程。

> 專案狀態：**Pre-alpha**。目前 Repository 已完成 M0 Foundation、M1 OpenAPI Ingestion Core 與 M2-A Arazzo Core。可實際執行的 `validate` 指令會自動辨識 OpenAPI 或 Arazzo；視覺化 Workspace、Inference、Stateful Mock、Workflow Executor 與 Exporter 仍在 Roadmap 中，目前尚未發布 npm 套件。

## 現在已經能做什麼？

目前版本已具備：

- pnpm、Turborepo 與 TypeScript Strict Monorepo；
- Parser-independent 的 Domain、Diagnostics、Redaction、Project Config、Source Loader、OpenAPI、Arazzo 與 CLI Package；
- 受 Policy 控制的本機與 HTTPS Source Loading，包含路徑、Symlink、Protocol、DNS/IP、Redirect、Timeout、大小、文件數量與 Reference Depth 限制；
- OpenAPI 3.0／3.1 決定性 Normalization、3.2 Compatibility Diagnostic、Multi-file `$ref` Graph、Fingerprint 與 Link Object；
- Arazzo 1.1.x JSON／YAML Parse／Preserve、Semantic Validation、Typed Runtime Expression AST、Dependency Analysis、Source URI Resolution、抽象 Operation Binding 與 Support Analysis；
- 可自動辨識 OpenAPI 或 Arazzo 的 `schema-flow validate <file-or-url> [--json]`；
- Structured Diagnostic、Stable Source Pointer、敏感資料遮罩與穩定 Exit Code；
- 離線 OpenAPI／Arazzo Reservation Fixture，以及 Unit、Integration、Conformance、Security、Performance 與 Boundary Test；
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

取得機器可讀的 JSON 輸出：

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

執行與 CI 相同的完整品質檢查：

```bash
pnpm ci:verify
```

成功驗證時，現在會得到：

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
| OpenAPI Normalization | Stable ID、Source Pointer、Schema、Security、Server、Link Object、Compatibility 與 Ambiguity Diagnostic | 將 Declared Link 接入 Versioned Flow Graph |
| Arazzo Core | Arazzo 1.1.x Parse／Preserve、Semantic Validation、Runtime Expression AST、DAG Analysis、URI 與抽象 Operation Resolution、Support Profile | 視覺化、編輯、Export Round-trip 與支援子集合執行 |
| CLI | `validate <file-or-url> [--json]` 會自動辨識 OpenAPI 或 Arazzo | 預計增加 `open`、`infer`、`mock`、`run`、`export` |
| 視覺拓撲 | 目前只有設計規格與概念圖 | React Flow 節點與連線，使用 ELK Layered Layout |
| 依賴推導 | 已正規化 OpenAPI Link 與 Arazzo Dependency；尚未實作 Inference | Manual 與具 Evidence 的 Inferred Edge |
| Stateful Mock | 尚未實作 | In-memory CRUD、固定 Seed、Session 隔離、Reset 與 Snapshot |
| Workflow Execution | 尚未實作 | 同步 OpenAPI Step、Mapping、Output、Criteria、Timeout 與有限 Retry |
| Live Trace 與 Export | 尚未實作 | Live Trace、Arazzo、Mermaid、Project JSON 與執行報告 |
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
- **Inferred**：由確定性規則推導，包含 Confidence 與 Evidence。
- **Observed**：保留給未來從 Trace、HAR、OpenTelemetry 或 Proxy Traffic 取得的證據。

任何 Inferred Edge 在使用者接受前都只是 Candidate，不得直接成為正式工作流。

## 架構摘要

```mermaid
flowchart LR
    OA[OpenAPI Sources] --> ING[Parser Adapter + Normalizer]
    AR[Arazzo Sources] --> WF[Arazzo Model]
    ING --> DOM[Normalized Domain Model]
    WF --> DOM
    DOM --> INF[Dependency Inference]
    INF --> GRAPH[Versioned Flow Graph]
    GRAPH --> UI[Interactive Workspace]
    GRAPH --> EXP[Arazzo / Mermaid Export]
    GRAPH --> RUN[Workflow Executor]
    RUN --> RT[Shared Mock Runtime]
    RT --> FAST[Fastify Adapter]
    RT --> MSW[MSW Adapter]
    RUN --> TRACE[Live Trace / Run Report]
```

目前已完成的 Core 會將 Framework 與 Parser 細節封裝在 Package Boundary 之後，讓 Domain、Diagnostics、Redaction、Config、Source Loading、OpenAPI Normalization、Arazzo Normalization 與 CLI 不直接依賴未來的 React、Fastify、MSW 或 ELK Adapter。OpenAPI 與 Arazzo Parser Package 也維持雙向獨立，只有 CLI 作為組合層。

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
  cli/
examples/
  reservation/
fixtures/
  openapi/
  arazzo/
docs/
  adr/
  design/
  spikes/
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
- [CLI 規格](docs/14-CLI-SPEC.md)
- [安全威脅模型](docs/19-SECURITY-THREAT-MODEL.md)
- [測試策略](docs/20-TEST-STRATEGY.md)
- [M0/M1-A Implementation Plan](docs/superpowers/plans/2026-09-01-m0-m1a-foundation.md)
- [M1-B Ingestion Hardening Plan](docs/superpowers/plans/2026-09-01-m1b-ingestion-hardening.md)
- [M2-A Arazzo Core Plan](docs/superpowers/plans/2026-09-01-m2a-arazzo-core.md)

English: [README.md](README.md)

## 安全與隱私

本專案採 Local-first，預設不傳送 Telemetry。Remote OpenAPI Source 必須經過 M1-B Retrieval Policy：預設僅允許 HTTPS 與 Public-network IP、限制 Canonical Local Root、每次 Redirect 重新驗證、限制資源用量，且不自動帶入憑證。OpenAPI 與 Arazzo Diagnostic 在進入 CLI 輸出前都會執行敏感資料遮罩。詳見 [SECURITY.md](SECURITY.md) 與 [安全威脅模型](docs/19-SECURITY-THREAT-MODEL.md)。

## License

本專案採用 [Apache License 2.0](LICENSE)。
