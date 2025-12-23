-- CreateTable
CREATE TABLE "Word" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spelling" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordId" INTEGER NOT NULL,
    "proficiency" INTEGER NOT NULL DEFAULT 0,
    "nextReviewDate" DATETIME,
    "lastReviewed" DATETIME,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_wordId_key" ON "UserProgress"("wordId");
