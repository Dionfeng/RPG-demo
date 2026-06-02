# 地球Online：人生RPG

把日常当成一场 RPG：告示板任务、行路志、签到、问卷与六维属性成长。

## 本地运行

需要 Python 3（或任意静态 HTTP 服务）。**不要**直接双击打开 `index.html`，请用 HTTP 访问。

```bash
python -m http.server 5173
```

或在 Windows 下双击 `start-server.bat`，浏览器打开：

http://localhost:5173

## 数据说明

- 账号与存档保存在**本浏览器**的 `localStorage` 中。
- 换设备、换浏览器或清除站点数据后，存档不会自动同步。

## 可选：GitHub Pages

仓库 Settings → Pages → 从 `main` 分支根目录部署，即可通过 `https://<用户名>.github.io/<仓库名>/` 访问。
