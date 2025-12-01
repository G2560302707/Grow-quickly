import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'admin@localhost'
    const password = '123456' // Default password, should be changed
    const hashedPassword = await hash(password, 12)

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            role: 'admin',
            isActive: true,
        },
        create: {
            email,
            password: hashedPassword,
            name: 'Admin',
            role: 'admin',
            isActive: true,
        },
    })

    console.log({ user })
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
