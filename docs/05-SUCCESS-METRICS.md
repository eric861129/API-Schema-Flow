# 成功指標與量測計畫

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 指標原則

API Schema Flow 採 Local-first，預設不收集產品 Telemetry。因此成功指標分為：

1. 可在自動測試與 Benchmark 直接量測的工程指標；
2. 由自願提供的 User Study、Issue 與匿名 Benchmark 取得的體驗指標；
3. GitHub/npm 等公開平台的採用指標。

不得為追求數據而預設上傳 API 文件、Trace、Operation Path 或使用者行為。

## 2. North-star Metric

### NSM-001：Time to First Executable Flow

從使用者選擇 OpenAPI 到成功執行至少三個 Step、包含一個跨 Step Output Mapping 的時間。

**MVP 目標：** 新使用者在引導情境中，中位數不超過 5 分鐘。

量測方式：

- Maintainer-run usability test；
- 使用者自願執行 `schema-flow benchmark onboarding`，只輸出本機報告；
- 不將 Spec 內容回傳。

## 3. Activation Metrics

| ID | 指標 | MVP 目標 |
|---|---|---|
| MET-ACT-001 | Time to First Graph | 中位數 ≤ 2 分鐘 |
| MET-ACT-002 | Time to First Accepted Edge | 中位數 ≤ 3 分鐘 |
| MET-ACT-003 | Time to First Stateful Read-after-Write | 中位數 ≤ 5 分鐘 |
| MET-ACT-004 | Quickstart Completion Rate | 受測者 ≥ 80% 無協助完成 |
| MET-ACT-005 | Import Success Rate on curated fixtures | 100% |

## 4. Inference Quality

| ID | 指標 | 目標 |
|---|---|---|
| MET-INF-001 | High-confidence Precision | ≥ 85% |
| MET-INF-002 | Declared Link Resolution | 合法 Fixture 100% |
| MET-INF-003 | Determinism | 相同輸入輸出 Hash 100% 相同 |
| MET-INF-004 | Generic-ID False Positive | 僅 `id` 證據不得進入 High-confidence |
| MET-INF-005 | Evidence Completeness | 100% Candidate 有 Rule、Source、Target、Reason |

Inference 初期重視 Precision 高於 Recall。少推薦一條 Edge 的成本，低於推薦錯誤流程並讓使用者失去信任。

## 5. Mock 與 Execution Quality

| ID | 指標 | 目標 |
|---|---|---|
| MET-MCK-001 | Session Isolation | 自動測試 100% |
| MET-MCK-002 | Deterministic Replay | 相同 Seed/Input/Revision 結果一致 |
| MET-MCK-003 | CRUD Golden Scenarios | Create/List/Get/Patch/Delete 全部通過 |
| MET-EXE-001 | Supported Arazzo Profile Pass Rate | Curated valid fixtures 100% |
| MET-EXE-002 | Unsupported Feature Diagnostics | Curated unsupported fixtures 100% 有明確訊息 |
| MET-EXE-003 | Secret Redaction | 敏感 Fixture 100% 不出現在 Export |

## 6. 效能指標

| ID | 指標 | 參考硬體目標 |
|---|---|---|
| MET-PERF-001 | Parse + Normalize 500 Operations | P95 ≤ 3 秒 |
| MET-PERF-002 | First Layered Layout 500 Nodes | P95 ≤ 5 秒 |
| MET-PERF-003 | Search/Filter Interaction | P95 ≤ 100 ms |
| MET-PERF-004 | Mock Runtime Added Overhead | P95 ≤ 25 ms，不含設定 Delay |
| MET-PERF-005 | CLI Cold Validate Small Spec | P95 ≤ 2 秒 |

參考硬體與版本必須記錄在 Benchmark Report，避免只保留數字。

## 7. Reliability 與品質

| ID | 指標 | 目標 |
|---|---|---|
| MET-REL-001 | Core Package Branch Coverage | ≥ 85% |
| MET-REL-002 | Core Package Statement Coverage | ≥ 90% |
| MET-REL-003 | Unhandled Rejection in E2E | 0 |
| MET-REL-004 | Critical/High Security Finding at Release | 0 |
| MET-REL-005 | Deterministic Export Snapshot | 100% |

Coverage 是風險訊號，不是品質的唯一代理。標準邊界、Property-based Test 與 Golden Fixture 同樣必要。

## 8. 採用與社群指標

| ID | 指標 | 解讀 |
|---|---|---|
| MET-OSS-001 | npm Weekly Downloads | 安裝與試用趨勢 |
| MET-OSS-002 | GitHub Stars | 初步興趣，不代表留存 |
| MET-OSS-003 | Unique External Contributors | 社群健康度 |
| MET-OSS-004 | Issue Median Time to First Response | 維護品質 |
| MET-OSS-005 | External Example Repositories | 真實採用證據 |
| MET-OSS-006 | Repeat Contributors | 長期參與度 |

不得把 Star 當作 North-star Metric，也不得為增加 Star 犧牲可信度與範圍控制。

## 9. Guardrail Metrics

- Inference Reject Rate 持續升高；
- Import Crash Rate；
- 被 Redaction 漏掉的敏感欄位；
- 大型 Spec 導致 Browser Freeze；
- Mock 與 OpenAPI Schema 不一致；
- UI 顯示 Supported、CLI 卻拒絕執行；
- Issue 中因文件誤導造成的重複問題。

任何 Guardrail 出現回歸時，應暫緩新增功能。

## 10. 無 Telemetry 情況下的量測方法

- Repo 內固定 Benchmark；
- 可重現的 Playwright Onboarding Script；
- 版本發布前由 5–8 位目標使用者完成 Moderated Test；
- GitHub Discussion 收集 Workflow 成功/失敗案例；
- 提供本機 `diagnostics bundle`，由使用者主動附加；
- Bundle 預設只含版本、錯誤碼、Timing 與匿名 Hash，不含 Path、Payload、Secret。

## 11. MVP 成功判斷

MVP 不是「功能全部完成」，而是同時達成：

1. Activation：多數目標使用者能完成 Golden Path；
2. Trust：High-confidence Inference Precision 達標；
3. Utility：Stateful Read-after-Write 可穩定運作；
4. Safety：Secret、SSRF、XSS 與 Session Isolation 測試通過；
5. Maintainability：核心 Package Boundary 與測試門檻成立。
