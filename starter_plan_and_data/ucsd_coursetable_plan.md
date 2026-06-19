# UCSD Course Planning Platform Plan

最后更新：2026-06-19

## 1. 项目目标

基于 Yale 学生开发的 CourseTable fork，开发一个面向 UCSD 学生的选课、查课和排课平台。

这个项目不应该机械复制 CourseTable 的所有功能。CourseTable 里有很多 Yale 专属数据和社交逻辑，例如 Yale OCE 评课、Yalies/profile、friends taking course、Yale area/skill tags、building map、walking time、syllabus 等。UCSD 版本应该保留 CourseTable 最有价值的产品骨架：

- 课程目录搜索
- 课程详情页
- worksheet 选课规划
- 日历排课
- 时间冲突检测
- saved searches / wishlist
- 用户保存课表
- 导出日历
- 高性能课程数据缓存

同时把 Yale 专属功能替换为 UCSD 可持续获取的数据：

- UCSD Schedule of Classes
- UCSD General Catalog
- 你已有的近两年 GPA CSV
- UCSD college GE mapping
- 后续可选的 UCSD SET/CAPE evaluation 数据

MVP 的目标是先做一个可靠的 UCSD 查课和排课工具，而不是一开始就做完整 degree audit 或教授评价平台。

## 2. CourseTable 基线理解

CourseTable 当前主要由两个 repo 组成：

- `coursetable/coursetable`：网站前端、API、用户系统、worksheet、导出、静态 catalog 缓存。
- `coursetable/ferry`：crawler、数据清洗、数据库同步、course eval ingestion、衍生指标计算。

CourseTable 的核心架构是：

1. crawler 抓取课程和评价数据。
2. 数据清洗后写入 PostgreSQL。
3. Hasura 提供课程数据 GraphQL 查询。
4. Express API 处理用户数据、登录、静态 catalog JSON、导出等。
5. React frontend 提供 catalog 和 worksheet 体验。

UCSD 版本建议保留这个大结构，但替换数据源和删除 Yale 专属功能。

## 3. 产品范围决策

### 3.1 保留的 CourseTable 功能

这些功能适合直接保留并改造成 UCSD 版本：

- Catalog 搜索页
- 学期选择
- subject / department 过滤
- course code / title / professor / description 搜索
- days / time 过滤
- course level 过滤
- units / credit 过滤
- seats / enrollment 过滤
- course detail modal/page
- worksheet 选课规划
- 添加和删除课程 section
- calendar view
- list view
- 时间冲突检测
- 多个 worksheet
- saved searches
- wishlist
- shareable worksheet URL
- ICS export
- Google Calendar export
- PNG export，如果移除地图后仍然容易保留
- dark mode
- responsive frontend
- public catalog static JSON cache
- 用户账号系统
- 基础 profile / privacy setting

### 3.2 需要改造成 UCSD 版本的功能

| CourseTable 功能 | UCSD 版本 |
|---|---|
| Yale subjects | UCSD subjects / departments |
| Yale schools | UCSD department、division、undergraduate/graduate level |
| Yale area / skill tags | UCSD college GE mapping |
| Yale OCE overall / workload ratings | GPA / grade distribution stats |
| Yale professor rating | 先不做，后续视 SET/CAPE 数据许可再做 |
| Yale course requirement metadata | UCSD Catalog prerequisites + GE metadata |
| Yale location model | MVP 只保留 UCSD building / room 文本 |
| Yale CAS login | UCSD email/OAuth 登录，官方 UCSD SSO 后置 |

### 3.3 先删除或禁用的功能

你已经确认这些功能不做或先不做：

- friends taking course
- catalog 里的 friend count
- friend worksheet viewing
- friend request system
- walking time
- worksheet map
- building map
- syllabus
- past syllabus
- Yale area / skill tags
- Yale requirement tags
- Yale OCE evaluation challenge/access flow
- Yale OCE narrative comments
- Yale AI course eval summaries

这些功能应该从 UI 和数据模型里干净移除，不建议只用 placeholder 隐藏。否则后续会留下大量无效状态和 Yale 残留逻辑。

