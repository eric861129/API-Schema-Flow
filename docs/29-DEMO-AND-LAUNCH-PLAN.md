# Demo 與開源發布計畫

> 狀態：草案，待 MVP 功能完成後執行  
> 文件版本：0.1.0  
> 最後更新：2026-09-01

## 1. 發布目標

第一波發布不是只追求 GitHub Star，而是驗證三件事：

1. 目標使用者能在 30 秒內理解產品差異；
2. 開發者能在 5 分鐘內完成第一個 Stateful Workflow；
3. 真實回饋能改善 Inference、Mock 與 Arazzo Execution，而不讓產品失焦。

## 2. 核心訊息

英文：

> OpenAPI tells you what endpoints exist. API Schema Flow shows how they work together—and lets you run the workflow before the backend exists.

繁中：

> OpenAPI 告訴你有哪些端點；API Schema Flow 讓你看懂它們如何協作，並在後端完成前直接執行整段流程。

避免使用：

- “Automatically understands every business workflow”；
- “AI-powered”；
- “Complete Postman replacement”；
- “Production-grade service virtualization”；
- “Full Arazzo support”；
- 未經 Benchmark 支持的速度或準確率。

## 3. Hero Demo：30 秒

### 0–4 秒：啟動

```bash
npx schema-flow open ./examples/reservation/openapi.yaml
```

畫面顯示 Local URL 與 No Telemetry/Loopback 標記。

### 5–10 秒：流程拓撲

瀏覽器顯示 Login、Spaces、Reservations。ELK 完成 Layout，Edge 以 Declared/Manual/Inferred 標籤區分。

### 11–16 秒：可信推導

點擊 `reservation.id → path.reservationId`，Inspector 顯示：

- Evidence；
- Confidence；
- Source/Target；
- Accept/Edit/Reject。

使用者按 Accept，不用假裝系統全自動正確。

### 17–24 秒：Stateful Mock

執行 Workflow：

```text
login 200
listSpaces 200
createReservation 429 → retry → 201
readReservation 200
```

畫面同步顯示 `res-0001` 被寫入 Store，再被 GET 讀回。

### 25–30 秒：匯出

點擊 Export：

- `reservation.arazzo.yaml`
- `reservation-flow.md`
- `run-report.json`

結尾顯示一句產品定位與 GitHub Repo。

## 4. Demo 視覺原則

- Dark Mode 可作主視覺，但 Light Mode 也可用；
- 不使用過量發光與動畫掩蓋資訊；
- `prefers-reduced-motion` 版仍能理解；
- Method Color 之外有文字；
- 游標移動與點擊節奏慢到可讀；
- 畫面避免顯示真 Token、Email、內網 Host；
- Terminal 只顯示必要輸出；
- 以 16:9、1080p 錄製；
- README 提供 GIF/WebM，但另有靜態截圖與文字說明；
- Demo 使用正式 Build，不用手動剪接假結果冒充功能。

## 5. Playground

預載三個 Synthetic Projects：

| Project | 展示能力 |
|---|---|
| Reservation | Auth、CRUD、Retry、Stateful Read-back |
| E-commerce Checkout | 多 Resource Mapping、Payment Failure |
| Token Refresh | Auth Context、401、Refresh、Retry |

限制：

- 無帳號；
- 不保存內容；
- 不接受任意 Private URL；
- 可 Upload 本機檔案但只在 Browser Memory；
- 使用 MSW/Shared Runtime；
- 提供 Reset；
- 顯示版本與支援矩陣；
- 錯誤回報不自動上傳文件。

## 6. README 首屏順序

1. Logo/Name；
2. 一句話定位；
3. Hero Demo；
4. Quickstart；
5. What it solves；
6. Core workflow；
7. Honest support matrix；
8. Architecture；
9. Examples；
10. Roadmap/Contributing；
11. Security/License。

不要先放長篇架構；使用者先需要知道它是否解決問題。

## 7. 發布資產

