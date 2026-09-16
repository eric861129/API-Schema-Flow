# M3-B1 實作畫面

此頁是現行整合計畫要求的畫面入口；驗證結果統一維護於[驗證紀錄](../../../reports/m3b1-review-session-verification.md)，不另建交付報告。

唯一影像來源為 [Playwright 基準目錄](../../../../apps/web/e2e/review-visual.spec.ts-snapshots/)，避免文件副本與測試基準分歧。每個平台保存四種狀態、兩種尺寸（1440 × 900、1366 × 768），共十六張 PNG。`linux` 來自 Ubuntu 24.04 的 [CI 35050353922](https://github.com/eric861129/API-Schema-Flow/actions/runs/35050353922)；`win32` 由本機 Chromium 產生，兩者分開比對以容許平台字型差異。

| 狀態 | 1440 × 900 | 1366 × 768 |
|---|---|---|
| 候選與映射 | [畫面](../../../../apps/web/e2e/review-visual.spec.ts-snapshots/review-candidate-chromium-1440-linux.png) | [畫面](../../../../apps/web/e2e/review-visual.spec.ts-snapshots/review-candidate-chromium-1366-linux.png) |
| 證據 | [畫面](../../../../apps/web/e2e/review-visual.spec.ts-snapshots/review-evidence-chromium-1440-linux.png) | [畫面](../../../../apps/web/e2e/review-visual.spec.ts-snapshots/review-evidence-chromium-1366-linux.png) |
| 拒絕原因對話框 | [畫面](../../../../apps/web/e2e/review-visual.spec.ts-snapshots/review-reject-chromium-1440-linux.png) | [畫面](../../../../apps/web/e2e/review-visual.spec.ts-snapshots/review-reject-chromium-1366-linux.png) |
| 接受後草稿拓樸 | [畫面](../../../../apps/web/e2e/review-visual.spec.ts-snapshots/review-topology-preview-chromium-1440-linux.png) | [畫面](../../../../apps/web/e2e/review-visual.spec.ts-snapshots/review-topology-preview-chromium-1366-linux.png) |

候選、映射與證據區可獨立捲動。Accept／Reject／Undo 保持可見；鍵盤可選取候選、捲動映射、切換證據及拓樸。Reject 對話框限制焦點並在關閉後還原；狀態與來源都有文字標示。五種典型狀態另外執行 axe serious／critical 檢查。

正常執行 `pnpm test:web:e2e` 會比對基準。只有刻意修改畫面並檢視差異後，才使用 Playwright `--update-snapshots` 更新對應平台 PNG；更新基準不等於通過回歸驗證，仍須再次以正常模式執行。
