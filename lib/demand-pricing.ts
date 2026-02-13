import prisma from '@/lib/db';

export interface CategoryDemand {
  categoryId: string;
  categoryName: string;
  totalViews: number;
  totalProducts: number;
  completedSwaps: number;
  avgViewsPerProduct: number;
  demandScore: number; // 0-100
  priceMultiplier: number; // 0.8 - 1.3
  trend: 'rising' | 'stable' | 'falling';
}

export interface DemandAnalysis {
  analyzedAt: Date;
  categories: CategoryDemand[];
  globalStats: {
    totalViews: number;
    totalSwaps: number;
    avgDemandScore: number;
  };
}

// Calculate demand score for each category based on last 7 days activity
export async function analyzeCategoryDemand(): Promise<DemandAnalysis> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Get all categories with their products
  const categories = await prisma.category.findMany({
    include: {
      products: {
        where: { status: 'active' },
        select: {
          id: true,
          views: true,
          createdAt: true,
        }
      }
    }
  });

  // Get completed swaps in last week
  const recentSwaps = await prisma.swapRequest.findMany({
    where: {
      status: 'completed',
      updatedAt: { gte: oneWeekAgo }
    },
    include: {
      product: {
        select: { categoryId: true }
      }
    }
  });

  // Count swaps per category
  const swapsByCategory: Record<string, number> = {};
  recentSwaps.forEach((swap: { product: { categoryId: string } }) => {
    const catId = swap.product.categoryId;
    swapsByCategory[catId] = (swapsByCategory[catId] || 0) + 1;
  });

  // Calculate global stats
  let totalViews = 0;
  let totalProducts = 0;
  categories.forEach((cat: { products: { views: number }[] }) => {
    cat.products.forEach((p: { views: number }) => {
      totalViews += p.views;
      totalProducts++;
    });
  });

  const avgViewsPerProduct = totalProducts > 0 ? totalViews / totalProducts : 0;
  const totalSwaps = recentSwaps.length;

  // Analyze each category
  const categoryDemands: CategoryDemand[] = categories.map((category: { id: string; name: string; products: { views: number }[] }) => {
    const categoryViews = category.products.reduce((sum: number, p: { views: number }) => sum + p.views, 0);
    const productCount = category.products.length;
    const categorySwaps = swapsByCategory[category.id] || 0;
    const avgViews = productCount > 0 ? categoryViews / productCount : 0;

    // Calculate demand score (0-100)
    // Based on: views vs average, swap rate, product availability
    let demandScore = 50; // baseline

    // View factor: if category views are above average, increase score
    if (avgViewsPerProduct > 0) {
      const viewFactor = avgViews / avgViewsPerProduct;
      demandScore += (viewFactor - 1) * 20; // +-20 points based on views
    }

    // Swap factor: more swaps = higher demand
    const swapRate = productCount > 0 ? categorySwaps / productCount : 0;
    demandScore += swapRate * 30; // up to 30 points for high swap rate

    // Scarcity factor: fewer products with high views = higher demand
    if (productCount < 5 && categoryViews > avgViewsPerProduct * 2) {
      demandScore += 15;
    }

    // Clamp score to 0-100
    demandScore = Math.max(0, Math.min(100, demandScore));

    // Calculate price multiplier based on demand score
    // Score 0 = 0.8x, Score 50 = 1.0x, Score 100 = 1.3x
    let priceMultiplier = 1.0;
    if (demandScore < 50) {
      priceMultiplier = 0.8 + (demandScore / 50) * 0.2; // 0.8 to 1.0
    } else {
      priceMultiplier = 1.0 + ((demandScore - 50) / 50) * 0.3; // 1.0 to 1.3
    }

    // Determine trend
    let trend: 'rising' | 'stable' | 'falling' = 'stable';
    if (demandScore > 65) trend = 'rising';
    else if (demandScore < 35) trend = 'falling';

    return {
      categoryId: category.id,
      categoryName: category.name,
      totalViews: categoryViews,
      totalProducts: productCount,
      completedSwaps: categorySwaps,
      avgViewsPerProduct: avgViews,
      demandScore: Math.round(demandScore),
      priceMultiplier: Math.round(priceMultiplier * 100) / 100,
      trend
    };
  });

  return {
    analyzedAt: new Date(),
    categories: categoryDemands.sort((a, b) => b.demandScore - a.demandScore),
    globalStats: {
      totalViews,
      totalSwaps,
      avgDemandScore: Math.round(
        categoryDemands.reduce((sum, c) => sum + c.demandScore, 0) / categoryDemands.length
      )
    }
  };
}

// Get demand multiplier for a specific category
export async function getCategoryDemandMultiplier(categoryId: string): Promise<number> {
  const analysis = await analyzeCategoryDemand();
  const category = analysis.categories.find(c => c.categoryId === categoryId);
  return category?.priceMultiplier || 1.0;
}

// Apply demand-based price adjustment to AI-suggested price
export function adjustPriceForDemand(basePrice: number, demandMultiplier: number): number {
  return Math.round(basePrice * demandMultiplier);
}

// Store demand analysis for historical tracking
export async function storeDemandAnalysis(analysis: DemandAnalysis): Promise<void> {
  // Store in SystemMetrics or a dedicated table
  await prisma.systemMetrics.upsert({
    where: { id: 'demand_analysis' },
    update: {
      data: JSON.stringify(analysis),
      lastUpdated: new Date()
    },
    create: {
      id: 'demand_analysis',
      data: JSON.stringify(analysis),
      lastUpdated: new Date()
    }
  });
}

// Get last demand analysis
export async function getLastDemandAnalysis(): Promise<DemandAnalysis | null> {
  const metric = await prisma.systemMetrics.findUnique({
    where: { id: 'demand_analysis' }
  });
  
  if (!metric?.data) return null;
  
  try {
    return JSON.parse(metric.data) as DemandAnalysis;
  } catch {
    return null;
  }
}
