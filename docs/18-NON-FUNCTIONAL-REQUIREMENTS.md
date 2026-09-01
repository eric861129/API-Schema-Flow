# 非功能需求規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 目的

本文件定義 API Schema Flow 的效能、可靠性、安全性、可及性、可維護性、相容性與可觀測性要求。所有數值皆為 MVP 的初始工程預算；正式公開 Beta 前，必須以可重現 Benchmark 驗證並調整。

## 2. 測試基準環境

除非測試另有註明，效能門檻以以下參考環境量測：

- 4 核心一般桌面 CPU；
- 16 GB RAM；
- Node.js Active LTS；
- Chromium 穩定版；
- 本機 SSD；
- 不包含第一次下載 npm 套件的時間；
- 使用固定、可公開的 Benchmark Fixtures；
- 每項測試至少執行 10 次，報告 Median、P95 與最大值。

CI 只做 Regression Gate；Release Benchmark 應另在固定 Runner 執行，避免共享 Runner 雜訊。

## 3. 效能要求

| ID | 情境 | MVP 目標 | 降級策略 |
|---|---|---:|---|
| NFR-PERF-001 | 載入、解析並正規化 500 個 Operations 的 OpenAPI | P95 ≤ 3 秒 | 顯示階段進度與可取消操作 |
| NFR-PERF-002 | 500 Nodes / 1,000 Edges 的首次 ELK Layout | P95 ≤ 5 秒 | Web Worker、分群、漸進顯示 |
| NFR-PERF-003 | 已載入畫布的搜尋與篩選回饋 | P95 ≤ 100 ms | 延遲非必要 Inspector 計算 |
| NFR-PERF-004 | 單次 Mock Request 的 Runtime 額外負擔，不含設定 Delay | P95 ≤ 25 ms | Diagnostic 顯示慢速 Resolver |
| NFR-PERF-005 | CLI `validate` 於 100 Operations 的冷啟動 | P95 ≤ 2 秒 | 延遲載入非驗證所需模組 |
| NFR-PERF-006 | 10,000 筆簡單 Resource 的 ID 查詢 | P95 ≤ 20 ms | 依 Resource/ID 建立索引 |
| NFR-PERF-007 | Live Trace 新增 1,000 個事件時的 UI 更新 | 不得造成持續 1 秒以上凍結 | Virtualization、Batching、Sampling |
| NFR-PERF-008 | Mermaid Export 500 Nodes | P95 ≤ 2 秒 | 可選擇只匯出目前 Workflow |

## 4. 規模與降級模式

| 層級 | Operations | 預期行為 |
|---|---:|---|
| Standard | 0–500 | 完整畫布、Inspector、Inference 與 Layout |
| Large | 501–2,000 | 自動分群、只顯示可見 Nodes、背景推導 |
| Extreme | >2,000 | 先顯示 Service/Tag Overview；要求選擇子圖後再展開 |

大型模式不得默默遺失 Operation。系統必須顯示目前載入數量、隱藏數量與已停用的計算。

## 5. 可靠性與決定性

| ID | 需求 |
|---|---|
| NFR-REL-001 | 相同來源內容、設定、Seed 與工具版本必須產生相同 Normalized Model。 |
| NFR-REL-002 | Inference Candidate 的 ID、分數與排序必須可重現。 |
| NFR-REL-003 | Arazzo、Mermaid、Project JSON 與 Run Report Export 必須採穩定排序。 |
| NFR-REL-004 | 單一不合法 Operation 不得造成整份規格的未處理例外；可恢復錯誤應轉為 Diagnostic。 |
| NFR-REL-005 | Snapshot Restore 必須是原子操作；失敗時保留原 Session State。 |
| NFR-REL-006 | 使用者可取消 Parse、Layout、Inference、Run 與 Export；取消後不得殘留半完成狀態。 |
| NFR-REL-007 | CLI 的相同錯誤分類必須回傳相同 Exit Code。 |
| NFR-REL-008 | 所有持久化格式必須包含 `schemaVersion` 與建立工具版本。 |

## 6. 安全與隱私

詳細威脅與控制見 [Security Threat Model](19-SECURITY-THREAT-MODEL.md)。

| ID | 需求 |
|---|---|
| NFR-SEC-001 | Local Mock Server 預設只綁定 Loopback Interface。 |
| NFR-SEC-002 | Remote Source 與 Remote `$ref` 受 Protocol、Host、Redirect、Size、Timeout 與 Private Network Policy 限制。 |
| NFR-SEC-003 | Trace、Log、Snapshot、Project 與 Export 共用同一套 Redaction Policy。 |
| NFR-SEC-004 | 不執行規格、Description、Example 或 Project File 內的任意程式碼。 |
| NFR-SEC-005 | Markdown、HTML、SVG 與 URL 在顯示前必須 Sanitization。 |
| NFR-SEC-006 | Live API Execution 預設關閉，啟用時必須顯示 Scheme、Host 與 Credential 使用範圍。 |
| NFR-SEC-007 | 預設不收集 Telemetry；未來加入時必須是明確 Opt-in。 |
| NFR-SEC-008 | 發布前執行 Dependency Audit、Secret Scan、SAST 與惡意 Fixture 測試。 |