| 資產 | Gate |
|---|---|
| README 英文/繁中 | Quickstart 實測 |
| 30 秒 Hero Video | 與實際 Release 一致 |
| 3–5 張 Screenshots | Light/Dark、Canvas、Trace、Inspector |
| Playground | 無外部依賴、無資料保存 |
| Reservation Example | E2E 通過 |
| Architecture Diagram | 與 Repo Structure 一致 |
| Changelog | Known Limitations 完整 |
| Release Notes | 安裝、支援、風險、下一步 |
| Security/Contributing | 有效流程 |
| Social Preview | Repo 首頁可辨識 |

## 8. 發布階段

### Phase A：Design Preview

對少量 API/Frontend/QA 工程師展示 Prototype，驗證術語與流程，不公開宣稱可用。

### Phase B：Private Alpha

- 5–10 個真實但可匿名化 OpenAPI；
- 收集 Parser Failure、Inference Quality、Mock Override；
- 不上傳使用者規格；
- Issue 可先 Private/Redacted。

### Phase C：Public Alpha

- npm `next`；
- 明確 Alpha Banner；
- Playground；
- Inference Quality Report Template；
- 不承諾 Format Stability。

### Phase D：MVP

- npm `latest`；
- Release Gate 通過；
- Quickstart、Support Matrix、Migration；
- 公開 GitHub Discussion 與 Roadmap。

## 9. 傳播渠道與內容角度

### GitHub

- README Demo；
- Topic：openapi、arazzo、api-mocking、developer-tools、react-flow；
- Release Notes；
- Discussions；
- Good First Issues。

### OpenAPI / API 社群

重點放在：

- Arazzo-first；
- 可解釋 Inference；
- Parse/Execute 支援界線；
- Stateful Mock Workflow。

### Frontend 社群

重點放在：

- 後端未完成即可建立真實 CRUD Flow；
- Delay/429/500；
- MSW/Local Server 使用方式；
- Storybook/Test 的未來整合。

### QA 社群

重點放在：

- Deterministic Session；
- Scenario、Snapshot、Replay；
- Run Report；
- Fault/Retry。

### X / Threads / Reddit / Hacker News

以 Demo 與具體問題開始，不以「我做了一個很酷的工具」開始。所有貼文連回 README 或 Playground，不要求使用者先讀 PRD。

## 10. 回饋表單

回饋優先詢問：

1. 匯入是否成功；
2. 哪個 Candidate 正確/錯誤；
3. Evidence 是否足以做決定；
4. Stateful Mock 哪種業務規則無法表達；
5. 哪個 Arazzo 能力被阻擋；
6. 完成第一個 Workflow 花多少步驟；
7. 是否願意把 Export 提交到 Repo；
8. 是否遇到敏感資料疑慮。

不收集完整規格；需要 Fixture 時提供 Redaction Guide。

## 11. 發布成功指標

第一個月使用領先指標，不以 Star 作唯一成功：

| 指標 | 目標用途 |
|---|---|
| Quickstart completion | 安裝與第一價值 |
| Import success rate（手動回報/測試） | Parser 相容性 |
| Candidate accept/reject/edit distribution | Inference 品質 |
| Workflow run completion | Execution 可用性 |
| Mock session read-back | Stateful 核心價值 |
| Export committed by users | 工作流程黏著度 |
| Security/privacy blockers | Local-first 信任 |
| Contributor conversion | 開源健康 |
| Star/Fork/Traffic | 傳播輔助指標 |

MVP 不預設 Telemetry，因此主要透過自願回報、Issue、Playground Aggregate（若明確 Opt-in）與可公開 Benchmark 收集。

## 12. Launch Gate

- Hero Demo 每一幕都能在 Release 重現；
- README 沒有未實作的現在式宣稱；
- npm/CLI 名稱可用且無明顯衝突；
- License、DCO、Security Contact 完成；
- Playground 不上傳或保存規格；
- Reservation E2E 與 Security Gate 通過；
- Support Matrix 與 Known Limitations 可見；
- Maintainer 有能力處理第一波 Issue；
- 至少預先準備 5 個高品質 Good First/Help Wanted Issue；
- 發布後的回復節奏不做不切實際承諾。
