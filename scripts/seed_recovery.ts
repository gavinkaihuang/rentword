
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Create default user
    const user = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: 'hashed_password_placeholder', // You might want a real hash if using auth
            role: 'ADMIN'
        },
    });
    console.log('User created:', user);

    // Verify WordBooks exist
    const count = await prisma.wordBook.count();
    if (count === 0) {
        await prisma.wordBook.createMany({
            data: [
                { name: 'High School Words', displayMode: 1 },
                { name: 'GTP8000 Words', displayMode: 2 }
            ]
        });
        console.log('WordBooks created');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
