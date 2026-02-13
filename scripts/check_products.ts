import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const totalProducts = await prisma.product.count();
    const activeProducts = await prisma.product.count({ where: { status: 'ACTIVE' } });
    const recentProducts = await prisma.product.count({
      where: {
        createdAt: { gte: since },
        status: 'ACTIVE',
      },
    });
    
    console.log('Total products:', totalProducts);
    console.log('Active products:', activeProducts);
    console.log('Products added in last 24h:', recentProducts);
    
    // Get some recent products
    const recent = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
      }
    });
    
    console.log('\nMost recent products:');
    recent.forEach(p => {
      console.log(`- ${p.title} (${p.createdAt.toISOString()})`);
    });
    
  } finally {
    await prisma.$disconnect();
  }
}

main();
