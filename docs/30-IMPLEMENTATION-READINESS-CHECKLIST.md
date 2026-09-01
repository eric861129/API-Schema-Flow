# 正式開工檢查表

> 狀態：Owner Review Gate  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 用途：決定是否可以建立 Implementation Plan 與開始寫程式

## 1. Gate 規則

只有 `G0–G5` 全部通過後，才進入詳細 Implementation Plan。允許部分實驗性 Spike，但必須標示 Throwaway，不可把 Spike 直接當 Production Foundation。

Check 狀態：

- `[ ]` 未審查；
- `[x]` 已接受；
- `[~]` 有條件接受，必須附限制；
- `[!]` 阻擋開工。

本文件預設保持未勾選，因為核准必須由 Project Owner 完成。

## 2. G0：產品與範圍

- [ ] 一句話定位已接受；
- [ ] 主要 Persona 與最重要 Journey 已接受；
- [ ] MVP 垂直流程為 Import→Review→Mock→Run→Trace→Export；
- [ ] Flow-aware Diff 明確屬 Post-MVP；
- [ ] Cloud、AI、PDF、Postman、Full AsyncAPI、Plugin 不屬 MVP；
- [ ] 不宣稱自動還原正確商業流程；
- [ ] Success Metrics 與 Release Gate 可衡量；
- [ ] Reservation Example 是 Canonical Vertical Slice。

**通過證據**

- `01-PRODUCT-VISION.md`
- `02-PRD.md`
- `03-MVP-SCOPE-AND-ACCEPTANCE.md`
- `05-SUCCESS-METRICS.md`
- `26-END-TO-END-EXAMPLE.md`

## 3. G1：名稱、License 與開源治理

- [ ] GitHub/npm/主要搜尋名稱檢查完成；
- [ ] Repo、CLI、npm Scope 已決定；
- [ ] License 已決定並準備加入完整文字；
- [ ] DCO/CLA 策略已決定；
- [ ] Code of Conduct 已接受；
- [ ] Security Contact 可用；
- [ ] Maintainer/Owner 權限與 Release 原則已接受；
- [ ] Fixture 來源與隱私政策已接受。

**通過證據**

- `25-OPEN-DECISIONS.md` OD-001–004
- `27-OPEN-SOURCE-GOVERNANCE.md`
- Root `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`

## 4. G2：標準與架構

- [ ] OpenAPI 版本支援聲明已接受；
- [ ] Arazzo Parse/Preserve/Execute 層級已接受；
- [ ] ADR-0001 Arazzo-first 已接受；
- [ ] ADR-0002 Normalized Domain Model 已接受；
- [ ] ADR-0003 Shared Mock Runtime 已接受；
- [ ] ADR-0004 Evidence-based Inference 已接受；
- [ ] ADR-0005 Local-first 已接受；
- [ ] Package Boundary 與 Dependency Direction 已接受；
- [ ] Fastify/MSW 角色沒有混淆；
- [ ] Config/Project/Run 格式均有 Schema Version；
- [ ] Parser 與 Runtime Validator 的 Spike 範圍清楚；
- [ ] Unsupported Feature 的失敗語意清楚。

**通過證據**

- `06-SYSTEM-ARCHITECTURE.md`
- `07-DOMAIN-MODEL.md`
- `08`–`17` Specs
- `22-REPOSITORY-STRUCTURE.md`
- `28-STANDARDS-BASELINE.md`
- `docs/adr/*`

## 5. G3：安全與隱私

- [ ] Mock 預設只綁 Loopback；
- [ ] Remote Ref/URL Policy 已接受；
- [ ] Live API 預設關閉；
- [ ] Secret Redaction 套用到 UI/CLI/Log/Export/Snapshot；
- [ ] Arbitrary Code 明確禁止；
- [ ] Session Store 無 Global Mutable State；
- [ ] Snapshot Integrity 與 Atomic Restore 已定義；
- [ ] Browser Markdown/SVG/URL Sanitization 已定義；
- [ ] Supply-chain、npm Publish 與 Package Inspection Gate 已定義；
- [ ] Security High-risk Test 清單完整；
- [ ] Telemetry 預設關閉。

**通過證據**

- `19-SECURITY-THREAT-MODEL.md`
- `18-NON-FUNCTIONAL-REQUIREMENTS.md`
- Root `SECURITY.md`