### 3.4 暂缓的功能

这些功能可以作为后续阶段，不进入 MVP：

- UCSD SET/CAPE integration
- professor evaluation pages
- AI summaries of evaluations
- student-submitted course reviews
- full requirement-aware planning
- major requirement planning
- seat availability history
- recommendation engine

## 4. UCSD 数据源计划

### 4.1 UCSD Schedule of Classes

主数据源：

https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudent.htm

用途：

- 当前和历史 term 的 schedule 数据
- course code
- course title
- section ID
- meeting type
- section code
- days
- start time
- end time
- building
- room
- instructor
- seats available
- seat limit
- course notes
- prerequisite/resource/evaluation links when present

调研结论：

- UCSD Schedule of Classes 是 form-backed HTML。
- 可以通过 POST 请求按 term + subject 抓取。
- 页面支持 subject、department、course code、section id、professor/title 等搜索方式。
- 结果表包含课程、section、meeting、time、location、instructor、seat availability 等信息。
- UCSD 页面标注数据是 nightly updated，所以不能把 seat availability 展示成实时 WebReg 数据。

产品里应该明确显示：

- `Last updated from UCSD Schedule of Classes`
- `Seats available as of UCSD nightly update`
- `Not a real-time enrollment guarantee`

### 4.2 UCSD General Catalog

主数据源：

https://catalog.ucsd.edu/

用途：

- 稳定课程标题
- course description
- units
- prerequisites
- restrictions
- course-level notes
- department course list

原因：

Schedule of Classes 更适合抓 term-specific section 数据，但 course description 和 prerequisites 更适合从 General Catalog 获取。不要只依赖 schedule row 拼出课程详情。

### 4.3 GPA CSV

你已有的数据：

- 近两年的 GPA CSV

MVP 里应把它作为 CourseTable rating 的 UCSD 替代信号，但命名必须准确。

可以计算：

- course-level average GPA
- instructor-course average GPA，如果 CSV 有 instructor
- term-level GPA trend
- grade distribution，如果 CSV 有 grade counts
- sample size
- department percentile
- instructor-course pair history

重要原则：

不要把 GPA 叫做 rating、workload 或 professor quality。GPA 反映的是 grading outcome，不是工作量、教学质量或课程难度本身。

推荐 UI 文案：

- Average GPA
- Grade Distribution
- GPA Trend
- Historical Grading
- Sample Size

### 4.4 UCSD SET / CAPE

相关来源：

- https://set.ucsd.edu/
- https://set.ucsd.edu/student/evaluation-results.html
- https://cape.ucsd.edu/

调研结论：

- CAPE 是旧系统。
- SET 从 Summer 2023 开始替代 CAPE。
- SET/CAPE 是 UCSD 版本最接近 Yale OCE 的数据源。
- 但 SET reports 很可能需要 UCSD 登录。

你已经说明可以用自己的 UCSD 账户登录查看，但担心请求太多导致账户被 block。因此计划上应该明确：

- MVP 不做 SET/CAPE 自动爬取。
- 不用个人 UCSD 账户作为生产数据管道。
- 不在用户访问课程页面时实时请求 SET/CAPE。
- 不做高频 authenticated scraping。

后续更安全的方案：

1. 优先争取 UCSD 官方允许的导出/API/数据访问方式。
2. 如果只能人工访问，则考虑低频、手动 snapshot，但必须确认使用边界。
3. 把 SET/CAPE ingestion 做成独立 pipeline，不和 schedule crawler 混在一起。
4. 所有 evaluation 数据都缓存到本地数据库。
5. 设置严格 request budget 和日志。
6. 页面只读缓存，不触发实时登录请求。
7. 明确显示数据来源和更新时间。

### 4.5 UCSD College GE Mapping

CourseTable 的 Yale area/skill tags 应改成 UCSD college GE mapping。

可能数据源：

- UCSD college websites
- UCSD General Catalog
- official GE requirement pages
- college-specific PDFs or requirement tables

