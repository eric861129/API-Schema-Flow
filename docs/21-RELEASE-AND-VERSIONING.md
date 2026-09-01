# 發布與版本策略

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow 專案

## 1. 原則

1. 使用 Semantic Versioning；
2. `0.x` 期間仍清楚標示 Breaking Change；
3. Monorepo 第一階段採 Fixed Version Group，降低跨套件相容性負擔；
4. 文件、CLI Help、Config Schema、Project Schema 與 npm Package 必須能對應同一 Release；
5. Release Artifact 必須可追溯至 Commit 與 CI Evidence；
6. 不把未完成或只有 UI Stub 的功能寫入 Release Notes。

## 2. 版本範圍

### 2.1 產品版本

以下套件在 MVP 前採相同版本：

```text
@api-schema-flow/domain
@api-schema-flow/openapi
@api-schema-flow/arazzo
@api-schema-flow/inference
@api-schema-flow/mock-runtime
@api-schema-flow/execution
@api-schema-flow/exporters
@api-schema-flow/cli
@api-schema-flow/web
```

Adapter 可同版本發布，即使某次沒有程式變更，也維持相容性辨識簡單。

### 2.2 格式版本

產品版本與資料格式版本分開：

| 格式 | 欄位 | 例 |
|---|---|---|
| Project | `schemaVersion` | `1.0` |
| Snapshot | `schemaVersion` | `1.0` |
| Run Report | `schemaVersion` | `1.0` |
| Inference Report | `schemaVersion` | `1.0` |
| Config | `version` | `1` |

Patch Release 不得無聲改變相同 Schema Version 的語意。

## 3. Pre-release 階段

| 階段 | 版本例 | 用途 | 穩定性承諾 |
|---|---|---|---|
| Internal | `0.0.x` | 垂直切片與內部驗證 | 無 Public API 承諾 |
| Alpha | `0.1.0-alpha.n` | 早期貢獻者測試 | 格式與 CLI 可改 |
| Beta | `0.1.0-beta.n` | 真實專案驗證 | Breaking Change 需 Migration Note |
| MVP | `0.1.0` | 第一個公開可用版本 | 文件化範圍內可依賴 |
| Stable | `1.0.0` | Public API/Format 穩定 | 遵守完整 SemVer |

## 4. SemVer 判定

### Major

- 刪除或改變 Public API；
- CLI Command/Flag 不相容變更；
- Project/Config 格式無自動遷移的破壞；
- Diagnostic Code 語意改變；
- Workflow/Mock Runtime 行為不相容；
- 拿掉已宣告支援的標準能力。

`0.x` 期間上述變更可以增加 Minor，但仍必須在 Changelog 以 **Breaking** 標示。

### Minor

- 新增向後相容功能；
- 新 Inference Rule；
- 新 Exporter 或 Adapter；
- 新 CLI Flag；
- 支援新的 OpenAPI/Arazzo Minor Version；
- 新 Diagnostic Code。

### Patch

- Bug、安全修正；
- 不改 Public Contract 的效能改善；
- 文件、Fixture、錯字；
- 在既有語意內調整 Diagnostic Message；
- 依賴 Patch Update。

Inference Score 調整可能改變 Candidate 排序，即使 API 沒變，也視為使用者可觀察行為；必須至少是 Minor 或在 Release Note 明確標示。

## 5. npm Dist-tag

| Tag | 用途 |
|---|---|
| `next` | Alpha/Beta |
| `latest` | 經 Release Gate 的公開版本 |
| `canary` | 指定 Commit 的短期驗證，不保證保留 |

README Quickstart 預設只引用 `latest`。Canary 不應由一般使用者誤裝。

## 6. 變更管理

建議採 Changesets 或同等機制。每個影響使用者的 PR 新增變更描述：

```md
---
"@api-schema-flow/cli": minor
"@api-schema-flow/inference": minor
---

Add explainable authentication propagation inference.
```

不需要 Changeset 的情況：

- 純內部測試；
- 未進入公開套件的開發工具；
- 不影響使用者的文件重排；
- Alpha 前、尚未發布的初始骨架。

即使免 Changeset，PR 仍需說明使用者影響。

## 7. Migration 與相容性

- Loader 支援讀取目前與前一個 Project Schema Major；
- 寫出時只使用目前版本；
- Migration 先建立備份並輸出報告；
- Migration 必須 Deterministic、可測試、不可靜默丟欄位；
- Unknown Extension 預設保留；
- 無法安全遷移時以 Diagnostic 阻擋，不猜測；
- Deprecated CLI Flag 至少跨一個 Minor Release 保留警告；
- Security Risk 可縮短棄用期，但 Release Note 必須說明。

## 8. Release Branch 與標籤

MVP 建議 Trunk-based：

- `main`：可發布；
- 短期 Feature Branch；
- `release/x.y`：只有需要維護舊版時建立；
- Git Tag：`v0.1.0`；
- npm Package、GitHub Release 與 Tag 版本一致。

不得以長期 `develop` Branch 作為必要流程，避免小型開源團隊額外同步成本。

## 9. Release Checklist

1. 所有 Must Requirement 通過；
2. Requirements Traceability 無缺口；
3. 全平台與 Browser Matrix 通過；
4. Benchmark 無未解釋 Regression；
5. Security/License/Secret Scan 通過；
6. `npm pack` 內容審查；
7. Quickstart 由乾淨環境實測；
8. Changelog 與 Migration Note 完成；
9. Known Limitations 與 Support Matrix 更新；
10. Version、Tag、Package 與 Docs 一致；
11. Provenance/Attestation 產生；
12. 發布後安裝 Smoke Test 通過；
13. GitHub Release 使用相同 Artifact；
14. 公告中不宣稱超出實際支援範圍。

## 10. Hotfix

安全或資料完整性問題：

- 先建立私密 Advisory；
- 修補受影響分支；
- 發布 Patch；
- Changelog 說明影響版本與升級方式；
- 必要時撤下或 Deprecate 受害版本；
- 完成 Root Cause 與 Regression Test；
- 不在修補公開前洩漏可利用細節。

## 11. 版本生命週期

在 `1.0` 前只承諾支援最新 Minor。`1.0` 後再依實際維護能力決定 LTS，不提前承諾多分支長期支援。

每個 Release 頁面應標示：

- Released；
- Maintained；
- Security-only；
- End-of-life。

## 12. Changelog 格式

採 Keep a Changelog 類型分類：

```md
## [0.1.0] - YYYY-MM-DD

### Added
### Changed
### Fixed
### Security
### Deprecated
### Removed
### Known limitations
```

Breaking Change 置於最前並附 Migration。
