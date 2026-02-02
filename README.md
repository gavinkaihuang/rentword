This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.


## 升级系统备份数据

For other servers: Please prevent data loss by:

Backing up your prisma/dev.db file (or your production database) BEFORE running any commands.
Using npx prisma db push (as suggested in the upgrade doc) is generally safe for SQLite if you are just adding fields, but always backup first.
Avoiding npx prisma migrate reset or npx prisma db push --force-reset unless you intend to wipe data.


## Run this command to reset the admin password to 1234567890:

bash
npx ts-node scripts/create_admin.ts

## 重置其他用户密码
Usage:

bash
npx ts-node scripts/reset_password.ts <username> <new_password>
Example:

bash
npx ts-node scripts/reset_password.ts alice 123456


## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

2026-02-03
添加高中词书的单词分类 docs/high_school_words_enriched.json