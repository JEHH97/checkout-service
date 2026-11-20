import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();
async function seed() {
  const passwordHash = await bcrypt.hash('DemoAdmin2026!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@example.test' },
    create: { email: 'admin@example.test', passwordHash, role: 'admin' },
    update: { passwordHash, role: 'admin' },
  });
  for (const product of [
    { name: 'Canvas Backpack', priceCents: 4800, available: 30 },
    { name: 'Desk Lamp', priceCents: 3200, available: 18 },
    { name: 'Ceramic Mug', priceCents: 1400, available: 50 },
  ]) {
    await prisma.product.upsert({
      where: { id: product.name.toLowerCase().replaceAll(' ', '-') },
      create: { id: product.name.toLowerCase().replaceAll(' ', '-'), ...product },
      update: product,
    });
  }
}
seed().finally(() => prisma.$disconnect());
