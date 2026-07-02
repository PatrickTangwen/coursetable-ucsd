# SunGrid — UI 设计交接文档

> 本文件夹包含 SunGrid 课程表应用的 4 个核心页面设计。  
> 所有页面均为可独立运行的 `.dc.html` 文件（需要 `support.js` 运行时）。  
> 目标：交给新 LLM 进行 UI 主题重设计。

---

## 📁 文件清单

| 文件                          | 描述                       |
| ----------------------------- | -------------------------- |
| `SunGrid Catalog.dc.html`     | 课程搜索目录页（主页）     |
| `Worksheet Calendar.dc.html`  | 课表日历视图（含完整交互） |
| `Worksheet List View.dc.html` | 课表列表视图               |
| `Course Detail Modal.dc.html` | 课程详情弹窗               |
| `support.js`                  | DC 运行时（勿修改）        |
| `logo-a.svg`                  | SunGrid Logo SVG           |

---

## 🎨 当前 UI 配色体系

### 品牌色

| 用途         | 色值      | 说明                                    |
| ------------ | --------- | --------------------------------------- |
| 品牌蓝       | `#0e9ae9` | Logo "Sun" 字色                         |
| 品牌深蓝     | `#182b50` | Logo "Grid" 字色                        |
| 主交互蓝     | `#1a56db` | 按钮激活态、当前时间线、active nav link |
| 交互蓝 hover | `#1548b8` | 按钮/边框 hover 加深                    |
| 蓝色背景     | `#e8f0fe` | hover 背景高亮                          |

### 中性色

| 用途         | 色值                              |
| ------------ | --------------------------------- |
| 主文字       | `#1a1a2e`                         |
| 二级文字     | `#33354d`                         |
| 三级文字     | `#4a4d68`                         |
| 辅助文字     | `#5a5d7a`                         |
| 弱文字       | `#8b8fa3` / `#9a9db4`             |
| 禁用/隐藏    | `#b0b3be`                         |
| 边框         | `#e8e9ef` / `#dcdee6` / `#e4e4e9` |
| 浅背景       | `#f4f6fa` / `#f0f0f5` / `#fafafa` |
| 页面背景     | `#ffffff`                         |
| 模态遮罩背景 | `#e8e9ef`                         |

### 课程事件色（日历方块）

| 课程                  | 色值                        | 用途               |
| --------------------- | --------------------------- | ------------------ |
| ECON 120A             | `rgba(232, 177, 48, 0.85)`  | 金黄色事件块       |
| ECE 15 Lecture        | `rgba(102, 187, 106, 0.85)` | 绿色事件块         |
| ECE 15 Lab/Discussion | `rgba(255, 193, 7, 0.85)`   | 琥珀色事件块       |
| DSC 20R               | `rgba(26, 198, 218, 0.85)`  | 青色事件块         |
| DSC 197               | `#42a5f5`                   | 蓝色（侧边栏色条） |
| Final (冲突)          | `rgba(239, 83, 80, 0.88)`   | 红色事件块         |

### 侧边栏课程色条

| 课程      | 色值      |
| --------- | --------- |
| DSC 197   | `#42a5f5` |
| DSC 20R   | `#26c6da` |
| ECE 15    | `#ffc107` |
| ECON 120A | `#5c6bc0` |

### 统计指示色（Summary pills）

| 色值                           | 用途            |
| ------------------------------ | --------------- |
| `#63b37b` / `rgb(99,179,123)`  | 绿色 — 正常范围 |
| `rgb(255,235,132)`             | 黄色 — 中等范围 |
| `#f8696b` / `rgb(248,105,107)` | 红色 — 高范围   |

### 考试 Badge 色

| 状态     | 背景      | 文字      |
| -------- | --------- | --------- |
| upcoming | `#fef3c7` | `#92400e` |
| soon     | `#fee2e2` | `#b91c1c` |
| later    | `#e8f5e9` | `#2e7d32` |
| past     | `#f0f0f0` | `#888`    |

### Catalog 页面专用色

| 用途              | 色值                             |
| ----------------- | -------------------------------- |
| 绿色标签/评分     | `#22c55e`                        |
| 红色标签          | `#ef4444`                        |
| 黄色收藏星        | `#f59e0b`                        |
| Workload bar 背景 | `#e2e8f0`                        |
| Workload bar 填充 | `#6366f1`（高）/ `#22c55e`（低） |

---

## 🔤 字体系统

| 字体                 | 权重                                   | 用途         |
| -------------------- | -------------------------------------- | ------------ |
| `Cormorant Garamond` | 600 italic, 700                        | Logo 专用    |
| `Inter`              | 400, 500, 600, 700                     | 所有 UI 文字 |
| 系统回退             | `system-ui, -apple-system, sans-serif` | —            |

### 字号层级

