
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: npx ts-node scripts/reset_password.ts <username> <new_password>');
        process.exit(1);
    }

    const username = args[0];
    const passwordRaw = args[1];

    console.log(`Resetting password for user: ${username}...`);

    // Verify user exists
    const user = await prisma.user.findUnique({
        where: { username }
    });

    if (!user) {
        console.error(`Error: User '${username}' not found.`);
        process.exit(1);
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordRaw, salt);

    await prisma.user.update({
        where: { username },
        data: {
            password: hashedPassword
        }
    });

    console.log(`Success: Password for '${username}' has been updated.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
