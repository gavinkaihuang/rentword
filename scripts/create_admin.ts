
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking for admin user...');

    const username = 'admin';
    const passwordRaw = '1234567890';

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordRaw, salt);

    const user = await prisma.user.upsert({
        where: { username },
        update: {
            password: hashedPassword,
            role: 'ADMIN' // Ensure role is ADMIN
        },
        create: {
            username,
            password: hashedPassword,
            role: 'ADMIN'
        }
    });

    console.log(`User '${user.username}' (ID: ${user.id}) upserted successfully.`);
    console.log('Password reset to: ' + passwordRaw);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
