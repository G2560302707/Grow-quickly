import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@localhost';
    const password = '123456';
    const name = 'Admin';

    console.log(`Checking admin user: ${email}...`);

    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        console.log(`Admin user already exists. Skipping creation.`);
        return;
    }

    console.log(`Admin user not found. Creating...`);
    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name,
            role: 'admin',
            isActive: true,
        },
    });

    console.log(`\nSuccess! Admin user created.`);
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
