import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.discoveryCache.deleteMany().then(()=>console.log('Cleared')).finally(()=>prisma.$disconnect());
