import prisma from '@/lib/prisma';

export async function getActiveWordBookId(cookieStore: {
    get: (key: string) => { value: string } | undefined;
}) {
    const activeId = cookieStore.get('active_wordbook_id')?.value;
    const parsedId = activeId ? parseInt(activeId, 10) : NaN;

    if (!Number.isNaN(parsedId) && parsedId > 0) {
        const existingBook = await prisma.wordBook.findUnique({
            where: { id: parsedId },
            select: { id: true }
        });

        if (existingBook) {
            return existingBook.id;
        }
    }

    const firstBook = await prisma.wordBook.findFirst({
        orderBy: { id: 'asc' },
        select: { id: true }
    });

    return firstBook?.id ?? 1;
}