| 尺寸                  | 用途                         |
| --------------------- | ---------------------------- |
| 21px / 700            | 模态标题                     |
| 20px                  | Logo                         |
| 16px / 500-600        | 模态副标题、section header   |
| 15px / 600            | Summary 标题                 |
| 14px / 400-700        | 卡片标题、按钮文字、表单输入 |
| 13px-13.5px / 400-600 | 日历事件、导航链接、下拉选项 |
| 12px                  | 辅助信息、时间标签、课程描述 |
| 11px                  | 结果计数、极小辅助文字       |
| 10px                  | Badge 文字                   |

---

## 📐 布局结构

### 全局

- 页面宽度：全屏 `100vw`
- 导航栏高度：`56px`（Worksheet）/ `72px`（Catalog）
- 导航栏固定在顶部 (`position: sticky; top: 0`)
- 内容区域 padding：`1rem`（16px）

### Catalog 页面 (`SunGrid Catalog.dc.html`)

```
┌─────────────────────────────────────────────────┐
│ Navbar (sticky, 72px)                           │
│ [Logo] [Search+Filters] [NavLinks] [Avatar]     │
├────────────┬────────────────────────────────────┤
│ Sidebar    │ Course Grid                        │
│ 220px      │ CSS Grid: repeat(auto-fill,        │
│ Filters:   │   minmax(320px, 1fr))              │
│ - Dept     │ gap: 16px                          │
│ - Level    │                                    │
│ - Day/Time │ Each card:                         │
│ - Units    │ - border-radius: 10px              │
│ - Rating   │ - box-shadow: 0 1px 4px            │
│            │ - height: ~180px                   │
│            │ - hover: lift + shadow              │
└────────────┴────────────────────────────────────┘
```

### Worksheet Calendar 页面 (`Worksheet Calendar.dc.html`)

```
┌─────────────────────────────────────────────────┐
│ Navbar (sticky, 56px)                           │
│ [Logo] [Cal|List] [Term▼] [★ Worksheet▼]  ... │
├──────────────────────────────────┬──────────────┤
│ Calendar Card (75%)              │ Sidebar(25%) │
│ ┌──────────────────────────────┐ │ ┌──────────┐ │
│ │ [54px times] [5 day columns] │ │ │ Summary  │ │
│ │                              │ │ │ (toggle) │ │
│ │ Each hour row = 80px         │ │ ├──────────┤ │
│ │                              │ │ │ Icon bar │ │
│ │ Events: absolute positioned  │ │ │ [👁][⚙][📅]│ │
│ │ border-left: 3px accent     │ │ ├──────────┤ │
│ │ border-radius: 4px          │ │ │ Course   │ │
│ │                              │ │ │ Cards    │ │
│ │ Current time: blue 2px line │ │ │ (expand) │ │
│ └──────────────────────────────┘ │ └──────────┘ │
└──────────────────────────────────┴──────────────┘
```

### Worksheet List View 页面 (`Worksheet List View.dc.html`)

```
┌─────────────────────────────────────────────────┐
│ Navbar (sticky, 72px)                           │
│ [Logo] [Search] [Cal|List] [Term▼] ...         │
├─────────────────────────────────────────────────┤
│ Summary Stats + Button Row                      │
├─────────────────────────────────────────────────┤
│ Course Table                                    │
│ Columns: Color | Code | Title | Rating |        │
│          Workload | Time | Credits | Enroll     │
│ Sortable headers (▲▼)                           │
│ Row hover highlight                             │
└─────────────────────────────────────────────────┘
```

### Course Detail Modal (`Course Detail Modal.dc.html`)

```
┌────────────── 780px max-width ──────────────┐
│ border-radius: 14px                         │
│ box-shadow: 0 24px 80px rgb(0 0 0 / 18%)   │
│                                             │
│ [Title + Close ✕]  (sticky header)          │
│ [Section Pills A01 | A02 | A03]            │
│ [Tab bar: Overview | Ratings | Sections]    │
├─────────────────────────────────────────────┤
│ Scrollable content area                     │
│                                             │
│ ┌─ Info Grid ─────────────────────────────┐ │
│ │ Credits: 4  │  Grading: Letter          │ │
│ │ Type: Lecture│  Prerequisites: ...      │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ Description ───────────────────────────┐ │
│ │ Full course description text            │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ Schedule Table ────────────────────────┐ │
│ │ Day | Time | Location | Instructor     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [★ Add to Worksheet] [Compare]              │
└─────────────────────────────────────────────┘
```

---

## 🎯 交互行为一览

### 1. Worksheet Calendar — 课程悬停交叉高亮

- **触发**：鼠标悬停侧边栏课程卡 或 日历事件块
- **效果**：
  - 被悬停课程的日历事件 → opacity 提升至 0.95，加 `box-shadow`
  - 其他课程的日历事件 → opacity 降至 0.3（灰暗）
  - 侧边栏对应卡片 → 加 `box-shadow: 0 2px 8px`
- **离开**：所有恢复原状

### 2. 课程卡展开/折叠

