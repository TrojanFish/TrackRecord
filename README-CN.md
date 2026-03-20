# TrackRecord — 个人运动数据仪表盘

<p align="center">
  <img src="https://img.shields.io/badge/后端-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/前端-React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/数据库-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/部署-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/地图-Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" />
</p>

**TrackRecord** 是面向耐力运动爱好者的个人运动数据同步与可视化平台。支持从 Strava、Garmin 及 24+ 个平台同步活动数据，统一存储于本地 SQLite 数据库，并通过功能完整的 React 仪表盘呈现——内置跑步 / 骑行模式切换与移动端 / 桌面端自适应布局。

---

## 功能特性

### 仪表盘页面

| 页面 | 功能说明 |
|------|---------|
| **Dashboard（主页）** | 核心指标卡（CTL/TSB tooltip 说明、连胜 NOW vs BEST）、Smart Coach 建议、训练负荷图、运动员雷达图、年度活动热力图、深度分析弹窗 |
| **Activities（活动列表）** | 完整活动日志，可折叠筛选栏，可排序表格，Run/Ride 模式感知详情面板（SPM/RPM 步频踏频、功率、GAP 坡度配速），手机端自动隐藏次要列 |
| **Analytics（统计分析）** | 年度对比折线图、星期偏好柱图、黄金时段分布、距离/心率区间分析、月度进步表格 |
| **Eddington** | E 值阶梯图、距下一级差距计数、按当前训练频率估算完成日期 |
| **Heatmap（轨迹热图）** | Leaflet 路线地图，hover 悬浮卡（名称/距离/配速），类型/速度配色模式，可折叠城市侧边栏，年份/运动类型筛选 |
| **Records（个人纪录）** | 最佳成绩奖牌墙、Riegel 公式赛事预测（跑步：5K→马拉松，骑行：40K→200K），动态 VO₂max 进度条，历史成绩散点趋势 |
| **Gear（装备管理）** | 装备统计表，动画式寿命进度条（显示剩余可用里程），逐件月度里程图，记录设备统计 |
| **Monthly Stats（月度统计）** | 月份导航器（附活动数角标），热力图 + 每日柱状图 + 运动类型饼图 |
| **Challenges（挑战奖杯）** | Strava 奖杯橱柜导入（内联成功/错误反馈），按月奖杯网格，俱乐部展示区 |
| **Photos（照片）** | 响应式瀑布流画廊（桌面 3 列 → 平板 2 列 → 手机 1 列），自动从 Strava 同步 |
| **Rewind（年度回顾）** | 年度总结——最长路线地图、连胜 BEST/NOW、距离 + 海拔图表、响应式照片网格 |
| **Segments（路段）** | KOM/QOM 追踪，表头点击排序（最佳时间/距离/坡度/努力次数），努力历史弹窗，HR vs 时间散点图 |

### 运动模式

- **跑步模式** — 红色主题（`#ff3366`）、/km 配速、SPM 步频、5K/10K/半马/全马预测、175 spm 训练提示
- **骑行模式** — 青色主题（`#06b6d4`）、km/h 速度、RPM 踏频、瓦特功率、40K/100K/160K/200K 预测、爬升效率分析
- **全部模式** — 中性主题，跑步 + 骑行合并统计并分别展示

### 后端优化

- **Strava API** — OAuth token 自动轮换、per_page=200 批量拉取、速率限制自动重试、统一缓存客户端（消除重复刷新）
- **线程安全地理编码** — 基于 `threading.Lock` 的内存缓存，精度约 1.1 km（Nominatim）
- **批量 SQL 查询** — 消除照片/路段加载中的 N+1 查询
- **FastAPI 安全加固** — CORS 限定方法/请求头，静态文件路径穿越防护
- **后台同步** — 每日午夜自动同步（时区可配置），照片同步（90 天窗口），路段数据补全

---

## 快速开始

### 方式 A — Docker（推荐）

```bash
git clone https://github.com/YourUsername/TrackRecord.git
cd TrackRecord
cp config-example.yaml run_page/settings.yaml   # 填写运动员配置
docker-compose up -d --build
```

访问 `http://localhost:8081` 即可打开仪表盘。

### 方式 B — 本地开发

```bash
pip install -r requirements.txt

# 首次运行时会交互式引导填写凭证
python running_page_menu.py

# 同时启动 API 服务器和前端开发服务器
python run_web.py
# API → http://localhost:8000
# UI  → http://localhost:3000
```

