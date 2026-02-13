import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  analyzeCategoryDemand, 
  storeDemandAnalysis, 
  getLastDemandAnalysis,
  type DemandAnalysis 
} from '@/lib/demand-pricing';

export const dynamic = 'force-dynamic';

// GET - Fetch current or last demand analysis
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

    let analysis: DemandAnalysis | null;

    if (refresh) {
      // Run fresh analysis
      analysis = await analyzeCategoryDemand();
    } else {
      // Try to get cached analysis first
      analysis = await getLastDemandAnalysis();
      
      // If no cached analysis or it's older than 24 hours, refresh
      if (!analysis || isAnalysisStale(analysis.analyzedAt)) {
        analysis = await analyzeCategoryDemand();
      }
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Demand analysis error:', error);
    return NextResponse.json(
      { error: 'Talep analizi yapılamadı' },
      { status: 500 }
    );
  }
}

// POST - Run and store demand analysis (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const prisma = (await import('@/lib/db')).default;
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    });

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 });
    }

    // Run fresh analysis
    const analysis = await analyzeCategoryDemand();
    
    // Store for caching
    await storeDemandAnalysis(analysis);

    return NextResponse.json({
      success: true,
      message: 'Talep analizi güncellendi',
      analysis
    });
  } catch (error) {
    console.error('Demand analysis update error:', error);
    return NextResponse.json(
      { error: 'Talep analizi güncellenemedi' },
      { status: 500 }
    );
  }
}

function isAnalysisStale(analyzedAt: Date | string): boolean {
  const analysisDate = new Date(analyzedAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - analysisDate.getTime()) / (1000 * 60 * 60);
  return hoursDiff > 24;
}