- **触发**：点击色条 或 右侧 chevron (▼)
- **效果**：
  - Chevron 旋转 180°（`transform: rotate(180deg)`，`transition: 0.2s`）
  - 展开区域显示考试详情列表：
    - 每条：彩色圆点 + 考试类型 + 倒计时 badge + 日期 + 地点
    - Badge 颜色编码：`upcoming`(黄) / `soon`(红) / `later`(绿) / `past`(灰)
  - 底部显示 "Remove this course" 按钮（hover 变红）
- **卡片加 `box-shadow` 增强**

### 3. 课程隐藏/显示（眼睛切换）

- **触发**：
  - 侧边栏卡片悬停时出现 👁 按钮，点击切换
  - 日历事件悬停时右上角出现 👁 按钮
  - 顶部工具栏全局 👁 按钮
- **效果**：
  - 隐藏的课程：日历事件 `display: none`
  - 侧边栏色条 `opacity: 0.3`，文字变 `#b0b3be`
  - 图标切换为 eye-slash（斜线穿过眼睛）
  - Summary 面板数字实时更新，pill 颜色随数值变化

### 4. Summary 面板折叠

- **触发**：点击 "Summary" 标题
- **效果**：
  - Chevron 旋转 180°
  - 统计区域隐藏/显示
  - `transition: 0.2s ease`

### 5. 日历控件集群（右上角按钮组）

- **触发**：悬停右上角展开/收缩按钮
- **效果**：
  - 向下展开两个额外按钮（`opacity: 0→1`, `visibility: hidden→visible`）
  - 🔒 锁定按钮：切换锁定/解锁图标
  - ⚙ 设置按钮
  - 每个按钮 hover 时 `scale(1.1)`
- **蓝色脉冲点**：`animation: pulse 2s ease-in-out infinite`

### 6. 当前时间指示器

- **条件**：当前时间在 Mon-Fri 8am-9pm 范围内
- **外观**：
  - 蓝色水平线 `2px`，颜色 `#1a56db`
  - 左端圆点 `8px`
  - `box-shadow: 0 0 4px rgba(26, 86, 219, 0.3)`

### 7. 导出下拉菜单

- **触发**：点击日历导出按钮
- **效果**：
  - 弹出菜单（`animation: popover-fade-in 0.14s ease-out`）
  - 选项：Export as .ics / Copy shareable URL
  - 点击页面其他区域关闭
- **菜单样式**：
  - `border-radius: 8px`
  - `box-shadow: 0 8px 24px rgb(0 0 0 / 10%)`
  - hover 选项背景 `#f4f6fa`

### 8. 日历事件悬停按钮

- **触发**：悬停日历事件块
- **效果**：右上角浮现圆形白色按钮（👁隐藏）
  - 按钮 `24px` 圆形，白底 + 边框
  - `opacity: 0→1`，`transition: 0.2s`

### 9. Catalog 页面

- **课程卡 hover**：`translateY(-2px)` + shadow 增强
- **排序**：点击 Relevance/Rating/Workload/Credits 切换排序
- **筛选侧边栏**：展开/折叠各 filter 组
- **搜索**：实时搜索 + 结果计数
- **收藏星**：黄色 `#f59e0b`，点击切换

### 10. Course Detail Modal

- **Tab 切换**：Overview / Ratings / Sections
  - 当前 tab：`color: #1a56db; border-bottom: 2px solid #1a56db`
- **Section 切换**：pill 按钮组 A01/A02/A03
  - 激活：`background: #1a56db; color: #fff`
- **滚动**：内容区域独立滚动，header+tabs 固定
- **关闭**：右上 ✕ 按钮，hover 变色

---

## 🧩 通用交互模式

| 模式          | 实现                                           |
| ------------- | ---------------------------------------------- |
| 按钮 hover    | `background: #f0f0f5` 或 `#e8f0fe`（蓝系）     |
| 边框 hover    | `border-color` 从 `#dcdee6` → `#1548b8`        |
| 卡片 hover    | `box-shadow` 增强 + 可选 `translateY(-2px)`    |
| 过渡时间      | 大多数 `0.15s ease` 或 `0.2s ease`             |
| 弹出动画      | `popover-fade-in`: opacity + translateY(6px→0) |
| 模态动画      | `modal-fade-in`: opacity + scale(0.97→1)       |
| 删除/危险操作 | hover 时背景 `#fef2f2`，文字 `#c94040`         |

---

## 📝 重设计注意事项

1. **保持所有交互行为**：hover 高亮、展开折叠、hide/show 等逻辑不变
2. **课程颜色可重新设计**：当前使用 Material 风格色板，可替换为新主题
3. **字体可替换**：当前 Inter + Cormorant Garamond
4. **圆角体系**：当前 `4px`(事件块) / `6px`(按钮) / `8px`(卡片) / `10px`(目录卡) / `14px`(模态)
5. **阴影体系**：当前使用 3 层阴影 — light(`0 1px 2px`) / medium(`0 2px 6px`) / heavy(`0 24px 80px`)
6. **间距体系**：基于 `4px` 倍数 — 4/6/8/10/12/14/16/24/28
