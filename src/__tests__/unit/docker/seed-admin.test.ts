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

    it('restores admin role when user role was reset to user', async () => {
        const prisma = {
            user: {
                findUnique: vi.fn().mockResolvedValue({
                    email: 'admin@localhost',
                    role: 'user', // Role was reset by migration
                    isActive: true,
                    educationStage: 'senior_high',
                    enrollmentYear: 2024,
                }),
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
                role: 'admin', // Should restore admin role
                isActive: true,
                educationStage: 'senior_high',
                enrollmentYear: 2024,
            },
        });
    });

    it('reactivates admin when isActive was set to false', async () => {
        const prisma = {
            user: {
                findUnique: vi.fn().mockResolvedValue({
                    email: 'admin@localhost',
                    role: 'admin',
                    isActive: false, // Account was disabled
                    educationStage: 'junior_high',
                    enrollmentYear: 2025,
                }),
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
                isActive: true, // Should reactivate account
                educationStage: 'junior_high',
                enrollmentYear: 2025,
            },
        });
    });

    it('restores both role and isActive when both were corrupted', async () => {
        const prisma = {
            user: {
                findUnique: vi.fn().mockResolvedValue({
                    email: 'admin@localhost',
                    role: 'user', // Downgraded
                    isActive: false, // Disabled
                    educationStage: 'senior_high',
                    enrollmentYear: 2024,
                }),
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
                role: 'admin', // Restore admin role
                isActive: true, // Reactivate account
                educationStage: 'senior_high',
                enrollmentYear: 2024,
            },
        });
    });
});
