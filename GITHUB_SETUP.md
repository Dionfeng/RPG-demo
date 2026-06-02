# 上传到 GitHub（一次性设置）

本地仓库已初始化并完成首次提交。按下面步骤把代码推到你的 GitHub。

## 1. 登录 GitHub CLI

在终端执行（会打开浏览器完成登录）：

```powershell
gh auth login
```

建议选择：GitHub.com → HTTPS → Login with a web browser。

## 2. 创建仓库并推送

在项目目录执行：

```powershell
cd "c:\Users\DELL\Desktop\rpg人生"
gh repo create earth-online-rpg --public --source=. --remote=origin --push
```

若仓库名要改成别的，把 `earth-online-rpg` 换成你的名称。

若远程仓库**已手动创建**（空仓库），改用：

```powershell
git remote add origin https://github.com/你的用户名/earth-online-rpg.git
git push -u origin main
```

## 3. 开启 GitHub Pages（可选，公网访问）

1. 打开仓库 → **Settings** → **Pages**
2. Source：**Deploy from a branch**
3. Branch：`main`，文件夹 **`/ (root)`**
4. 保存后等待 1～3 分钟

访问地址：`https://你的用户名.github.io/earth-online-rpg/`

## 4. 验证

- GitHub 仓库中能看到 `index.html`、`js/`、`css/`、`README.md`
- Pages 打开后应用可加载（需能访问 Google 字体 CDN）
