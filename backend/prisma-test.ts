import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('PrismaClient model properties:', Object.keys(prisma)); 