# M3-B1 互動審查驗證紀錄

日期：2026-09-16。狀態：開發分支本機驗證完成；尚未推送、合併或完成最終提交的遠端 CI。

## 版本與範圍

| 項目 | 版本／界線 |
|---|---|
| 分支 | `codex/m3b1-review-actions` |
| M3-A 已進入 main 的基準 | `893a757217118249f524cf540c12db5df3c765a5` |
| main 的 M3-B1 foundation | `9ae782a33fa24d9919cf4f5920a1977327cfda6e` |
| 審查操作與草稿拓樸 | `14842a75973e608e0a0f7940b9e0742759608b0e` |
| 瀏覽器驗收與介面修正 | `100b16d` |
| Windows 驗證相容修正 | `d93c406d50010c9d13363e4fa7eaeccddf57ad7f` |
| 本報告的提交 | 在該 checkout 執行 `git log -1 --format=%H -- docs/reports/m3b1-review-session-verification.md` 取得；同筆提交加入中英文說明與 README 旅程回歸測試 |
| 遠端 PR #16 | 仍為 `26c73466fb940c8e7fd05f456f7f0f042cbb7a52`；既有成功 CI 不涵蓋上述本機變更 |

操作入口與限制以 [英文 README](../../README.md#try-the-browser-review-workspace)、[繁中 README](../../README.zh-TW.md#操作瀏覽器審查工作區) 為準。本階段只提供記憶體內 Accept／Reject／Undo 與草稿拓樸，不修改來源快照或 CLI 決策檔。重新整理會清除草稿。

未納入：M3-B2 Mapping Editor、M3-B3 IndexedDB／Decision Set 匯入匯出、任意規格匯入、Workflow Builder、Mock、執行、Live Trace。既有 CLI Arazzo 匯出能力不等於 Web 提供匯出。

## 環境與依賴

- Windows、Node.js `24.15.0`、本機 pnpm `11.19.0`；packageManager／CI 指定 `11.24.0`，本機版本符合 engines 的 `>=11 <12`，但未宣稱與遠端環境完全相同。
- Frozen lockfile 安裝成功，未修改依賴版本或 lockfile。
- React／React DOM `19.2.8`、React Flow `12.11.6`、ELK `0.12.0`、Vite `8.2.2`、Vitest `4.1.11`、Playwright `1.62.1`、axe Playwright `4.13.0`。
- 瀏覽器測試使用 production build，網址 `http://127.0.0.1:4173`；不重用既有 server，避免測到其他 worktree 的版本。

## 檢查結果

下列為修正後的本機結果，exit code 均為 `0`。根目錄 `pnpm test` 曾因 Windows symlink 權限與短路徑預期失敗；改用 junction 並比對 canonical realpath 後，已由完整 `pnpm ci:verify` 重跑成功。沒有跳過該安全測試。

| 命令 | 驗證結果 |
|---|---|
| `pnpm install --frozen-lockfile` | 安裝成功，lockfile 不變 |
| `pnpm workspace:check` | 工作區結構通過 |
| `pnpm format:check` | 完整格式通過；LF 規則排除 Windows 換行差異 |
| `pnpm lint` | 完整 lint 通過 |
| `pnpm build` | 全套件建置通過 |
| `pnpm typecheck` | 全套件型別檢查通過 |
| `pnpm test` | 363 個測試通過，含 Web 82 個、source-loader 27 個 |
| `pnpm test:integration` | 110 個測試通過；其中 82 個是 Web 套件重用單元測試，不應重複計為獨立案例 |
| `pnpm test:flow-fixtures` | 宣告流程 fixtures 通過 |
| `pnpm test:inference-benchmark` | 推導品質門檻通過 |
| `pnpm test:inference-performance` | 500 operations 效能門檻通過 |
| `pnpm test:review` | Review 語意測試通過 |
| `pnpm test:export-arazzo` | 匯出單元與整合測試通過 |
| `pnpm test:review-export-fixtures` | 審查／匯出 fixtures 通過 |
| `pnpm check:web-fixture` | 兩次生成結果一致，且與版本控制的 Snapshot 1.1 相同 |
| `pnpm check:review-browser-bundle` | 無禁止的瀏覽器依賴 |
| `pnpm build:web` | production build 通過 |
| `pnpm check:web-bundle` | 無 Node-only／parser／CLI 等禁止標記 |
| `pnpm test:web` | 22 檔、82 個測試通過 |
| `pnpm test:web:e2e` | 18 個案例通過，涵蓋 Chromium 兩種尺寸的審查、既有工作區與內建快照 README 旅程 |
| `pnpm boundaries:check` | 套件邊界通過；八種禁止 Web Review 引用注入亦均被拒絕 |
| `pnpm ci:verify` | 完整本機 CI 聚合命令通過；部分 Turbo 任務使用內容雜湊快取 |
| `node packages/cli/bin/schema-flow.mjs validate examples/reservation/openapi.yaml --json` | CLI smoke test 通過 |
| `git diff --check` | 無空白錯誤 |

`.gitattributes` 將文字檔 checkout 固定為 LF。既有文字檔只正規化換行；Git 內容差異未增加數百筆格式變更。來源載入器的 Windows 測試使用指向允許目錄外的 junction，仍要求 `ASF-SRC-1004`；其他平台保留檔案 symlink 路徑。

## 瀏覽器與畫面證據

Chromium 尺寸：1440 × 900、1366 × 768。驗證包括：

- 頁面標題、網址、非空畫面、無框架錯誤畫面，以及審查流程無 browser console warning／error 或未捕捉例外。
- Accept 後真正的 React Flow 連線增加；Reject 不新增連線；Undo 還原狀態、選取與連線；重新整理清除草稿。
- 純鍵盤進入 Review、選取候選、捲動映射、切換證據、Reject、Undo 與拓樸；對話框限制焦點並在關閉後還原。
- 拒絕必須有結構化原因，Other 必須有非空白說明。
- 候選／映射／摘要、證據、Reject 對話框、驗證錯誤、接受後拓樸共五種狀態，均無 axe serious／critical 違規。
- 面板不重疊、主要按鈕完整可見且沒有遮擋、拓樸畫布有可用高度。
- README 旅程直接使用內建快照，驗證既有 accepted login 候選的 Reject → Accept → Undo；其他審查 E2E 只在 HTTP 回應移除 baseline decisions，產生待審核場景，沒有修改正式 fixture。
- 未提供 Edit Mapping、Save decisions、Import／Export Decision Set、Run Workflow、Start Mock、Export Arazzo 控制項。

截圖名稱為 `review-candidate.png`、`review-evidence.png`、`review-reject.png`、`review-topology-preview.png`，各尺寸一組。Playwright 預設輸出到 `apps/web/test-results/`，本機可用 `PLAYWRIGHT_OUTPUT_DIR` 指向外部資料夾；每張圖也加入 test attachment。CI 設定上傳 `browser-verification-<SHA>` artifact，保留 14 天，尚待實際遠端執行。

已檢視四種狀態與兩種尺寸截圖；採穩定 fixture、停用動畫、幾何斷言與視覺檢視，尚未建立跨平台像素差異基準。未驗證行動版、Firefox／WebKit 或真人螢幕閱讀器。

## 品質與效能門檻

- 推導品質：high-confidence precision ≥ 0.85、recall = 1、7 個標記正例全部命中、generic-ID 高信心誤判與 declared duplicates 均為 0。
- 500 operations 推導少於 5,000 ms、候選配對不超過 50,000、產生 250 個高信心候選。
- 1,000 candidates 篩選排序的五次執行最大值 < 100 ms。
- 1,000 candidates／500 nodes 的三次 materialization 最大值 < 250 ms。

以上是測試斷言通過的界線，不是另行量測的平均值或 p95；未聲稱完成完整產品的所有 NFR。

| Web build 產物 | 原始 bytes | gzip bytes |
|---|---:|---:|
| `index-C8W2Mydn.js` | 481373 | 148149 |
| `dist-D_Hrlj2n.js` | 1433973 | 437772 |
| `index-BZWkzWRs.css` | 42696 | 8778 |

Vite 仍提示大型 layout chunk 超過 500 kB；建置與依賴邊界通過，這不代表已完成 bundle 體積最佳化。

## 尚待完成的交付層級

推送本機提交後，必須以新的遠端 SHA 執行 CI 並核對成功結果，才能更新遠端驗證狀態與合併。本機通過不代表 PR #16 已更新、main 已包含這些變更，或已有 npm／網站發布。M3-B2／M3-B3 不在本次驗證範圍。
