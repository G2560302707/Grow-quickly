import { PrismaClient } from "@prisma/client"
import { compare } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'admin@localhost' },
    })

    if (!user) {
        console.log("User not found")
        return
    }

    const isValid = await compare("123456", user.password)
    console.log("Password '123456' is valid:", isValid)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