### Strava OAuth 配置

将 `.env.example` 复制为 `.env` 并填入 Strava 应用凭证：

```env
STRAVA_CLIENT_ID=你的_client_id
STRAVA_CLIENT_SECRET=你的_client_secret
STRAVA_REFRESH_TOKEN=你的_refresh_token
```

也可以在首次运行菜单时按提示交互输入，凭证会自动保存到 `run_page/credentials.json`。

---

## 配置说明

### `run_page/settings.yaml`

```yaml
athlete:
  name: "你的名字"
  weight: 70          # kg，用于卡路里估算
  max_hr: 190         # bpm，用于心率区间计算
  vo2_estimate: 58.0  # 可选，手动指定 VO₂max

gears:
  - name: "Tarmac SL8"
    type: "Ride"
    limit: 8000        # 触发保养提醒的里程阈值 (km)
  - name: "Adidas Adizero"
    type: "Run"
    limit: 800

heart_rate_zones:
  z1: [0, 130]
  z2: [130, 152]
  z3: [152, 162]
  z4: [162, 174]
  z5: [174, 999]

riegel_exponents:
  run: 1.06   # Riegel 公式指数（跑步）
  ride: 1.05  # Riegel 公式指数（骑行）
```

| 配置项 | 位置 | 默认值 |
|--------|------|--------|
| API 端口 | `config.py` / `API_PORT` 环境变量 | 8000 |
| 前端端口 | `config.py` / `FRONTEND_PORT` 环境变量 | 3000 |
| 数据库路径 | `DB_PATH` 环境变量 | `run_page/data.db` |
| 时区 | `config.py` | `Asia/Shanghai` |
| 启动时同步 | `SYNC_ON_STARTUP` 环境变量 | `true` |

---

## 项目架构

```
run_page/
├── web_api.py          # FastAPI 应用，CORS，SPA 兜底路由，生命周期管理
├── config.py           # 端口、路径、时区等常量
├── db.py               # SQLAlchemy 模型 + 线程安全地理编码缓存
├── auth.py             # 三级凭证查找：环境变量 → credentials.json → 交互输入
├── generator.py        # Strava 同步编排器（含速率限制重试）
├── routers/            # /api/v1/* 路由处理器
│   ├── stats.py        # 主数据接口（CTL/ATL/TSB、纪录、热力图等）
│   ├── sync.py         # 手动同步触发 + 状态查询
│   ├── segments.py     # KOM/QOM 路段数据
│   ├── photos.py       # 照片列表 + 后台同步
│   └── challenges.py   # 奖杯导入 + 月度展示
├── services/
│   ├── strava_service.py   # 统一 Strava 客户端（TTL token 缓存）
│   ├── cache_service.py    # Stats 响应内存缓存
│   └── sync_service.py     # 后台同步任务 + 自动午夜定时器
└── platforms/          # 26 个平台同步脚本（strava、garmin、keep 等）

dashboard/src/
├── App.jsx             # 根组件：运动模式状态、键盘快捷键（'k'）
├── hooks/useStats.js   # API 请求 + 客户端缓存
├── pages/              # 12 个页面组件（见上方功能表）
└── components/         # 侧边栏、Header、运动类型筛选器
```

---

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| API | FastAPI、Python 3.10+、SQLAlchemy、SQLite |
| 前端 | React 19、Vite 8、Framer Motion、Recharts、Leaflet |
| 数据同步 | stravalib、requests、asyncio 后台任务 |
| 部署 | Docker Compose、多阶段构建 |

---

## 支持平台

Strava · Garmin · Nike Run Club · Keep · Coros · Suunto · Polar · Concept2 · 行者 · 悦跑圈 · 以及更多（通过交互式同步菜单管理）

---

## 引用致谢

- **数据同步与导出逻辑**（GPX/TCX/FIT，不含行者）：衍生自 **yihong0618** 的 [running_page](https://github.com/yihong0618/running_page)
- **仪表盘设计灵感**：来源于 **robiningelbrecht** 的 [statistics-for-strava](https://github.com/robiningelbrecht/statistics-for-strava)

---

## 许可协议

本项目采用 **MIT 协议**，详见 [LICENSE](./LICENSE)。

*修改核心同步模块时，请务必遵守上述引用项目的开源许可要求。*
