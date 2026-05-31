import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('seed-admin docker helper', () => {
    it('creates the default admin user when it does not exist', async () => {
        const createdUsers: unknown[] = [];
        const prisma = {
            user: {
                findUnique: vi.fn().mockResolvedValue(null),
                create: vi.fn().mockImplementation(async ({ data }) => {
                    createdUsers.push(data);
                    return { email: data.email };
                }),
                update: vi.fn(),
            },
        };
        const hash = vi.fn().mockResolvedValue('hashed-password');
        const { seedAdmin } = require('../../../../scripts/seed-admin.js');

        const result = await seedAdmin({ prisma, hash });

        expect(result).toEqual({ action: 'created', email: 'admin@localhost' });
        expect(hash).toHaveBeenCalledWith('123456', 12);
        expect(prisma.user.create).toHaveBeenCalledWith({
            data: {
                email: 'admin@localhost',
                password: 'hashed-password',
                name: 'Admin',
                role: 'admin',
                isActive: true,
                educationStage: 'junior_high',
                enrollmentYear: 2025,
            },
        });
        expect(createdUsers).toHaveLength(1);
    });

    it('updates default education fields when the admin user already exists', async () => {
        const prisma = {
            user: {
                findUnique: vi.fn().mockResolvedValue({ email: 'admin@localhost', educationStage: 'senior_high', enrollmentYear: 2024 }),
                create: vi.fn(),
                update: vi.fn().mockResolvedValue({ email: 'admin@localhost' }),
            },
        };
        const hash = vi.fn();
        const { seedAdmin } = require('../../../../scripts/seed-admin.js');

        const result = await seedAdmin({ prisma, hash });

        expect(result).toEqual({ action: 'updated', email: 'admin@localhost' });
        expect(hash).not.toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { email: 'admin@localhost' },
            data: {
                role: 'admin',
                isActive: true,
                educationStage: 'senior_high',
                enrollmentYear: 2024,
            },
        });
    });

    it('preserves existing education fields when admin user has them set', async () => {
        const prisma = {
            user: {
                findUnique: vi.fn().mockResolvedValue({ email: 'admin@localhost' }),
                create: vi.fn(),
                update: vi.fn().mockResolvedValue({ email: 'admin@localhost' }),
            },
        };
        const hash = vi.fn();
        const { seedAdmin } = require('../../../../scripts/seed-admin.js');

        const result = await seedAdmin({ prisma, hash });

        expect(result).toEqual({ action: 'updated', email: 'admin@localhost' });
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { email: 'admin@localhost' },
            data: {
                role: 'admin',
                isActive: true,
                educationStage: 'junior_high',
                enrollmentYear: 2025,
            },
        });
    });
});
