# 🚀 TrackRecord - 下一代运动数据可视化中台

<p align="center">
  <img src="https://img.shields.io/badge/后端-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/前端-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/数据库-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/部署-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

**TrackRecord** 是一款高性能的个人运动数据中台与可视化平台。它旨在帮助跑步与骑行爱好者自动同步跨平台数据，管理器材寿命，并通过极其精美的 Web 仪表盘和年度回顾报告探索数据深层价值。

---

## ✨ 核心特性

- **动态 Web 仪表盘**：基于 React & Vite 构建的现代化 UI，提供实时统计、月度趋势及训练负荷监控。
- **精美年度回顾 (Rewind)**：自动生成年度运动报告，包含足迹地图（自动清洗详细地址）、碳减排贡献及运动时段分布。
- **生理状态监控**：基于心率数据实时追踪 **TSB (训练压力平衡)**、**CTL (健身水平)** 和 **ATL (疲劳度)**。
- **器材策略管理**：精准追踪自行车零件（链条、外胎等）磨损状态，自动发出保养提醒。
- **跨平台多节点同步**：原生支持 Strava、Garmin、Nike、Keep、行者等平台的双向同步与活动镜像。

---

## 🚀 快速开始

### 1. 环境准备
- **Docker** & **Docker Compose**
- **Git**

### 2. 配置文件
将 [config-example.yaml](cci:7://file:///c:/Users/KeiyeeYu/Desktop/running_page/config-example.yaml:0:0-0:0) 复制为 [run_page/settings.yaml](cci:7://file:///c:/Users/KeiyeeYu/Desktop/running_page/run_page/settings.yaml:0:0-0:0) 并填写您的各项指标：
```yaml
athlete:
  name: "您的姓名"
  weight: 70
  max_hr: 190
  gears:
    - name: "Tarmac SL8"
      type: "Ride" # Gear 类型
      limit: 3000 # 需更换零件的行驶里程 (km)
```

### 3. 一键部署
```bash
git clone https://github.com/YourUsername/TrackRecord.git
cd TrackRecord
docker-compose up -d --build
```
访问 `http://localhost:5173` 即可查看您的专属看板。

---

## 🛠️ 功能模块说明

### 📈 训练负荷看板
通过后端路由 `/api/v1/stats` 提供深度的体能分析。
```json
// 数据输出示例
{
  "ctl": 45.2,  // 体能
  "atl": 38.5,  // 疲劳
  "tsb": 6.7,   // 状态
  "advice": "积极恢复 - 建议轻量化训练"
}
```

### 🔁 交互式同步菜单
无需记忆复杂的命令，通过轻量级菜单手动触发同步：
```bash
python running_page_menu.py
```

---

## 💻 技术实现与引用

本项目采用现代全栈架构：
- **后端**: FastAPI (Python 3.10+) 负责高性能异步 API 与数据聚合。
- **前端**: React 18 / Vite / Framer Motion 提供流畅交互体验。
- **存储**: SQLite 3 配合 SQLAlchemy ORM。

### 🔗 引用来源说明
本项目站在开源巨人的肩膀上，感谢以下项目的启发与贡献：

*   **数据同步与导出逻辑**：本项目中的核心运动数据导出功能（包含 GPX/TCX/FIT 生成逻辑，不包含行者部分）衍生自 **yihong0618** 的 [running_page](https://github.com/yihong0618/running_page)。
*   **设计与看板思路**：可视化的建模与 UI 呈现思路深受 **robiningelbrecht** 的 [statistics-for-strava](https://github.com/robiningelbrecht/statistics-for-strava) 启发。

---

## 🤝 参与贡献

1. Fork 本项目。
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)。
3. 提交您的修改 (`git commit -m 'Add some AmazingFeature'`)。
4. 推送到分支 (`git push origin feature/AmazingFeature`)。
5. 提交 Pull Request。

---

## 📜 许可协议

本项目采用 **MIT 协议**。详情请参阅 [LICENSE](cci:7://file:///c:/Users/KeiyeeYu/Desktop/running_page/LICENSE:0:0-0:0)。

*注意事项：在修改核心同步模块时，请务必尊重并遵守上述引用原始项目的开源许可要求。*