## 6. G4：驗收與品質

- [ ] 每個 Must Requirement 有 ID；
- [ ] 每個 Must Requirement 已映射至 Spec、Package、Test、Milestone；
- [ ] Reservation E2E Acceptance 可自動化；
- [ ] Inference Benchmark 有 Positive/Ambiguous/Negative；
- [ ] Adapter Parity Contract 已定義；
- [ ] Determinism、Cancellation、Atomicity 有測試；
- [ ] Accessibility Keyboard Journey 已定義；
- [ ] Performance Budget 與測試環境已定義；
- [ ] OS/Browser Compatibility Gate 已定義；
- [ ] Release Evidence 列表完整。

**通過證據**

- `03-MVP-SCOPE-AND-ACCEPTANCE.md`
- `18-NON-FUNCTIONAL-REQUIREMENTS.md`
- `20-TEST-STRATEGY.md`
- `23-REQUIREMENTS-TRACEABILITY.md`

## 7. G5：發布與溝通

- [ ] README 沒有把 Roadmap 功能寫成已完成；
- [ ] README 英文與繁中定位一致；
- [ ] Roadmap 以 Exit Criteria 管理；
- [ ] SemVer、Dist-tag、Schema Migration 已接受；
- [ ] Hero Demo 可由 Canonical Example 真實重現；
- [ ] Playground 不保存使用者資料；
- [ ] Known Limitations 與 Support Matrix 有固定位置；
- [ ] Issue/PR Template 已準備；
- [ ] Changelog 格式已準備；
- [ ] 發布成功指標不只看 Star。

**通過證據**

- Root README/ROADMAP/CHANGELOG
- `21-RELEASE-AND-VERSIONING.md`
- `29-DEMO-AND-LAUNCH-PLAN.md`
- `.github/`

## 8. Owner 必須逐項確認的決策

將下列結果記入 `25-OPEN-DECISIONS.md`：

```text
Project/Repo name:
CLI binary:
npm scope:
License:
Contribution agreement:
OpenAPI support:
Arazzo execution profile:
Parser adapter:
Runtime validator spike:
Fixed/independent versions:
Inference thresholds:
Mock CRUD boundary:
State persistence:
Fastify/MSW priority:
Live execution in MVP:
MVP exporters:
Demo hosting:
```

## 9. 允許的技術 Spike

在正式 Implementation Plan 前，只允許下列短期、可丟棄 Spike：

1. Parser Comparison  
   驗證 OpenAPI 3.0/3.1/3.2、Source Pointer、External Ref、Browser Bundle 與安全限制。

2. Runtime Validator Comparison  
   驗證 Recursive Schema、JSON Schema Export、Error Mapping、Bundle Size。

3. React Flow + ELK Large Graph  
   500/2,000 Nodes 的 Layout、Interaction、Worker 與 Accessibility Outline。

4. Shared Mock Runtime Adapter  
   同一 Contract 以 Fastify/MSW 各跑 CRUD Session，確認介面足夠。

5. Arazzo Runtime Expression  
   對 Canonical Example 驗證 Parse、Resolve、Unsupported Diagnostics。

Spike Output 是比較報告與 ADR 輸入，不是未經測試的正式程式碼。

## 10. 正式開工的第一份 Implementation Plan 範圍

文件全數通過後，第一份計畫只涵蓋 **M0 Foundation + M1-A OpenAPI Core Slice**（M1 的前半段）：

- 建立 Monorepo；
- 建立 Domain/Diagnostics/Redaction；
- 完成 Config Skeleton；
- 選定 Parser/Validator；
- 匯入 Reservation OpenAPI；
- 產生 Normalized Operations；
- CLI `validate`；
- Fixture/Golden Tests；
- 不先做完整 Canvas、Mock 或 Executor。

完成 M1-A 並 Review 後，先為 M1-B Remote Loading／完整 Fixtures 寫下一份計畫；M1 完整通過後才進入 M2。避免一份計畫橫跨整個產品而無法驗證。

## 11. Owner Sign-off

```text
Project Owner:
Review date:
Decision: Approved / Approved with constraints / Changes requested
Accepted ADRs:
Constraints:
Next document: M0–M1-A Implementation Plan
```

Owner 填寫並接受後，將本文件狀態改為 `Approved`，再開始寫詳細實作計畫。
