
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.user.count();
    console.log(`User count: ${count}`);

    if (count === 0) {
        console.log('No users found.');
    } else {
        const users = await prisma.user.findMany();
        users.forEach(u => console.log(`User: ${u.username} (Role: ${u.role})`));
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