## 7. 可及性

MVP 以 WCAG 2.2 AA 為設計目標，但不得以「視覺畫布很複雜」作為排除鍵盤使用者的理由。

| ID | 需求 |
|---|---|
| NFR-ACC-001 | 主要流程可僅用鍵盤完成：匯入、搜尋、選取、審核 Edge、執行、查看結果、匯出。 |
| NFR-ACC-002 | Node、Edge、Status 與 Method 不得只用顏色區分。 |
| NFR-ACC-003 | 動畫尊重 `prefers-reduced-motion`，且可在產品內關閉。 |
| NFR-ACC-004 | Canvas 必須提供等價的 List/Outline View。 |
| NFR-ACC-005 | Inspector 與 Dialog 必須具正確 Focus Management、名稱與狀態宣告。 |
| NFR-ACC-006 | 文字與互動元件符合 AA 對比；縮放 200% 時主要操作仍可用。 |
| NFR-ACC-007 | 執行 Trace 提供可複製的文字表格，不只顯示粒子動畫。 |

## 8. 可維護性

| ID | 需求 |
|---|---|
| NFR-MNT-001 | Domain、OpenAPI、Arazzo、Inference、Mock Runtime、Execution 不得依賴 React。 |
| NFR-MNT-002 | Adapter 不得把 Framework 型別洩漏到核心 Public API。 |
| NFR-MNT-003 | 核心套件必須啟用 TypeScript Strict Mode。 |
| NFR-MNT-004 | Public Type、Config Schema 與 Diagnostic Code 變更必須經 API Review。 |
| NFR-MNT-005 | 每個 Package 有單一責任、Owner 說明、Public Entry Point 與 Boundary Test。 |
| NFR-MNT-006 | 不允許以 Circular Dependency 解決跨套件協作。 |
| NFR-MNT-007 | Runtime、Inference 與 Export 的主要規則採資料驅動並有 Fixture Coverage。 |
| NFR-MNT-008 | 新增功能必須先更新相關 Spec 或 ADR，再合併實作。 |

## 9. 可移植性與相容性

- CLI 與 Local Server 支援 Windows、macOS、Linux；
- Web Workspace 支援目前仍受主流瀏覽器維護的版本；
- Node.js 支援範圍採 Active LTS 與前一個 Maintenance LTS，確切版本在第一個 Release 鎖定；
- 檔案路徑必須處理 Windows Drive Letter、UNC、大小寫差異與 Symlink；
- 核心 Package 優先使用 Web Standard API，Node-only 能力封裝在 Adapter；
- 所有文字檔輸出 UTF-8、LF；讀取時接受 CRLF；
- 時間欄位輸出 RFC 3339 UTC，UI 再依使用者時區顯示；
- 不依賴全域安裝套件即可完成 Quickstart。

## 10. 可觀測性與診斷

系統必須能在不暴露 Secret 的前提下解釋「發生什麼事」。

每個 Diagnostic 至少包含：

```ts
type Diagnostic = {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  sourceId?: string
  sourcePointer?: string
  operationKey?: string
  workflowId?: string
  stepId?: string
  suggestion?: string
}
```

必要控制：

- Structured Log 支援人類可讀與 JSON；
- 每次 Run、Session、Import 與 Export 有 Correlation ID；
- `--verbose` 不能停用 Redaction；
- Crash Report 預設只寫入本機；
- Diagnostic Bundle 必須先列出將包含的檔案與遮罩摘要；
- Telemetry 與 Error Reporting 不屬 MVP。

## 11. 資料完整性與持久化

- Project Save 採 Write-to-temp + Atomic Rename；
- Project/Run/Snapshot 必須驗證 Schema Version；
- 匯入舊格式前先建立備份；
- 未完成遷移不得覆蓋來源；
- 來源 OpenAPI/Arazzo 預設以 Reference 保存；Embed 必須明確選擇；
- State 預設只存於記憶體，Snapshot 是使用者主動操作；
- IndexedDB/Local Storage 儲存不得包含未遮罩 Authorization、Cookie 或 API Key。

## 12. Release Gate

MVP Candidate 必須通過：

1. Standard 與 Large Benchmark；
2. Determinism Snapshot Tests；
3. Accessibility Keyboard Journey；
4. Secret Redaction Matrix；
5. Windows、macOS、Linux CLI Smoke Test；
6. Chromium 與至少另一 Browser Engine 的 Web E2E；
7. 依賴與惡意輸入安全測試；
8. 無未處理例外的公開 Fixtures；
9. 文件中的效能與相容性聲明已由實測支持。
