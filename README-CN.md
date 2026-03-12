# TrackRecord - 打造您的个人运动主页

> [!NOTE]
> 本项目是基于 [yihong0618/running_page](https://github.com/yihong0618/running_page) 的分支与增强版本。

<p align="center">
  <img width="150" src="https://raw.githubusercontent.com/shaonianche/gallery/master/running_page/running_page_logo.png" />
</p>

# [打造个人运动数据主页](https://github.com/TrojanFish/TrackRecord)

[English](README.md) | 简体中文 | [Wiki](https://mfydev.github.io/Running-Page-Wiki/)

## 🍱✨ 新特性 (TrackRecord 增强版)

在原版强大的功能基础上，我们进行了以下深度改造：

*   **交互式同步菜单**：不再需要复杂的命令行参数！只需运行 `python running_page_menu.py` 即可在可视化菜单中一键同步各平台数据（支持行者、Keep、咕咚等）。
*   **行者 (Xingzhe) 完美同步**：
    *   **一键登录**：支持最新的 RSA 加密自动登录，彻底告别繁琐的 Session 抓包。
    *   **轨迹导出**：支持同步时自动生成 GPX 轨迹文件到 `GPX_OUT` 目录。
    *   **智能 ID 提取**：自动处理行者最新的 API 响应结构，获取用户信息更精准。
*   **现代 UI 与体验**：
    *   精心优化的视觉样式（基于 TrackRecord 现代设计）。
    *   更流畅的骑行、跑步及多类型运动数据展示。
    *   移除了失效或不稳定的同步模块（如旧版咕咚/行者）。

## 🙏 特别感谢

本项目之所以能存在，完全仰仗于 **[yihong0618](https://github.com/yihong0618)** 及其开源项目 **[running_page](https://github.com/yihong0618/running_page)**。

感谢原作者为社区提供了一个如此优雅、强大且易于扩展的运动数据展示方案。TrackRecord 旨在原版的基础上，通过优化交互体验和维护特定平台（如行者）的同步稳定性，为用户提供更好的使用感受。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 同步数据 (推荐方式)

我们为用户提供了最便捷的同步方式。只需在项目根目录运行：

```bash
python running_page_menu.py
```

按照菜单提示操作即可。无论是输入账号密码自动登录，还是使用高级 Session 模式，菜单都能引导您完成。

### 3. 本地开发与预览

```bash
npm install
npm run dev
```

---

## 🛠️ 技术细节与配置

> [!IMPORTANT]
> **Mapbox Token 安全提示**
>
> 默认情况下，本项目使用 **MapCN (免费/无需 token)**。
> 如果您希望使用 Mapbox，请务必在 `src/utils/const.ts` 中配置您 **自己的 [Mapbox Token](https://www.mapbox.com/)**。
> **请勿**在 Git 提交中包含您的私有 Token。

### 手动同步 (CLI 模式)

如果您习惯使用原版的 CLI 模式，新的行者同步脚本支持以下用法：

```bash
# 自动登录模式
python run_page/xingzhe_sync.py --account "你的手机号" --password "你的密码" --with-gpx

# 手动 Session 模式 (备用)
python run_page/xingzhe_sync.py --session "sessionidValue" --user-id 12345 --with-gpx
```

---

## 🏗️ 部署指南

### 使用 Vercel 部署

1. Fork 本仓库。
2. 在 Vercel 中新建项目，框架选择 **Vite** (注：旧版 Fork 用户如果之前是 Gatsby，请务必切换为 Vite)。
3. 配置好您的 GitHub Actions 以实现自动定时同步。

---

## 📜 开源协议

基于原项目协议。请继续尊重并保留原作者 [yihong0618](https://github.com/yihong0618) 的版权声明。

---

> “路就在脚下，出发，永远比向往更有意义。”
