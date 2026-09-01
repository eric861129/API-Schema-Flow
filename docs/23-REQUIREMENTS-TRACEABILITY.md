# 需求追蹤矩陣

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 用途

本矩陣確保 PRD 中每個 Must Requirement 都能追溯到：

- 詳細規格；
- 預定 Package；
- 驗收或測試證據；
- MVP Milestone。

實作開始後，Issue/PR 應引用 Requirement ID。若需求刪除或降級，必須同步更新 PRD、此矩陣與 Release Scope。

## 2. 產品目標追蹤

| Goal | 規格證據 | Release 證據 |
|---|---|---|
| GOAL-001 理解流程 | UX、Domain、Inference | Usability Scenario、E2E-001 |
| GOAL-002 前端不等待後端 | Mock Runtime、CLI | CRUD Vertical Slice |
| GOAL-003 可維護 Workflow | Arazzo、Export | Round-trip/Golden Export |
| GOAL-004 推導可信 | Inference、Domain | Precision Benchmark、Review Flow |
| GOAL-005 變更影響基礎 | Domain、Diff | Field Mapping Traceability |
| GOAL-006 保護內部資訊 | Security、NFR | Redaction/SSRF/Bind Tests |

## 3. Import

| Requirement | 詳細規格 | Package | 驗收/Test ID | Milestone |
|---|---|---|---|---|
| FR-IMP-001 | 08 §3–6 | source-loader, openapi | T-IMP-001 local YAML/JSON | M1 |
| FR-IMP-002 | 08 §4；19 §4.2 | source-loader | T-SEC-SSRF-001 | M1 |
| FR-IMP-003 | 08 §5 | openapi | T-IMP-REF-001 | M1 |
| FR-IMP-004 | 07；08 §7 | openapi, domain | T-IMP-NORM-001 | M1 |
| FR-IMP-005 | 08 §8 | diagnostics | T-IMP-DIAG-001 | M1 |
| FR-IMP-006 | 13 §4 | web | E2E-IMPORT-DRAG | M3 |
| FR-IMP-007 | 08 §8 | diagnostics | T-IMP-REPAIR-001 | M1 |

## 4. Visualization

| Requirement | 詳細規格 | Package/App | 驗收/Test ID | Milestone |
|---|---|---|---|---|
| FR-VIS-001 | 13 §5 | web, ui | E2E-VIS-NODES | M3 |
| FR-VIS-002 | 06 §4.5；13 §7 | layout, web | PERF-LAYOUT-500 | M3 |
| FR-VIS-003 | 13 §6 | web | E2E-VIS-GROUP | M3 |
| FR-VIS-004 | 13 §8 | web, ui | E2E-INSPECTOR | M3 |
| FR-VIS-005 | 13 §9 | web | PERF-SEARCH-500 | M3 |
| FR-VIS-006 | 10 §5；13 §5 | web, domain | E2E-EDGE-PROVENANCE | M3 |
| FR-VIS-007 | 15 | config, web | T-PROJECT-LAYOUT | M3 |

## 5. Workflow

| Requirement | 詳細規格 | Package | 驗收/Test ID | Milestone |
|---|---|---|---|---|
| FR-WKF-001 | 09 §3–6 | arazzo | CONF-ARAZZO-VALID | M2 |
| FR-WKF-002 | 08 §9；09 §7 | openapi, domain | T-WKF-LINK-001 | M2 |
| FR-WKF-003 | 07；13 §10 | domain, web | E2E-MANUAL-EDGE | M3 |
| FR-WKF-004 | 09 §10；16 | exporter-arazzo | GOLDEN-ARAZZO-001 | M5 |
| FR-WKF-005 | 09 §5 | arazzo | RT-ARAZZO-UNKNOWN | M2 |
| FR-WKF-006 | 09 §4；12 §4 | arazzo, execution | E2E-UNSUPPORTED | M4 |
| FR-WKF-007 | 09 §8 | arazzo, web | CONF-ARAZZO-IO | M3 |

## 6. Inference

| Requirement | 詳細規格 | Package | 驗收/Test ID | Milestone |
|---|---|---|---|---|
| FR-INF-001 | 10 §6–8 | inference | BENCH-INF-MAPPING | M2 |
| FR-INF-002 | 10 §4–5 | inference, domain | SNAP-INF-EXPLAIN | M2 |
| FR-INF-003 | 10 §3 | domain, inference | T-INF-NOAUTO-001 | M2 |
| FR-INF-004 | 10 §9；13 §10 | web, domain | E2E-INF-REVIEW | M3 |
| FR-INF-005 | 10 §10 | inference | PROP-INF-DETERMINISM | M2 |
| FR-INF-006 | 10 §7 | inference | BENCH-INF-GENERIC-ID | M2 |
| FR-INF-007 | 10 §6 | inference | BENCH-INF-RULES | M2 |
| FR-INF-008 | 10 §12 | exporter-report | GOLDEN-INF-REPORT | M5 |

