# TrackRecord - 个人运动数据同步与导出工具

> [!NOTE]
> 本项目是基于 [yihong0618/running_page](https://github.com/yihong0618/running_page) 的分支与增强版本，目前已精简为纯终端运行的数据同步与导出工具箱。

<p align="center">
  <img width="150" src="https://raw.githubusercontent.com/shaonianche/gallery/master/running_page/running_page_logo.png" />
</p>

## 🍱✨ 核心特性

TrackRecord 提供了一套强大的工具，用于在本地管理您的运动数据：

*   **可视化交互菜单**：只需运行 `python running_page_menu.py` 即可进入控制中心，告别复杂的命令行参数。
*   **凭证管理系统**：自动记录并填充您的账号、Token 和密码，实现真正的一键同步。
*   **A -> B 跨平台镜像**：支持账号直接互传（例如 Nike 转 Strava, Keep 转 Strava, Strava 转佳明等）。
*   **深度同步脚本**：完美支持行者（自动登录）、Keep、悦跑圈、Nike、佳明（国区/国际）、Strava、高跑等主流平台。
*   **本地数据中心**：所有运动记录存入本地 SQLite 数据库，并提供精美的终端统计报表。
*   **全格式导出**：同步时自动生成 GPX/TCX/FIT 轨迹文件到本地目录。

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动控制中心 (推荐)

在项目根目录运行：

```bash
python running_page_menu.py
```

按照菜单提示操作即可。您可以轻松连接各个运动平台，或者在不同服务之间迁移活动记录。

## 📁 项目结构

项目目录经过重构，逻辑更加清晰：

- `run_page/`：核心逻辑与数据存储。
    - `platforms/`：各运动平台的具体同步脚本。
    - `tools/`：维护工具（佳明 Secret 获取、数据库修复等）。
    - `data.db`：保存所有运动数据的 SQLite 数据库。
- `GPX_OUT/`, `TCX_OUT/`, `FIT_OUT/`：自动导出的各类运动轨迹文件目录。
- `activities/`：原始运动详情存储。

## 🙏 特别感谢

本项目之所以能存在，完全仰仗于 **[yihong0618](https://github.com/yihong0618)** 及其开源项目 **[running_page](https://github.com/yihong0618/running_page)**。

---

## 📜 开源协议

基于原项目协议。请继续尊重并保留原作者 [yihong0618](https://github.com/yihong0618) 的版权声明。

---

> “路就在脚下，出发，永远比向往更有意义。”