建议先只做 college GE，不要一开始做完整 major planning。

原因：

- UCSD 每个 college 的 GE 结构不同。
- GE requirement 可能按入学年份变化。
- major requirement 更复杂，且会引入 degree audit 级别的问题。

建议数据模型：

- college
- requirement group
- requirement name
- course subject
- course number
- effective academic year
- source URL
- source last checked date
- status: confirmed / needs review / deprecated

UI 表达方式：

- 在 catalog filter 里提供 college GE filter。
- 在 course detail 里显示 GE badges。
- 明确写成 advisory metadata，不承诺替代官方 degree audit。

### 4.6 Building / Location Data

因为 MVP 删除 walking time 和 map，所以初期只需要：

- building text
- room text

不需要：

- building coordinates
- map rendering
- walking ETA
- route calculation

后续如果重新加入地图，可以再建立 UCSD building coordinate table，并考虑 OpenStreetMap、UCSD map source、Google Maps API 或 OpenRouteService。

## 5. 功能设计

### 5.1 Catalog Search

MVP catalog 应支持：

- term selector
- subject filter
- department filter，如果能稳定 normalize
- lower division / upper division / graduate filter
- course code search
- title search
- instructor search
- description search
- days filter
- time range filter
- seats available filter
- units filter
- meeting type filter
- hide full sections
- hide courses conflicting with current worksheet
- sort by course code
- sort by title
- sort by available seats
- sort by meeting time
- sort by average GPA
- sort by GPA sample size
- college GE filter

从 catalog 删除：

- friend count
- friends taking course
- walking time
- map-related fields
- Yale area/skill filters
- Yale rating/workload/professor rating sliders
- Yale evaluation access gating

### 5.2 Course Detail

MVP course detail 应显示：

- course code
- title
- units
- description
- prerequisites
- restrictions
- term
- section list
- meeting type
- days/time
- building/room text
- instructor
- seats available / seat limit
- Schedule of Classes notes
- GPA summary
- grade distribution chart，如果 CSV 支持
- historical GPA by term
- GE badges，如果已接入 GE mapping
- UCSD Schedule source timestamp
- UCSD Catalog source link

从 course detail 删除：

- friends taking course
- syllabus
- past syllabus
- map
- walking time
- Yale OCE narratives
- Yale AI evaluation summaries
- Yale overall/workload/professor rating display

### 5.3 Worksheet

MVP worksheet 应支持：

- add section to worksheet
- remove section from worksheet
- multiple worksheets
- rename worksheet
- clear worksheet
- calendar view
- list view
- conflict detection
- hidden courses
- course colors
- shareable URL
- public/private setting
- ICS export
- Google Calendar export
- PNG export，如果不依赖 map 组件

从 worksheet 删除：

- friends dropdown
- friend worksheet selector
- map view
- walking-time display
- building pins

### 5.4 User Account

MVP 用户功能：

- sign in
- save worksheets
- save searches
- wishlist
- basic profile settings
- public/private worksheet setting

登录建议：

第一阶段优先使用：

- Google OAuth，并限制 `ucsd.edu` 邮箱
- 或 email magic link / verification code

后续再考虑：

- 官方 UCSD SSO app registration

不建议一开始就做：

- 依赖个人 UCSD account 的登录模拟
- unofficial SSO scraping
- friend graph
- friend requests
- Yalies-style profile integration

## 6. 数据管道架构

### 6.1 推荐整体流程

保留 CourseTable 的 crawler -> database -> API/cache -> frontend 的整体形状，但把 Yale Ferry 的数据源替换为 UCSD pipeline。

建议流程：

1. 按 term + subject 抓 UCSD Schedule of Classes HTML。
2. 保存 raw HTML snapshot。
3. 解析 schedule rows。
4. 抓 UCSD General Catalog subject pages。
5. 解析 course description、units、prerequisites。
6. 导入 GPA CSV。
7. normalize term/course/instructor keys。
8. 计算 GPA stats、sample size、GE matches 等衍生字段。
9. 写入 PostgreSQL。
10. 生成 public catalog JSON cache。
11. frontend 用 cache 做快速搜索，用 API/GraphQL 做 detail/user queries。

