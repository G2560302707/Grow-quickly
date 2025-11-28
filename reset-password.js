const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log('Existing users:');
    users.forEach(u => console.log(`- ${u.email} (${u.name || 'No Name'})`));

    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
        console.log('\nUsage: node reset-password.js <email> <new_password>');
        return;
    }

    const hashedPassword = await hash(newPassword, 12);

    try {
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword },
        });
        console.log(`\nPassword for ${email} has been reset successfully.`);
    } catch (e) {
        console.error(`\nError resetting password: ${e.message}`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
