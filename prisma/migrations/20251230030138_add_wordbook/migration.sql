-- CreateTable
CREATE TABLE "WordBook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Word" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spelling" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "phonetic" TEXT,
    "grammar" TEXT,
    "example" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "wordBookId" INTEGER,
    CONSTRAINT "Word_wordBookId_fkey" FOREIGN KEY ("wordBookId") REFERENCES "WordBook" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Word" ("example", "grammar", "id", "meaning", "orderIndex", "phonetic", "spelling") SELECT "example", "grammar", "id", "meaning", "orderIndex", "phonetic", "spelling" FROM "Word";
DROP TABLE "Word";
ALTER TABLE "new_Word" RENAME TO "Word";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