### 6.2 Raw Data Storage

建议保留原始数据，便于审计和 parser debug：

```text
raw/schedule_of_classes/{term}/{subject}.html
raw/catalog/{subject}.html
raw/gpa/{import_id}.csv
```

每次 import 应记录：

- source URL
- fetch time
- parser version
- row count
- error count
- unmatched row count
- warning summary

### 6.3 核心数据表

建议课程数据表：

- `terms`
- `subjects`
- `courses`
- `course_descriptions`
- `sections`
- `meetings`
- `instructors`
- `section_instructors`
- `buildings`
- `gpa_course_stats`
- `gpa_instructor_course_stats`
- `gpa_term_stats`
- `ge_requirements`
- `ge_course_matches`
- `source_snapshots`
- `import_runs`

建议用户数据表：

- `users`
- `worksheets`
- `worksheet_courses`
- `wishlist_courses`
- `saved_searches`

不进入 MVP 的表：

- friends
- friend requests
- friend worksheet views
- walking-time tables
- map coordinate tables
- Yale evaluation tables
- SET/CAPE tables，直到正式设计评课数据管道

### 6.4 Course Identity

不要用脆弱的字符串 heuristics 来合并课程。

初始 canonical course key：

```text
subject + course_number
```

term-specific section key：

```text
term + section_id
```

如果 UCSD 有 cross-listed courses，不要凭 title 相似度自动合并。只有找到可靠官方来源后，再加入 cross-list mapping。

### 6.5 GPA Matching

GPA CSV 应通过透明的 normalization layer 匹配 schedule/catalog。

推荐匹配字段：

- term
- subject
- course number
- instructor name，如果 CSV 有

每次导入必须输出：

- matched rows
- unmatched rows
- ambiguous matches
- dropped rows，理论上应尽量为 0

不要静默丢弃：

- renamed courses
- instructor spelling variants
- cross-listed courses
- 当前 term 没开但 GPA 历史里存在的课程

## 7. 技术栈

### 7.1 沿用 CourseTable 的部分

Frontend：

- TypeScript
- React
- Vite
- React Router
- Zustand
- Apollo Client / GraphQL
- Bootstrap / React Bootstrap
- Chart.js
- react-big-calendar
- CSS Modules

Backend：

- TypeScript
- Node.js
- Express
- PostgreSQL
- Drizzle ORM
- Hasura GraphQL，如果保留 CourseTable 的 course query 结构
- Redis
- Docker Compose

Data pipeline：

- Python 3.12
- httpx
- BeautifulSoup
- lxml
- pandas
- SQLAlchemy
- psycopg

Observability：

- Sentry，可选但推荐
- structured import logs
- crawler run summaries
- parser failure reports

### 7.2 Package Management

CourseTable upstream 使用 Bun。

因为你计划基于 CourseTable fork 开发，建议第一阶段保留 Bun，避免一开始就重构工具链。

建议：

- CourseTable fork 里的 TypeScript app 继续用 Bun。
- 新 UCSD crawler 用 Python `uv` 管依赖。
- 本地服务用 Docker Compose 管 PostgreSQL、Redis、Hasura。

不要在第一阶段混用 npm/yarn/pnpm/Bun。等 fork 跑通、UCSD 数据模型稳定后，再考虑是否迁移 JS package manager。

### 7.3 需要自己安装或配置的软件

本地开发必需：

- Git
- Docker Desktop
- Docker Compose
- Node.js，版本需兼容 CourseTable 当前 runtime
- Bun
- Python 3.12
- `uv`
- PostgreSQL client tools，例如 `psql`
- code editor

推荐安装：

- `jq`
- `ripgrep`
- browser devtools
- Sentry CLI，如果用 Sentry

### 7.4 需要自己设置的平台或外部服务

大概率需要：

