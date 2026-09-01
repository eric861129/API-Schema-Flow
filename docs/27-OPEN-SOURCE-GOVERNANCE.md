# 開源治理與維護規範

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow 開源專案

## 1. 治理目標

- 保持產品方向清楚，不因 Star 或 Feature Request 變成無邊界 API Platform；
- 讓重要架構、安全與標準決策可追溯；
- 讓貢獻者知道如何提案、實作、審查與成為 Maintainer；
- 保護使用者規格、憑證與供應鏈；
- 在 Maintainer 人數有限時仍誠實描述審查與 Bus Factor；
- 避免單一 Vendor、Hosted Service 或商業 Roadmap 綁架開源核心。

## 2. License 與貢獻權利

建議採 Apache-2.0。Repository 初始化時必須加入完整 License Text；本 Markdown 文件不是 License 的替代品。

貢獻採 Developer Certificate of Origin：

```text
Signed-off-by: Contributor Name <email@example.com>
```

貢獻者表示有權提交內容並依專案 License 授權。初期不要求 CLA；若未來需要雙授權或商業實體變更，必須公開提案且不得追溯性改變既有貢獻授權。

## 3. 角色

### User

使用專案、回報問題與提出需求。

### Contributor

已合併至少一個有效貢獻，可為程式、文件、Fixture、翻譯、設計或測試。

### Reviewer

在特定領域有穩定貢獻，可進行非約束性技術審查。Reviewer 不等於有 Release 權限。

### Maintainer

- Triage Issue/PR；
- 接受 ADR/Spec；
- 合併變更；
- 維護 Roadmap；
- 管理 Package；
- 回應安全事件；
- 執行 Release。

### Lead Maintainer / Project Owner

在無共識時依產品原則做最終決定，並負責公開理由。初期由創始人擔任；角色移交需記錄。

## 4. 決策層級

| 層級 | 例 | 流程 |
|---|---|---|
| Routine | Bug、文件、Fixture | PR Review |
| Product | MVP Scope、CLI UX | 更新 PRD/Spec + PR |
| Architecture | Domain Boundary、Adapter、Format | ADR + Spec + Review |
| Security | Live Execution、Plugin、Secret | Threat Model + ADR + Security Review |
| Governance | License、Maintainer、商標 | 公開提案 + 延長 Review |
| Breaking | Public API/Format | ADR/Spec + Migration + Release Note |

共識優先，但共識不是無限等待。Owner 可做決定，必須記錄 Alternatives 與理由。

## 5. Proposal 流程

大型功能使用以下順序：

1. Discussion/Issue 描述痛點，不先鎖實作；
2. 確認是否符合 Product Vision 與 Non-goals；
3. 需要時更新 Product Spec；
4. 架構改變建立 ADR；
5. 安全敏感功能更新 Threat Model；
6. Owner 接受設計；
7. 寫 Implementation Plan；
8. 拆 Issue；
9. 依 Test/Docs Gate 合併。

小型 Bug 不需完整 Proposal，但不能藉此繞過 Public Contract 或安全決策。

## 6. Issue Triage

建議 Labels：

```text
type:bug
type:feature
type:docs
type:security
type:inference-quality
type:standards
area:openapi
area:arazzo
area:mock
area:execution
area:web
area:cli
status:needs-reproduction
status:needs-design
status:ready
status:blocked
good-first-issue
help-wanted
breaking
```

Severity：

- `critical`：RCE、Secret Leakage、Data Corruption、供應鏈；
- `high`：SSRF、Session Cross-talk、核心流程不可用；
- `medium`：有 Workaround 的錯誤或明顯相容性問題；
- `low`：文案、外觀、小幅改善。

Security Issue 不在公開 Tracker 揭露利用細節，依 `SECURITY.md` 處理。

## 7. Roadmap 管理

Roadmap 以 Outcome 與 Exit Criteria 為單位，不以日期承諾。接受新功能前回答：

1. 是否改善 Import→Review→Mock→Run→Export？
2. 是否強化可信度、安全、標準或可重現性？
3. 是否可由現有 Maintainer 長期維護？
4. 是否把工具推向 Postman/API Gateway/Cloud Platform？
5. 是否需要新 Threat Model 或 Format Migration？

Star 數、社群投票與單一企業需求可作為訊號，不直接取代產品判斷。

## 8. Maintainer 晉升

候選人應持續展現：

- 尊重 Code of Conduct；
- 理解 Product Vision 與 Non-goals；
- 能撰寫測試與文件；
- 對 Review 意見具技術判斷，而非只追求快速合併；
- 在至少一個領域有多次高品質貢獻；
- 能處理安全與相容性責任。

任命由現有 Maintainer 公開記錄。Release/npm/安全權限採最小權限，不因稱號自動全部授予。

## 9. Maintainer 休眠與移除

- 長期無活動不視為過錯；
- 權限可因安全最小化而暫停；
- 違反 Code of Conduct、供應鏈政策或濫用權限可移除；
- 移除決策應由未涉入衝突者審查；若只有一位 Maintainer，尋求可信第三方；
- 離任時完成 Token、npm、GitHub、Domain 與 Security Contact 移交。

## 10. Release 權限

- npm Publish 不使用長期個人 Token；
- 使用 GitHub OIDC/Trusted Publishing 或同等機制；
- Protected Environment；
- 至少一個非發布工作流的測試證據；
- Release Commit 與 Tag Immutable；
- Provenance/Attestation；
- Package Scope 開啟 2FA；
- Emergency Recovery Account 離線保管。

## 11. 商業與 Vendor 中立

允許：

- 個人或公司贊助；
- 顧問、Hosted Service 或企業功能；
- Vendor 提供資源與工程師。

但必須：

- 不把核心檔案格式鎖到單一 Hosted Service；
- 不讓 Telemetry 成為使用核心能力的條件；
- 不把安全修補只留給付費版本；
- 公開利益衝突；
- 商標與 Project Name 的使用規則一致；
- Open-source Roadmap 的決策理由可公開。

## 12. Fixture 與隱私治理

提交 API Fixture 前必須確認：

- 完全 Synthetic，或有明確公開授權；
- 無 Token、Cookie、Email、電話、真實人名、內網 Host；
- 不洩漏企業 Path、Schema 與錯誤碼；
- 附 Source/License Metadata；
- 可離線測試；
- 可被 Redaction Test 使用但不包含真 Secret。

Inference Quality Report 預設匿名化；使用者主動提交時仍由 Maintainer 二次檢查。

## 13. Code of Conduct

所有互動受 `CODE_OF_CONDUCT.md` 約束，包括：

- Issue/PR；
- Discussion；
- Chat/Forum；
- Event；
- 私下代表專案的溝通。

技術爭議應討論 Evidence、Trade-off 與 Product Principle，不攻擊個人能力或動機。

## 14. 專案封存

若維護能力不足：

1. 公開說明狀態；
2. 停止宣稱 Active Support；
3. 處理或揭露已知安全風險；
4. 將 npm Package 標示 Deprecated；
5. 保留 Source、License、Release 與 Docs；
6. 尋找可信接手者，但不在未審查下移交 Package/Domain；
7. 不刪除歷史以掩蓋維護中止。
