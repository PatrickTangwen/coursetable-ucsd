# WebReg Course Planner 对 SunGrid TSS 采集的适用性评估

日期：2026-07-21

评估对象：[`SahirSSharma/WebReg-Course-Planner`](https://github.com/SahirSSharma/WebReg-Course-Planner)

上游默认分支快照：[`876f23c`](https://github.com/SahirSSharma/WebReg-Course-Planner/commit/876f23c4a5ec85aa2c4b1fd3332865a73bc2b6ac)

上游 direct-pull staging 快照：[`6d555e2`](https://github.com/SahirSSharma/WebReg-Course-Planner/commit/6d555e2e0f025b124b96e4e5fc08f3d82208caaf)
SunGrid 基线：本工作树中的 issue #169 commit `484847e`；产品和隐私约束来自 [parent issue #168](https://github.com/PatrickTangwen/coursetable-ucsd/issues/168)。

## 结论

**可以从它上手，但只能把它当作已经验证过的 TSS endpoint/data-model recon；不能把 scraper 原样接入 SunGrid。**

- 它不是把旧 WebReg HTML 冒充 FA26。仓库中的 `scraper/soc_scraper.py` 才是 legacy public Schedule of Classes 路径；FA26 路径确实指向登录后的 TSS SAP OData v4 `yucsd_con_module` service。上游 README 也明确区分 legacy public source 和 TSS source，[当前 TSS 说明及 endpoint discovery](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/876f23c4a5ec85aa2c4b1fd3332865a73bc2b6ac/README.md#L21-L40) 与 UCSD 对 Fall 2026 使用 TSS 的[官方说明](https://esr.ucsd.edu/projects/student/ecosystem/core-sis.html)相符。
- 真正方便复用的是 staging 分支新增的 [`tss/fetch_soc.py`](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L1-L99)：人工 SSO/Duo 后，以 `SAP_SESSIONID` cookies 对 `YUCSD_CON_MODULE` 和 `YUCSD_CON_EVENTS` 做 GET，并用 `$top/$skip` 拉取数据。该文件截至评估时**尚未进入默认 `main`**；默认分支的 [`tss/` tree](https://github.com/SahirSSharma/WebReg-Course-Planner/tree/876f23c4a5ec85aa2c4b1fd3332865a73bc2b6ac/tss)没有 `fetch_soc.py`。
- 上游 OData rows 比 SunGrid 现有 `tss-schedule-v1` 暴露得更丰富，尤其是 credits、module identity、event/package identity、status、date range、delivery mode、package capacity/seats/waitlist。其[已保存的 service metadata](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/con_module_metadata.xml#L1)也公开了结构化 `_schedule`、`_sections`、`_modality` navigation。
- 但原脚本会导出 cookie JSON、把 broad OData responses 或整套未 `$select` 的 entity rows 写盘、关闭 TLS certificate/hostname validation、假定 term scope、缺少可信 source freshness 和严格完整性证明。这些行为直接违反 [#168](https://github.com/PatrickTangwen/coursetable-ucsd/issues/168) 的隐私、访问、完整性和 freshness gates。
- 上游 importer 还会把 SAP package 拓扑重新编号为 A/B、A01/A50，并跨 package 按 EventID 去重；它适合重建 WebReg 视觉模型，却不能作为“完全对应 TSS Schedule”的权威 adapter。[`import_fa26.py` 的 grouping/dedup/renumbering](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L142-L246)会丢失真实 booking choice 与 shared component 的对应关系。

因此建议：**采用它发现的 OData v4 seam，重写 capture/sanitizer；在 #169 合并前修订 `tss-schedule-v1`，让 package 成为一等对象，并扩展 Published Snapshot/frontend 中确实需要的 TSS Schedule 字段。**

## 已确认、推断和未知

### 已确认

1. **认证状态必需。** `connect.py` 通过 headed Playwright 等待人工 UCSD SSO/Duo，并以 `SAP_SESSIONID` 判断登录成功；direct fetch 在 cookie header 中找不到该 cookie 就拒绝运行。见 [`connect.py`](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/connect.py#L137-L168)和 [`fetch_soc.py`](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L41-L72)。
2. **数据来自真实 TSS Schedule service，而不是 DOM。** direct path 对 `/sap/opu/odata4/sap/yucsd_con_module_sb/srvd/sap/yucsd_con_module_servicedef/0001/` 下两个 entity sets 发 GET，不解析页面。见 [`fetch_soc.py`](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L23-L64)。
3. **服务 metadata 把 module 和 events 声明为不可 insert/delete/update。** 这支持其语义上只读，但不能替代账户持有人对用途的授权。见上游[捕获的 `$metadata`](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/con_module_metadata.xml#L1)。
4. **默认分支的 committed FA26 parsed corpus 是 153 个 subject files、1,766 Courses、8,061 WebReg-style section rows；staging commit `6d555e2` 是 153、1,773、8,111。** 这些是对相应 commit 的 [`data/parsed/FA26`](https://github.com/SahirSSharma/WebReg-Course-Planner/tree/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/data/parsed/FA26)做机械计数的结果。README 同时声称一次 raw dump 有 1,768 courses 和 8,431 section-events，[其口径不同且 raw dump 未提交](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/876f23c4a5ec85aa2c4b1fd3332865a73bc2b6ac/README.md#L25-L40)，所以 README 数字不能当作 SunGrid coverage manifest。
5. **MIT 可复用代码。** 软件允许 use/modify/merge/publish，但复制 substantial portions 时要保留 copyright 和 permission notice，且按 “AS IS” 提供。见[上游 LICENSE](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/876f23c4a5ec85aa2c4b1fd3332865a73bc2b6ac/LICENSE#L1-L20)。

### 推断

1. `YUCSD_CON_MODULE` + `YUCSD_CON_EVENTS` 很可能足以建立大多数 TSS Schedule card/package/meeting/availability 信息，因为 metadata 暴露 module→sections/schedule/modality 关系，而 event rows 包含 package identity、status、`Sched`、capacity、seats 和 waitlist。不过“足以完全复现 UI”仍需真实 TSS 样本逐项验收。
2. `EventPkgObjid` 应成为 SunGrid section/booking-choice 的稳定 source ID，`EventID` 应成为 component/meeting source ID；同一个 EventID 在多个 package 中出现时，应保留每个 package 的引用，而不是全局去重。
3. 以完整 entity-set pull 代替逐 subject 搜索可显著减少请求数，但只有在 term filter、server-declared pagination/count、稳定排序以及所有 configured subjects 的空/非空证明成立后，才能宣称 complete。

### 未知，必须在真实 attended session 中验证

- 当前 TSS UI 实际发送的精确 `$filter/$select/$expand/$orderby` 和分页 continuation contract。
- service 是否提供可依赖的 `@odata.nextLink`、`@odata.count` 或另外的 source-declared total。
- TSS Schedule 展示的 authoritative `source_updated_at` 位于哪个 endpoint/field。`EffectiveDate`、event BeginDate 或本地 capture date 都不能替代它。
- `EventPkgText`、`EventPkgDisplayID`、`EventKey`、`EventAbbr` 对用户可见 section code 的精确映射，以及 package 中 component 的 required/optional 语义。
- arranged/TBA、cancelled、midterm/final、多地点、多 instructor、cross-list、variable-unit、effectively-unbounded sentinel 的全部实际枚举和值域。
- UCSD 是否明确授权将这个 authenticated Schedule endpoint 用于周期采集和公开再发布。UCSD 的 AUP 要求只访问明确授权的资源和用途、不得绕过 access process、不得消耗不成比例资源、不得在无权时复制 University data；能登录或 endpoint 可读并不自动回答该授权问题。见 [UCSD PPM 135-9](https://adminrecords.ucsd.edu/ppm/docs/135-9.html)。

## 请求与行为对照

| 维度             | 上游当前行为                                                                                                                                                                                                                                                                                                                                                                                                  | SunGrid 结论                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 登录             | 人工 SSO/Duo；导出 `storage_state` 到 `tss/state.json`，随后脚本拼 Cookie header。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/connect.py#L130-L185)                                                                                                                                                                                      | 保留人工登录；不得导出可移植 cookie JSON。认证状态只能留在 dedicated local browser profile/session boundary。                                    |
| Source           | legacy scraper 是 public HTML；FA26 direct path 是 TSS OData v4。[legacy source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/876f23c4a5ec85aa2c4b1fd3332865a73bc2b6ac/scraper/soc_scraper.py#L1-L31) [TSS source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L1-L30)                                                 | FA26 只借鉴 TSS path；不要接入 legacy HTML parser。                                                                                              |
| Method           | direct pull 仅 GET；metadata 声明 entity sets 不可 mutate。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/con_module_metadata.xml#L1)                                                                                                                                                                                                       | 可作为 read-only allowlist 基础；只允许 live discovery 后确认的 exact URLs/query shapes。                                                        |
| 请求范围         | 两个完整 entity sets；`sap-client=500&$top=5000&$skip=N`，没有 `$select`、term filter 或 stable `$orderby`。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L23-L64)                                                                                                                                                            | 必须最小化为显式 `$select` allowlist，显式 term，优先 source-declared continuation，并串行请求。                                                 |
| Term             | importer 和输出目录硬编码 FA26；request 本身未传 term。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L31-L34) [request](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L54-L64)                                                                       | 不可接受。metadata 甚至声明 `AcademicPeriodText`/`AcYearText` 是 required filters；必须使用 UI 实际 query contract，并验证每一行 term identity。 |
| Pagination       | 当一页 `< 5000` 即认为结束；只有 module count ≥500 sanity floor。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L31-L32) [source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L54-L94)                                                                | 不证明完整性。要核对 count/continuation、重复 key、stable ordering、跨页 gap 和 event→module/package referential integrity。                     |
| 错误/限流        | direct pull 第一次异常即退出，不 aggressive retry；没有显式 401/403/429/CAPTCHA 分类。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L67-L90)                                                                                                                                                                                  | 保留 fail-fast，并明确把 401/403/429、restriction、CAPTCHA、prohibition 转为 access stop。                                                       |
| TLS              | `check_hostname=False` 且 `CERT_NONE`。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L34-L38)                                                                                                                                                                                                                                 | 必须删除；否则 session cookie 和 catalog integrity 都可能被中间人攻击。                                                                          |
| Persistence      | broad capture 把所有匹配 `/sap/opu/odata/` 的 JSON/XML body 写入 `data/tss_raw/`；direct pull 把完整 rows 写到 `data/tss_fa26/`。[capture](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/connect.py#L20-L23) [writes](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L74-L94) | 与 #168 冲突。response body 只能在内存逐 record allowlist 重建；只有 sanitized artifact 可落盘。                                                 |
| Anti-bot/evasion | headed human login；没有 MFA/CAPTCHA bypass、proxy/IP/account rotation；使用 browser-like UA。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/connect.py#L170-L188) [source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/fetch_soc.py#L34-L50)                                   | 不引入任何 evasion。请求预算、串行分页和 terminal stops 仍必须显式实现。                                                                         |

## 字段与语义对照

SunGrid 当前 source contract 见 [`tssSchedule.ts`](../../../tools/catalog-snapshot/tssSchedule.ts#L25-L141)，Published Snapshot 见 [`catalogSnapshot.ts`](../../../tools/catalog-snapshot/catalogSnapshot.ts#L77-L164)。

| Schedule 语义                        | 上游 TSS source / importer                                                                                                                                                                                                                                                                                                                                                                                          | 当前 `tss-schedule-v1` / Snapshot                                                                                                                                                 | 结论与改动                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Term                                 | module: `AcademicYear`, `AcademicPeriod`; event: `AcYear`, `AcPeriod`; importer硬编码 FA26。[metadata](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/con_module_metadata.xml#L1)                                                                                                                                                                          | artifact 只有 `term`。                                                                                                                                                            | 增加并校验 `source_academic_year/source_academic_period`；所有 rows 必须一致并映射到 `term`。                                                                             |
| Subject/course identity              | `ModuleID`, `DepartmentAbbr`, `CourseAbbr`。[`import_fa26.py`](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L63-L75)                                                                                                                                                                                                                      | `course_code`, `tss_course_code`；无 module ID。                                                                                                                                  | 保留 `module_id` 作为 source identity；由 `CourseAbbr` 生成 canonical subject/number，拒绝重复/unsafe ID。                                                                |
| Title                                | `CourseTitle`。                                                                                                                                                                                                                                                                                                                                                                                                     | `course_title`。                                                                                                                                                                  | 可直接映射。                                                                                                                                                              |
| Credits/units                        | `CreditsDisplay`, min/max, increment；importer发布 `CreditsDisplay`。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L155-L162)                                                                                                                                                                                                     | v1 无 units；adapter 当前把 Snapshot `units` 设为 `null`。[local source](../../../tools/catalog-snapshot/tssSchedule.ts#L509-L536)                                                | v1 增加 source-declared units shape；Snapshot 显示应与 TSS 一致，同时保留 General Catalog enrichment precedence 的明确规则。                                              |
| Description/restriction/material fee | module metadata 有 Description、DeptApprovalReq、MaterialsFee、AcademicLevel 等；upstream importer只压缩为一个 `restriction` 字符。[metadata](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/con_module_metadata.xml#L1)                                                                                                                                   | v1 无这些字段；Snapshot 可承载 description/restrictions。                                                                                                                         | 仅加入 TSS Schedule 实际展示且产品需要的字段；不要为“全面”把所有 module fields 纳入 allowlist。                                                                           |
| Booking package                      | `EventPkgObjid`, `EventPkgDisplayID`, `EventPkgText`；同一 package 有多 event rows。[metadata](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/con_module_metadata.xml#L1)                                                                                                                                                                                  | `booking_choices` 已有 displayed package ID/section，但 enrollment 放在 component。                                                                                               | package 应是一等对象；package ID 生成 Snapshot `section_id`，display ID/text 分开保留。                                                                                   |
| Package/component topology           | upstream 先按 `EventKey` 分 A/B，再跨 package 按 EventID 去重并自行编号 A01/A50。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L164-L236)                                                                                                                                                                                         | booking choice 内有 components，结构更接近 TSS。                                                                                                                                  | **不要采用 upstream importer。** 按 package key 分组，在每个 package 内保留其全部 event components；shared event 可在多个 choices 中引用。                                |
| Component identity/type              | `EventID`, `EventObjid`, `EventAbbr`, `EventKey`, `TeachingMethod/Text`。                                                                                                                                                                                                                                                                                                                                           | `event_id`, `section_code`, `type`, `requirement`。                                                                                                                               | 显式映射 source IDs/type；`requirement` 的真实来源未知，未确认前不得猜 required/optional。                                                                                |
| Component dates/status               | `BeginDate`, `EndDate`, `Status`, `StatusSemantic`。                                                                                                                                                                                                                                                                                                                                                                | component 无 date range/status；Snapshot section 无 cancelled/status。                                                                                                            | v1 增加 allowlisted source status/date range；enum drift fail。若 SunGrid 要“完全对应”，Snapshot/frontend 也要承载 cancelled/disabled，而非只在 capture artifact 中保存。 |
| Meetings                             | event `Sched` 是最长 200 字符的 display string；module `_schedule` 有 structured DoW/BeginTime/EndTime/Duration/SectionId。[metadata](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/con_module_metadata.xml#L1)                                                                                                                                           | v1 有 kind/date/days/time/location/instructor/TBA/arranged；Snapshot 足以显示常规 meeting/exam。                                                                                  | 优先捕获 UI 使用的 structured navigation；display string 只可作为 approved display field/audit comparison，不能成为唯一 parser seam。                                     |
| Location/modality                    | `Sched`, `LocationText`, module `_location/_building/_modality`；upstream 用 regex 解析 display string，并手工修复截断 building。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L39-L56) [source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L98-L135) | v1 只有 `location_displayed`；adapter 用第一个空格拆 building/room。[local source](../../../tools/catalog-snapshot/tssSchedule.ts#L348-L394)                                      | 增加 structured location/modality fields；不要用 building-name repair table 或首空格 heuristic 当权威映射。                                                               |
| Exam                                 | upstream 从 `Sched` 的 `Final Exam...` 行提 date/time，但丢 final location/instructor。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L104-L135) [source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L238-L245)                                        | v1/Snapshot 支持 dated exam meeting。                                                                                                                                             | 保留现有模型，但必须从真实 response 验证 exam 的 structured source 或完整 display semantics。                                                                             |
| Instructor                           | event 有 `InstructorName` **以及不应发布的 `InstructorEmail`**；另有 InstructorID navigation。[metadata](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/con_module_metadata.xml#L1)                                                                                                                                                                        | v1 只允许 meeting instructor name；Snapshot 是 names array。                                                                                                                      | `$select` 只取 public Schedule instructor display name；email/ID 永不进入 sanitizer output、drift values、logs 或 disk。                                                  |
| Capacity/seats                       | package has `EventPkgLimit` and `EventPkgSeatsAvailable`; component也有 `Limit`。                                                                                                                                                                                                                                                                                                                                   | v1 component enrollment；Snapshot 有 capacity/available/reported sentinel。                                                                                                       | 将 source enrollment 放在 package level；直接保留 source values，不从 limit-seats 推断 enrolled。继续执行 sentinel ADR。                                                  |
| Waitlist                             | `EventPkgNumOnWaitl`。upstream missing/default 会变成 `0`。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L198-L215)                                                                                                                                                                                                               | v1 有 `{state,count}`；Snapshot nullable count。                                                                                                                                  | 明确区分 unknown/not-shown/known-zero；缺失不可写 0。                                                                                                                     |
| Enrolled                             | metadata 未显示 package enrolled 字段；upstream也不发布 enrolled。                                                                                                                                                                                                                                                                                                                                                  | v1/Snapshot 可 nullable。                                                                                                                                                         | 保持 `null`，不得由 capacity-seats 重建。                                                                                                                                 |
| Disabled/cancelled/enrollable        | `EventPkgDisable`, `EventPkgStatusText`, event `Status`；upstream只检查 exact `Cancelled` 和 Disable truthiness。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/import_fa26.py#L190-L215)                                                                                                                                                         | v1 无 status；Snapshot 无 active/cancelled flag。                                                                                                                                 | 捕获实际枚举后做 strict allowlist；unsupported status 阻断。是否展示 cancelled 是产品 schema/frontend change。                                                            |
| Freshness                            | upstream 将本地日期写入 `refreshed_at.txt`，不是 TSS source timestamp。[source](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/scripts/refresh.py#L87-L97)                                                                                                                                                                                                     | v1 正确分开 `captured_at` / `source_updated_at`；availability 依赖后者。[local source](../../../docs/snapshot_pipe.md#L321-L333)                                                  | 保留当前 contract；在找到 source-declared freshness 前，`source_updated_at=null`，candidate 不得发布 availability。                                                       |
| Coverage                             | upstream full-set page loop + 500-module floor；输出只包含有 rows 的 153 subject files。                                                                                                                                                                                                                                                                                                                            | v1 有 requested subjects/complete/continuation/omissions；pipeline要求 configured subjects 全部 covered。[local source](../../../tools/catalog-snapshot/tssSchedule.ts#L561-L585) | 用 source count/continuation 证明整个 term complete，再把 194 configured subjects逐一标记 nonempty/confirmed-empty；不能把 153 files 当 complete。                        |

## 隐私、安全、访问和许可证判断

### 隐私

direct script **没有主动 query student entity set**；它只列出 module/events。不过同一个 metadata 还包含 `YUCSD_CON_SOC_STUDENT_STUDY`，而 `connect.py` 的 response listener 会保存所有命中 `/sap/opu/odata/` 的 JSON/XML response，不限 Schedule service。[broad listener](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/6d555e2e0f025b124b96e4e5fc08f3d82208caaf/tss/connect.py#L57-L128) 因此：

- “direct fetch 只请求课程 entity sets”是已确认事实；
- “整个 capture 流程保证不落盘学生资料”不是事实；
- `.gitignore` 只降低误提交概率，不满足 #168 的“raw authenticated responses never persisted”。上游确实忽略 state/raw paths，[见 `.gitignore`](https://github.com/SahirSSharma/WebReg-Course-Planner/blob/876f23c4a5ec85aa2c4b1fd3332865a73bc2b6ac/.gitignore#L1-L11)，但这些敏感 bytes 仍写到了本地磁盘。

### 安全与访问

TLS verification disabled 是必须先删除的 blocker。除此之外，source metadata 表明这两个 entity sets 本身是 read-only，script 也没有 mutation 或 access-control bypass；这使其适合作为 attended, bounded capture 的技术起点，但不代表 UCSD 已授权自动提取/再发布。根据 [UCSD AUP](https://adminrecords.ucsd.edu/ppm/docs/135-9.html)，SunGrid 应继续执行 #168 已约定的 401/403/429/CAPTCHA/prohibition terminal stops，并把用途授权当作独立风险确认，而不是从成功 HTTP 200 推断许可。

### License/reuse

可以复制或改写 MIT-licensed code，但要保留 notice。最小、清晰的方式是：在 SunGrid 新 capture module 的 attribution/third-party notice 中注明借鉴了 Sahir Sharma 的 endpoint reconnaissance/direct-pull implementation，并保留 MIT text。MIT 不会替 UCSD 授予 TSS access 或 course-data republication 权；那一部分仍由 UCSD policy/authorization 决定。

## SunGrid 应做的精确改动

### 1. 只移植 recon，不移植应用或 importer

- Pin 上游 `6d555e2` 作为 research provenance。
- 不引入 Flask、SQLite、WebReg UI、legacy SOC scraper、committed parsed dataset。
- 不复用 `import_fa26.py` 的 A/B/A01/A50 renumbering、global EventID dedup、building fixups 和 waitlist default。

### 2. 重写 attended capture boundary

- Playwright dedicated profile + 人工 SSO/Duo；不导出 `state.json`。
- 去掉 broad `context.on("response")` disk recorder、start_up/catalog dump 和任意 OData listener。
- 登录后只允许 exact TSS Schedule OData v4 origin/service、GET、两个（或 live discovery 确认的最小集合）entity/query shapes。
- 使用正常 TLS verification；不伪造/绕过 CAPTCHA、fingerprint、IP 或账号限制。
- 401/403/429、login redirect、account restriction、CAPTCHA、explicit prohibition 立即终止且不重试。

### 3. 最小化 source request

live discovery 后把 UI 的实际 query 固化为 allowlist，至少应包括：

- 显式 FA26 academic year/period filters；
- 只取 approved fields 的 `$select`；
- 能还原真实 package/component/meeting 的最小 `$expand`（优先 `_sections`, `_schedule`, `_modality` 中 UI 实际使用者）；
- source-declared next link/count；没有时使用 stable key order、总数与 duplicate/gap proof；
- 串行页面，不并发，不做高频 polling。

### 4. 在 #169 合并前修订 `tss-schedule-v1`

当前 v1 还未进入 `main`，可以直接调整而不制造一个已发布 contract 的兼容负担。推荐结构变化：

1. Course 增加 `module_id`、source academic year/period、source-declared units；仅加入 TSS Schedule 实际显示且 SunGrid要展示的 description/restriction/modality fields。
2. Booking choice/package 增加 stable package object ID、display ID、display text/section、status/disabled，以及 **package-level enrollment**。
3. Component 保留 EventID/Objid/Abbr/Key、teaching method、status、begin/end date、真实 requirement（若 source 未提供则 nullable/unknown，不推断）。
4. Meeting 优先承载 structured day/time/location/modality；保留 TSS display text只能作为 approved field，不做 catch-all raw object。
5. Instructor 只允许 public display name；明确拒绝 email/employee ID。
6. Coverage 增加 source page/count evidence 和 nonempty/confirmed-empty subject accounting；仍保留 captured/source freshness 分离。

旧 `tss-chatbot-v1` adapter 可继续存在，但应把 legacy component enrollment 向 package-level enrollment 归一化，并在同一 package 的 component values 冲突时 fail，而不是静默选一个。

### 5. 扩展 Published Snapshot/frontend 的真实缺口

当前 Published Snapshot 已能承载 package-as-section、meeting、instructor、capacity/seats/waitlist 和 freshness，但没有 source package status/cancelled/disabled、delivery modality，也把 units 置空。若“完全对应 TSS”包含这些 UI 信息，则必须：

- 以 package ID 构造 section identity；每个 booking choice 展开 shared lecture + 对应 discussion/lab；
- 增加并展示 package active/cancelled/disabled 状态；
- 增加 TSS delivery modality/online semantics；
- 直接发布 TSS source units；
- 保留 exam date/time/location/instructor；
- 不把 9999/99999 显示为真实 capacity，不把 missing waitlist 显示为 0，不推断 enrolled。

### 6. 建立完整性与对照验收

候选必须同时证明：

- 所有 module rows 都是 FA26，所有 event 都引用已知 module 和 package；
- module/event/package keys 唯一，分页无重复/缺页；
- 194 configured subjects 全部 nonempty 或 confirmed empty；
- source count、sanitized count、Snapshot count 和 manifest count 可追溯；
- package/component topology 不因 shared event dedup 丢失；
- source freshness 存在，且不是 capture/build date；
- 对 simple lecture、lecture+discussion、lecture+lab、shared component、TBA/arranged、exam、cancelled、online/hybrid、multi-instructor、bounded/unbounded availability 做 TSS UI 对照。

只有这些 gate 通过，才能说 SunGrid “完全对应 TSS Schedule”；上游 1,766/1,773 的 course count 增长本身只能说明它找到了比当前 1,741 corpus 更多的 rows，不能证明语义或 coverage 完整。

## 最终建议

**Go：** 采用 `yucsd_con_module` OData v4 endpoint 和 module→event→package recon；把上游 metadata/fixtures作为 schema discovery 参考；在 live attended session 中验证精确 query。

**No-go：** 原样运行/集成 `connect.py + fetch_soc.py + import_fa26.py`，或把 staging parsed JSON 当作 Production source。

**Contract decision：** 现在就修改尚未合并的 `tss-schedule-v1`，把 package-level enrollment、真实 source IDs/status/units/modality和完整性 evidence 补齐；不要为了兼容尚未发布的 issue #169 shape 而保留错误抽象。
**Release decision：** endpoint recon 明显提高了“明天做出完整 FA26 candidate”的可行性，但 source freshness、privacy-safe in-memory sanitizer、complete coverage proof、UCSD access-risk acceptance 和 Staging UI parity 仍是不可跳过的 blockers。