- GitHub repo
- GitHub Actions
- frontend hosting：Cloudflare Pages、Vercel 或类似平台
- backend hosting：Render、Fly.io、Railway、VPS 或类似平台
- managed PostgreSQL：Neon、Supabase、RDS 或类似服务
- managed Redis：Upstash 或类似服务，如果不自托管
- Google OAuth credentials，如果做 Google login 或 Google Calendar export
- Google Calendar API credentials，如果导出流程需要 OAuth
- Sentry project，可选
- domain name

不要把个人 UCSD 账号作为生产服务依赖。

## 8. 实施阶段

### Phase 0: Fork Audit And Local Boot

目标：

让 CourseTable fork 本地跑起来，确认 Yale-specific surfaces。

任务：

- fork CourseTable
- clone fork
- 启动 frontend
- 启动 API
- 启动 Docker Compose services
- 确认 catalog page 能基于现有 fixture/static data 加载
- 梳理 env vars
- 全局搜索 Yale、Yalies、OCE、CAS、skills、areas、friends、walking、map、syllabus 相关逻辑

交付：

- local development runbook
- Yale-specific removal checklist
- 本地启动命令列表

### Phase 1: UCSD Schedule Crawler

目标：

用 UCSD Schedule of Classes 替换 Yale course source。

任务：

- 实现 POST-based Schedule of Classes fetcher
- 按 term + subject 抓取
- 保存 raw HTML snapshot
- 解析 result tables
- 提取 title、units、sections、meetings、instructors、seats、notes、links
- 用已保存 HTML fixture 写 parser tests
- 每次 import 输出 row count、error count、unmatched summary

交付：

- `ucsd_schedule` crawler module
- raw snapshot directory
- normalized schedule output
- parser tests

### Phase 2: UCSD Catalog Crawler

目标：

补全稳定课程描述和 prerequisites。

任务：

- 按 subject 抓 UCSD General Catalog pages
- 解析 title、units、description、prerequisites、restrictions
- 匹配 schedule courses
- 输出 unmatched catalog/schedule report

交付：

- `ucsd_catalog` crawler module
- course metadata tables
- catalog parser tests

### Phase 3: GPA Import

目标：

把 GPA CSV 变成平台的一等数据。

任务：

- 检查 GPA CSV schema
- 定义 term/course/instructor normalization
- 计算 course-level GPA stats
- 如果数据支持，计算 instructor-course stats
- 计算 sample size 和 grade distribution
- 输出 unmatched-row report
- 在 course detail 加 GPA summary 和 chart

交付：

- GPA import script
- GPA stats tables
- course detail GPA module
- import quality report

### Phase 4: Frontend UCSD Catalog

目标：

把 CourseTable catalog UI 改成 UCSD catalog。

任务：

- 替换 Yale-specific copy
- 用 UCSD college GE filters 替换 area/skill filters
- 删除 rating/workload sliders
- 添加 GPA filters/sorting
- 添加 seat availability filters
- 删除 friend indicators
- 删除 syllabus UI
- 删除 map/walking UI entry points
- 显示 schedule source timestamp

交付：

- UCSD catalog page
- UCSD course modal/detail
- GPA-aware sorting/filtering
- source timestamp display

### Phase 5: Worksheet Adaptation

目标：

保留 CourseTable worksheet 的排课能力，删除社交和地图能力。

任务：

- 保留 calendar/list view
- 保留 add/remove section
- 保留 conflict detection
- 保留 worksheet sharing
- 保留 ICS/Google Calendar export
- 删除 friends dropdown
- 删除 map view
- 删除 walking-time computations
- 验证 hidden/color/move 行为

交付：

- UCSD worksheet page
- UCSD meeting data conflict detection
- export support

### Phase 6: UCSD GE Metadata

目标：

用 UCSD college GE mapping 替换 Yale area/skill tags。

任务：

- 先选 1-2 个 college 作为试点
- 找 official GE sources
- 建 GE requirement schema
- 建 sourced GE course mapping
- 加 source URL 和 academic-year versioning
- 加 catalog GE filter
- 加 course detail GE badges
- 添加 advisory wording

交付：

- GE mapping data model
- first college GE dataset
- GE filter UI
- GE badges

