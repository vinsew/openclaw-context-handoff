# Release Guide

## 发布原则 | Release Principle

每一次新版本发布说明都必须采用中英双语。

Every new release note must be written in both Chinese and English.

## 标准发布清单 | Standard Release Checklist

1. 更新代码和文档。  
   Update code and docs.
2. 更新 [CHANGELOG.md](../CHANGELOG.md)，用中英双语写本次变更。  
   Update [CHANGELOG.md](../CHANGELOG.md) with bilingual notes for the release.
3. 同步更新 `package.json` 和 `openclaw.plugin.json` 中的版本号。  
   Bump the versions in both `package.json` and `openclaw.plugin.json`.
4. 运行：
   Run:

```bash
npm pack --json
```

5. 发布：
   Publish:

```bash
npm publish --access public
```

6. 创建 GitHub release，并使用与 `CHANGELOG.md` 对应的中英双语说明。  
   Create a GitHub release and use bilingual notes matching `CHANGELOG.md`.

## 发布说明模板 | Release Notes Template

```md
## 中文

- 变更点 1
- 变更点 2

## English

- Change 1
- Change 2
```

## 备注 | Notes

- npm 包名 / npm package: `openclaw-context-handoff`
- 内部插件 ID / internal plugin id: `openclaw-context-handoff`
- README、CHANGELOG 和 GitHub release 说明要保持同步  
  Keep README, CHANGELOG, and GitHub release notes aligned.
