
# 数据库更新与字段扩充指南 (Safe Update)

本指南用于将 `high_school_words_enriched.json` 中的增强数据（词根、易混词、近义词等）同步到生产数据库中。

**更新策略：** 使用非破坏性同步脚本。脚本会根据**词书名称** ("High School Words") 和**单词拼写**进行匹配更新。如果单词不存在则会新增。**此操作不会影响其他词书（如 GPT-8000）的数据。**

## 1. 变更内容

### 数据库结构 (Schema)
- 在 `Word` 表中新增了 `confusables` 字段（String 类型，存储 JSON 字符串）。

### 数据来源 (Source)
- `docs/high_school_words_enriched.json` (共 3821 个单词)
- 对应生成/更新词书：**High School Words**

## 2. 本地准备工作 (已完成)

我已经在本地完成了以下操作：
1. 修改了 `prisma/schema.prisma` 添加新字段。
2. 生成了数据库迁移文件 `prisma/migrations/20260202143837_add_confusables`。
3. 创建了安全同步脚本 `scripts/sync_hs_words.ts`。

## 3. 服务器升级步骤

请按顺序执行以下操作：

### 第一步：代码同步
将最新的代码（包含 migration 文件夹和 scripts 文件夹）推送到服务器。
确保 `docs/high_school_words_enriched.json` 文件也在服务器上。

```bash
git pull origin main
npm install
```

### 第二步：数据库备份 (建议)
尽管本次脚本是安全的，但在生产环境执行 Schema 变更前备份总是好习惯。

```bash
cp dev.db dev.db.bak_$(date +%Y%m%d)
```

### 第三步：应用数据库结构变更
执行 Prisma 迁移命令。

```bash
npx prisma migrate deploy
```

### 第四步：执行高中单词同步脚本
运行脚本，将 JSON 数据同步到数据库。

```bash
npx tsx scripts/sync_hs_words.ts
```

*脚本逻辑说明：*
- 自动查找或创建 "High School Words" 词书。
- 遍历 JSON 中的单词，根据拼写在数据库中查找。
- **存在则更新**：更新词根、易混词等增强字段。
- **不存在则创建**：新增该单词。
- **不影响其他数据**：GPT-8000 等其他词书的数据完全不受影响。

### 第五步：验证
脚本运行结束后会显示 `Updated` 和 `Created` 的数量。
```
Sync Complete!
Created: 0
Updated: 3821
Total active in book: 3821
```

## 4. 常见问题
- **执行时间**: 由于是逐条比对更新，3800个单词可能通过需要几秒到十几秒。