### Phase 7: Auth And Saved Data

目标：

支持保存 worksheet、saved searches、wishlist。

任务：

- 选择登录方式
- 实现 UCSD email verification 或 Google OAuth restricted to UCSD email
- 保留 saved searches
- 保留 wishlist
- 保留 private/public worksheet setting
- 删除 friend-related user tables and UI

交付：

- login flow
- saved worksheet persistence
- saved search persistence
- wishlist persistence

### Phase 8: Deployment

目标：

部署可用 beta。

任务：

- 设置 production PostgreSQL
- 设置 backend hosting
- 设置 frontend hosting
- 添加 scheduled crawler job
- 添加 crawler logs and alerts
- 添加 source timestamp display
- 添加 privacy/data disclaimer pages

交付：

- beta URL
- scheduled data refresh
- production database
- deployment runbook

## 9. SET/CAPE 后续计划

Course eval / professor eval 暂时不进入 MVP。

原因：

- SET/CAPE 访问可能需要 UCSD 登录。
- 高频 authenticated scraping 可能影响你的个人账户。
- evaluation 数据可能有政策限制。
- 生产服务不应依赖个人账号和实时登录请求。

后续如果要做：

1. 先确认 UCSD 是否允许这种使用。
2. 优先使用官方导出/API/授权数据。
3. 如果只能人工访问，考虑低频 manual snapshot，但必须确认使用边界。
4. evaluation pipeline 和 schedule pipeline 分离。
5. 所有 evaluation 数据先缓存到数据库。
6. 页面只读缓存，不实时请求 SET/CAPE。
7. 设置 request budget、日志和失败报警。
8. 明确显示 evaluation source 和 last updated。

在这个阶段之前，平台只使用 GPA stats 作为课程结果信号。

## 10. 主要风险和应对

| 风险 | 应对 |
|---|---|
| UCSD Schedule HTML 结构变化 | 保存 raw snapshot，写 parser tests，parser 失败报警 |
| seat availability 不是实时数据 | UI 明确标注 nightly updated |
| GPA CSV 与 schedule/catalog 匹配困难 | 建 normalization layer 和 unmatched report |
| instructor name 不稳定 | 同时保存 raw name 和 normalized name，不做无证据合并 |
| GE mapping 难维护 | 按 academic year 和 source URL versioning |
| SET/CAPE 抓取有账户风险 | MVP 不做，后续只做授权或低频缓存方案 |
| CourseTable Yale assumptions 很深 | 分阶段删除，先保 catalog/worksheet 主路径 |
| Hasura 增加复杂度 | 初期保留以减少 fork 改动，数据模型稳定后再评估 |

## 11. MVP 完成标准

MVP 完成时，UCSD 学生应该可以：

1. 选择 term。
2. 搜索 UCSD 课程。
3. 按 subject、level、days、time、seats、units、GPA、college GE 过滤。
4. 打开课程详情，看到 description、prerequisites、sections、instructors、time、location、seats、GPA stats。
5. 把 section 加入 worksheet。
6. 看到日历排课和时间冲突。
7. 保存或分享 worksheet。
8. 导出到 calendar。

MVP 不包含：

- friends
- maps
- walking time
- syllabi
- SET/CAPE evals
- professor ratings
- AI eval summaries
- full degree audit
- major planning

## 12. 参考链接

- CourseTable repo: https://github.com/coursetable/coursetable
- CourseTable architecture docs: https://raw.githubusercontent.com/coursetable/coursetable/master/docs/containers.md
- Ferry crawler docs: https://raw.githubusercontent.com/coursetable/ferry/master/docs/code-structure.md
- Ferry algorithm notes: https://raw.githubusercontent.com/coursetable/ferry/master/docs/algorithms.md
- UCSD Schedule of Classes: https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudent.htm
- UCSD General Catalog: https://catalog.ucsd.edu/
- UCSD SET: https://set.ucsd.edu/
- UCSD SET results info: https://set.ucsd.edu/student/evaluation-results.html
- UCSD CAPE: https://cape.ucsd.edu/
