# Contributing to API Schema Flow

感謝你參與 API Schema Flow。專案重視可驗證的標準支援、清楚的 Package Boundary、可重現的推導結果，以及對使用者資料的安全預設。

> 專案尚在規格階段；下列命令代表 Monorepo 初始化後的預期開發流程。

## 開發環境

- Node.js：使用 Repo 所宣告的 Active LTS 版本；
- Package manager：pnpm，透過 Corepack 固定版本；
- Task runner：Turborepo；
- 語言：TypeScript strict mode；
- 測試：Vitest、Playwright，以及 Fixture-based conformance tests。

```bash
corepack enable
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 分支與 Commit

- 從 `main` 建立短生命週期分支；
- 分支建議：`feat/...`、`fix/...`、`docs/...`、`refactor/...`；
- Commit 使用 Conventional Commits；
- 使用 Changesets 記錄會影響公開套件的變更；
- 不使用長期存在的 develop branch，也不要求 GitFlow。

範例：

```text
feat(inference): add response-to-path exact-name rule
fix(mock-runtime): isolate generated ids by session
docs(arazzo): clarify supported execution profile
```

## Pull Request 要求

每個 PR 應：

1. 只處理一個主要目的；
2. 說明使用者影響與架構影響；
3. 新增或更新測試；
4. 若行為改變，更新對應規格或 ADR；
5. 不將 Secret、真實 Token、Cookie 或未匿名化 API 文件放入 Fixture；
6. 通過 lint、typecheck、unit、integration 與相關 E2E；
7. 對公開套件變更加入 Changeset。

## Package Boundary

核心規則：

- `domain` 不得依賴 UI、HTTP Framework 或 Parser；
- `inference` 只接受 Normalized Model；
- `mock-runtime` 不得使用 Fastify Request/Reply；
- `adapter-fastify` 與 `adapter-msw` 只負責協定轉接；
- `execution` 透過介面使用 Request Transport 與 State Runtime；
- `ui` 不得直接存取 Parser-specific AST；
- Exporter 必須是 deterministic pure transformation。

違反邊界的 PR 應先提出 ADR 或更新既有 ADR。

## 新增 Inference Rule

每個 Rule 必須提供：

- 唯一 Rule ID；
- 可讀的 Evidence Message；
- 正向 Fixture；
- 至少一個容易誤判的反向 Fixture；
- 分數與理由；
- Determinism Test；
- Benchmark 影響報告。

Rule 不得直接自動 Accept Edge，也不得把泛用欄位 `id` 當作高可信證據。

## 新增 OpenAPI/Arazzo 功能

請附上：

- 規格版本與官方段落連結；
- 合法 Fixture；
- 非法 Fixture；
- Round-trip 或 Diagnostics 測試；
- 對舊版規格的相容性說明；
- Unsupported 行為的明確錯誤訊息。

## 測試資料

可以使用：

- 人工建立、無真實 Secret 的小型規格；
- 官方授權可再利用的範例；
- 經完全匿名化且確認可公開的案例。

不得提交：

- 內部 API URL、真實帳號、Token、Cookie；
- 客戶或學校的個資；
- 未確認授權的商業規格文件；
- 能連回真實系統的憑證與 Server Variable。

## Issue Triage

Labels 建議：

- `area:openapi`
- `area:arazzo`
- `area:inference`
- `area:mock`
- `area:execution`
- `area:ui`
- `area:cli`
- `standards`
- `security`
- `good-first-issue`
- `needs-reproduction`

Inference 誤判請使用專用 Issue Template，附上已移除敏感資訊的最小規格。

## Definition of Done

變更只有在下列條件成立時才算完成：

- 行為可由測試重現；
- 失敗模式有 Diagnostics；
- 不破壞 Package Boundary；
- 文件與實作一致；
- 沒有預設傳送 Telemetry 或 Secret；
- 對使用者可見的字串可理解且可搜尋；
- 需要 Migration 時已提供策略。
