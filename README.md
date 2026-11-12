# 词小读 · 网站试用版

保留教材：必修第一册、必修第二册、必修第三册、选择性必修第一册、选择性必修第二册、选择性必修第三册、选择性必修第四册。

保留查词、例句配图、单词听写、单词跟读、课文晨读、教材原页和原声、逐句跟读、自定义课文、对话记录、看图选词、单词消消乐和双组 PK。

所有音频均为原文件，未转码、未剪辑；学习记录仍保存在当前浏览器。

## 发布到 GitHub Pages

将本目录内的全部文件（包括 .nojekyll）推送至公开仓库 main 分支。
在仓库 Settings → Pages → Build and deployment 中，将 Source 设为 Deploy from a branch，分支 main、目录 / (root)。
主站预期地址：https://zuoerfeng.github.io/cixiaodu/ 。以部署任务实际返回的地址为准。

音频存放在同账号的 cixiaodu-audio 仓库，网页从 `/cixiaodu-audio/` 加载。先部署音频仓库，再部署主站。

更新网站时推送 main 分支即可触发部署。不要把整个离线包作为本网站仓库上传。

## 本地预览

在两个仓库目录的共同上级运行 `python3 ../tools/preview_github_pages.py`，浏览器访问 http://localhost:8000/cixiaodu/ 。

## 资源来源

保留 arasaac-audit/README.txt、ecdict/LICENSE.txt、examples/LICENSE-AND-SOURCES.txt、pep-vocab/README.txt 和 gaokao-vocab/README.txt 中的来源与许可。
