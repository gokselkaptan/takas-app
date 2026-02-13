import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const statuses = await prisma.product.groupBy({
      by: ['status'],
      _count: true,
    });
    
    console.log('Product statuses:');
    statuses.forEach(s => {
      console.log(`- ${s.status}: ${s._count} products`);
    });
    
    // Get a sample product
    const sample = await prisma.product.findFirst({
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      }
    });
    
    console.log('\nSample product:', sample);
    
  } finally {
    await prisma.$disconnect();
  }
}

main();