## 7. Stateful Mock

| Requirement | 詳細規格 | Package | 驗收/Test ID | Milestone |
|---|---|---|---|---|
| FR-MCK-001 | 11 §5–8 | mock-runtime | CONTRACT-MOCK-CRUD | M4 |
| FR-MCK-002 | 11 §6 | mock-runtime | E2E-001 | M4 |
| FR-MCK-003 | 11 §6 | mock-runtime | STATE-MOCK-LIFECYCLE | M4 |
| FR-MCK-004 | 11 §9 | mock-runtime | SEC-SESSION-ISOLATION | M4 |
| FR-MCK-005 | 11 §10 | mock-runtime | PROP-SNAPSHOT-ROUNDTRIP | M4 |
| FR-MCK-006 | 11 §11 | mock-runtime | STATE-FAULT-PROFILE | M4 |
| FR-MCK-007 | 06 §4.6–4.7 | mock-runtime | ARCH-BOUNDARY-MOCK | M0 |
| FR-MCK-008 | 11 §7 | mock-runtime | CONTRACT-MOCK-PAGE | M4 |
| FR-MCK-009 | 11 §10；19 §4.5 | config, redaction | SEC-SEED-REDACTION | M4 |

## 8. Execution

| Requirement | 詳細規格 | Package | 驗收/Test ID | Milestone |
|---|---|---|---|---|
| FR-EXE-001 | 09 §4；12 §3–7 | execution | E2E-001 | M4 |
| FR-EXE-002 | 12 §5 | execution, arazzo | CONF-RUNTIME-EXPR | M4 |
| FR-EXE-003 | 12 §8 | execution | STATE-RETRY-TIMEOUT | M4 |
| FR-EXE-004 | 12 §9 | execution | CONTRACT-TRACE-EVENT | M4 |
| FR-EXE-005 | 12 §10；19 §4.5 | execution, redaction | E2E-TRACE | M4 |
| FR-EXE-006 | 09 §4；12 §4 | execution | E2E-UNSUPPORTED | M4 |
| FR-EXE-007 | 12 §6；19 §4.2 | execution, cli | SEC-LIVE-OPTIN | M5 |
| FR-EXE-008 | 12 §11 | exporter-report | GOLDEN-RUN-REPORT | M5 |

## 9. CLI 與 Export

| Requirement | 詳細規格 | Package | 驗收/Test ID | Milestone |
|---|---|---|---|---|
| FR-CLI-001 | 14 §3–9 | cli | E2E-CLI-COMMANDS | M5 |
| FR-CLI-002 | 14 §10 | cli | GOLDEN-CLI-JSON | M5 |
| FR-CLI-003 | 14 §11 | cli | CONTRACT-EXIT-CODE | M5 |
| FR-EXP-001 | 16 §4 | exporter-arazzo | GOLDEN-ARAZZO-001 | M5 |
| FR-EXP-002 | 16 §5 | exporter-mermaid | GOLDEN-MERMAID-001 | M5 |
| FR-EXP-003 | 16 §7 | exporter-report | SEC-REPORT-REDACTION | M5 |
| FR-EXP-004 | 15；16 §6 | config | PROP-PROJECT-ROUNDTRIP | M3 |

## 10. Post-MVP Diff

| Requirement | 詳細規格 | Package | Release |
|---|---|---|---|
| FR-DIF-001 | 17 §4–7 | future `diff` | Post-MVP |
| FR-DIF-002 | 17 §8 | domain, future `impact` | Post-MVP |
| FR-DIF-003 | 17 §10 | exporter-report, cli | Post-MVP |
| FR-DIF-004 | 17 §6 | future `diff` | Post-MVP |

## 11. 非功能追蹤

| Area | Spec | 主要 Release Evidence |
|---|---|---|
| Performance | 18 §3–4 | Fixed-runner Benchmark |
| Reliability | 18 §5 | Determinism/Atomicity Tests |
| Security | 19 | Threat-control Matrix |
| Accessibility | 18 §7；13 | Keyboard E2E、Automated Audit、Manual Review |
| Maintainability | 18 §8；22 | Boundary Test、API Review |
| Portability | 18 §9 | OS/Browser Matrix |
| Observability | 18 §10；12 | Diagnostic/Trace Contract |
| Release | 21 | Release Checklist/Attestation |

## 12. 變更規則

新增 Requirement 時：

1. 在 PRD 指派唯一 ID；
2. 更新詳細 Spec；
3. 加入本矩陣；
4. 指定 Test Evidence；
5. 指定 Milestone；
6. 若改變架構，新增或更新 ADR。

Requirement 只有在「文件刪除、實作移除、測試更新、Release Note 說明」都完成後才能移除，不重複使用舊 ID。
