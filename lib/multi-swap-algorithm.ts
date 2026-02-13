// Multi-Swap Algorithm v2.1
// Enhanced with: trust priority (20%), dynamic category bonus, parent category matching
// Features: value balance, location scoring, neighbor city support, trust filters

import prisma from './db'

// ========================
// CONFIGURATION CONSTANTS
// ========================

// Value tolerance for balance validation
const VALUE_TOLERANCE = 0.20 // ±%20 tolerance

// Optimized scoring weights (v2.1)
const SCORING_WEIGHTS = {
  valueBalance: 0.35,   // Değer dengesi - %35
  location: 0.40,       // Konum - %40
  trustScore: 0.20,     // Güven - %20 (artırıldı - kritik)
  categoryBonus: 0.05,  // Kategori eşleşmesi - %5
}

// Location scoring weights
const LOCATION_WEIGHTS = {
  sameDistrict: 1.0,    // Aynı ilçe - tam puan
  sameCity: 0.7,        // Aynı şehir - %70
  neighborCity: 0.5,    // Komşu şehir - %50
  differentCity: 0.2,   // Farklı şehir - %20
}

// Minimum trust score filter (Sybil resistance)
const MIN_TRUST_SCORE = 30  // Soft filter
const RECOMMENDED_TRUST_SCORE = 50  // For priority sorting

// Cycle length limits
const MIN_CYCLE_LENGTH = 3
const MAX_CYCLE_LENGTH = 5

// Expiration time in hours
const EXPIRATION_HOURS = 48

// Neighbor cities map (for location scoring)
const NEIGHBOR_CITIES: { [key: string]: string[] } = {
  'İzmir': ['Manisa', 'Aydın', 'Uşak', 'Balıkesir'],
  'Manisa': ['İzmir', 'Uşak', 'Aydın'],
  'Aydın': ['İzmir', 'Muğla', 'Denizli', 'Manisa'],
  'İstanbul': ['Kocaeli', 'Tekirdağ', 'Sakarya'],
  'Ankara': ['Eskişehir', 'Konya', 'Kırıkkale'],
}

// ========================
// TYPE DEFINITIONS
// ========================

interface SwapNode {
  userId: string
  userName: string
  userTrustScore: number
  userAccountAge: number // Days since registration
  productId: string
  productTitle: string
  productImage: string | null
  productValorPrice: number
  productLocation: string | null
  productCity: string | null
  productDistrict: string | null
  productCategoryId: string | null
  wantsProductId: string
  wantsProductOwnerId: string
  wantsProductValorPrice: number
}

interface SwapChain {
  participants: SwapNode[]
  chainLength: number
  isValueBalanced: boolean
  valueBalanceScore: number
  locationScore: number
  trustScore: number  // New: chain trust score
  categoryBonus: number  // New: category matching bonus
  totalScore: number
  averageValorPrice: number
  valueDifference: number
  qualityTier: 'excellent' | 'good' | 'fair' | 'poor'  // New: quality classification
}

interface MultiSwapOptions {
  onlyBalanced?: boolean
  minScore?: number
  minTrustScore?: number
  excludeUsers?: string[]  // For alternative cycle suggestions
  categoryFilter?: string  // Filter by specific category
}

// ========================
// SCORING FUNCTIONS
// ========================

/**
 * Calculate value balance score for a swap chain
 * Returns score between 0-100, where 100 is perfectly balanced
 */
function calculateValueBalance(participants: SwapNode[]): {
  isBalanced: boolean
  score: number
  averagePrice: number
  maxDifference: number
} {
  if (participants.length === 0) {
    return { isBalanced: false, score: 0, averagePrice: 0, maxDifference: 100 }
  }

  const prices = participants.map(p => p.productValorPrice)
  const totalValue = prices.reduce((sum, price) => sum + price, 0)
  const averagePrice = totalValue / participants.length

  if (averagePrice === 0) {
    // Tüm ürünler bedelsiz ise, dengeli kabul et
    return { isBalanced: true, score: 100, averagePrice: 0, maxDifference: 0 }
  }

  // Her ürünün ortalamadan sapmasını hesapla
  const deviations = prices.map(price => Math.abs((price - averagePrice) / averagePrice))
  const maxDeviation = Math.max(...deviations)
  const maxDifference = maxDeviation * 100

  // Tolerans kontrolü
  const isBalanced = maxDeviation <= VALUE_TOLERANCE

  // Skor hesaplama: 100 - (sapma * 500), min 0
  const score = Math.max(0, Math.round(100 - (maxDeviation * 500)))

  return {
    isBalanced,
    score,
    averagePrice: Math.round(averagePrice),
    maxDifference: Math.round(maxDifference)
  }
}

/**
 * Calculate location score for a swap chain (Enhanced v2.0)
 * Now includes neighbor city detection
 */
function calculateLocationScore(participants: SwapNode[]): number {
  if (participants.length < 2) return 100

  let totalScore = 0
  let pairCount = 0

  for (let i = 0; i < participants.length; i++) {
    const current = participants[i]
    const next = participants[(i + 1) % participants.length]

    const currentDistrict = current.productDistrict?.toLowerCase() || ''
    const nextDistrict = next.productDistrict?.toLowerCase() || ''
    const currentCity = current.productCity?.toLowerCase() || ''
    const nextCity = next.productCity?.toLowerCase() || ''

    let pairScore = LOCATION_WEIGHTS.differentCity

    if (currentDistrict && nextDistrict && currentDistrict === nextDistrict) {
      // Aynı ilçe
      pairScore = LOCATION_WEIGHTS.sameDistrict
    } else if (currentCity && nextCity) {
      if (currentCity === nextCity) {
        // Aynı şehir, farklı ilçe
        pairScore = LOCATION_WEIGHTS.sameCity
      } else if (areNeighborCities(currentCity, nextCity)) {
        // Komşu şehirler
        pairScore = LOCATION_WEIGHTS.neighborCity
      }
    }

    totalScore += pairScore
    pairCount++
  }

  return Math.round((totalScore / pairCount) * 100)
}

/**
 * Check if two cities are neighbors
 */
function areNeighborCities(city1: string, city2: string): boolean {
  const normalizedCity1 = normalizeCity(city1)
  const normalizedCity2 = normalizeCity(city2)
  
  const neighbors = NEIGHBOR_CITIES[normalizedCity1] || []
  return neighbors.some(n => normalizeCity(n) === normalizedCity2)
}

/**
 * Normalize city name for comparison
 */
function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/\u0131/g, 'i')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim()
}

/**
 * Calculate trust score for a swap chain (Enhanced v2.0)
 * Now returns normalized score and checks minimum threshold
 */
function calculateChainTrustScore(participants: SwapNode[]): {
  score: number
  meetsMinimum: boolean
  belowThresholdCount: number
} {
  if (participants.length === 0) {
    return { score: 0, meetsMinimum: false, belowThresholdCount: 0 }
  }

  const trustScores = participants.map(p => Math.min(100, p.userTrustScore))
  const totalTrust = trustScores.reduce((sum, score) => sum + score, 0)
  const averageScore = Math.round(totalTrust / participants.length)
  
  // Check how many participants are below minimum
  const belowThresholdCount = trustScores.filter(s => s < MIN_TRUST_SCORE).length
  const meetsMinimum = belowThresholdCount === 0

  return {
    score: averageScore,
    meetsMinimum,
    belowThresholdCount
  }
}

/**
 * Calculate category bonus (v2.1)
 * Dynamic bonus: same category +100, similar/2 categories +50, 3 categories +25
 */
function calculateCategoryBonus(participants: SwapNode[]): number {
  const categories = participants
    .map(p => p.productCategoryId)
    .filter((c): c is string => c !== null && c !== undefined)

  if (categories.length === 0) return 0

  const uniqueCategories = new Set(categories)
  const categoryCount = uniqueCategories.size
  
  // Check for parent category similarity (e.g., all electronics subtypes)
  const parentCategories = categories.map(c => c.split('-')[0])
  const uniqueParents = new Set(parentCategories)

  // Dynamic bonus calculation (v2.1)
  if (categoryCount === 1) return 100  // Tüm ürünler aynı kategori
  if (uniqueParents.size === 1) return 75  // Aynı ana kategori (örn: elektronik alt kategorileri)
  if (categoryCount === 2) return 50   // 2 farklı kategori
  if (categoryCount === 3) return 25   // 3 farklı kategori
  return 0  // 4+ farklı kategori
}

/**
 * Calculate total quality score for a swap chain (v2.0 formula)
 */
function calculateTotalScore(
  valueScore: number,
  locationScore: number,
  trustScore: number,
  categoryBonus: number
): number {
  return Math.round(
    valueScore * SCORING_WEIGHTS.valueBalance +
    locationScore * SCORING_WEIGHTS.location +
    trustScore * SCORING_WEIGHTS.trustScore +
    categoryBonus * SCORING_WEIGHTS.categoryBonus
  )
}

/**
 * Classify chain quality tier
 */
function getQualityTier(totalScore: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (totalScore >= 80) return 'excellent'
  if (totalScore >= 60) return 'good'
  if (totalScore >= 40) return 'fair'
  return 'poor'
}

// ========================
// GRAPH BUILDING
// ========================

/**
 * Build a graph of swap requests (Enhanced v2.0)
 * Now includes account age and enhanced filtering
 */
export async function buildSwapGraph(options: {
  minTrustScore?: number
  excludeUsers?: string[]
} = {}): Promise<Map<string, SwapNode[]>> {
  const { minTrustScore = 0, excludeUsers = [] } = options

  // Get all pending swap requests with enhanced data
  const swapRequests = await prisma.swapRequest.findMany({
    where: { 
      status: 'pending',
      requesterId: { notIn: excludeUsers }
    },
    include: {
      requester: {
        select: { 
          id: true, 
          name: true, 
          trustScore: true,
          createdAt: true  // For account age
        },
      },
      product: {
        select: { 
          id: true, 
          title: true, 
          images: true, 
          userId: true,
          valorPrice: true,
          city: true,
          district: true,
          categoryId: true,
        },
      },
    },
  })

  // Get requester products
  const requesterIds = [...new Set(swapRequests.map(r => r.requesterId))]
  const requesterProducts = await prisma.product.findMany({
    where: {
      userId: { in: requesterIds },
      status: 'active',
    },
    select: {
      id: true,
      title: true,
      images: true,
      valorPrice: true,
      city: true,
      district: true,
      userId: true,
      categoryId: true,
    },
  })

  // Create a map of userId -> first active product
  const userProductMap = new Map<string, typeof requesterProducts[0]>()
  for (const product of requesterProducts) {
    if (!userProductMap.has(product.userId)) {
      userProductMap.set(product.userId, product)
    }
  }

  const graph = new Map<string, SwapNode[]>()

  for (const request of swapRequests) {
    // Skip if requester has no products to offer
    const requesterProduct = userProductMap.get(request.requesterId)
    if (!requesterProduct) continue

    // Skip if trust score is too low (when filter is enabled)
    const trustScore = request.requester.trustScore || 100
    if (minTrustScore > 0 && trustScore < minTrustScore) continue

    // Calculate account age in days
    const accountAge = Math.floor(
      (Date.now() - new Date(request.requester.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Skip if account is too new (Sybil protection)
    if (accountAge < 7) continue

    const node: SwapNode = {
      userId: request.requesterId,
      userName: request.requester.name || 'Kullanıcı',
      userTrustScore: trustScore,
      userAccountAge: accountAge,
      productId: requesterProduct.id,
      productTitle: requesterProduct.title,
      productImage: requesterProduct.images?.[0] || null,
      productValorPrice: requesterProduct.valorPrice || 0,
      productLocation: requesterProduct.district 
        ? `${requesterProduct.district}, ${requesterProduct.city}`
        : requesterProduct.city,
      productCity: requesterProduct.city,
      productDistrict: requesterProduct.district,
      productCategoryId: requesterProduct.categoryId || null,
      wantsProductId: request.productId,
      wantsProductOwnerId: request.product.userId,
      wantsProductValorPrice: request.product.valorPrice || 0,
    }

    if (!graph.has(request.requesterId)) {
      graph.set(request.requesterId, [])
    }
    graph.get(request.requesterId)!.push(node)
  }

  return graph
}

// ========================
// CYCLE DETECTION (DFS)
// ========================

/**
 * Find all cycles in the swap graph using DFS (Enhanced v2.0)
 * Now includes full scoring and quality classification
 */
export function findSwapCycles(
  graph: Map<string, SwapNode[]>,
  minLength: number = MIN_CYCLE_LENGTH,
  maxLength: number = MAX_CYCLE_LENGTH,
  options: { onlyBalanced?: boolean; minScore?: number } = {}
): SwapChain[] {
  const { onlyBalanced = false, minScore = 0 } = options
  const rawCycles: { participants: SwapNode[], chainLength: number }[] = []
  const visited = new Set<string>()
  const recStack = new Set<string>()
  const path: SwapNode[] = []

  function dfs(userId: string, startUserId: string, depth: number): void {
    if (depth > maxLength) return

    const nodes = graph.get(userId)
    if (!nodes) return

    for (const node of nodes) {
      // Found a cycle back to start
      if (node.wantsProductOwnerId === startUserId && depth >= minLength - 1) {
        rawCycles.push({
          participants: [...path, node],
          chainLength: path.length + 1,
        })
        continue
      }

      // Skip if already in current path (to avoid non-simple cycles)
      if (recStack.has(node.wantsProductOwnerId)) continue

      // Continue DFS
      path.push(node)
      recStack.add(node.userId)
      dfs(node.wantsProductOwnerId, startUserId, depth + 1)
      path.pop()
      recStack.delete(node.userId)
    }
  }

  // Start DFS from each user
  for (const userId of graph.keys()) {
    if (!visited.has(userId)) {
      recStack.add(userId)
      dfs(userId, userId, 0)
      recStack.delete(userId)
      visited.add(userId)
    }
  }

  // Remove duplicate cycles
  const uniqueRawCycles = removeDuplicateCyclesRaw(rawCycles)
  
  // Calculate scores for each cycle (v2.0 enhanced scoring)
  const scoredCycles: SwapChain[] = uniqueRawCycles.map(rawCycle => {
    const valueBalance = calculateValueBalance(rawCycle.participants)
    const locationScore = calculateLocationScore(rawCycle.participants)
    const trustResult = calculateChainTrustScore(rawCycle.participants)
    const categoryBonus = calculateCategoryBonus(rawCycle.participants)
    
    const totalScore = calculateTotalScore(
      valueBalance.score,
      locationScore,
      trustResult.score,
      categoryBonus
    )

    return {
      ...rawCycle,
      isValueBalanced: valueBalance.isBalanced,
      valueBalanceScore: valueBalance.score,
      locationScore,
      trustScore: trustResult.score,
      categoryBonus,
      totalScore,
      averageValorPrice: valueBalance.averagePrice,
      valueDifference: valueBalance.maxDifference,
      qualityTier: getQualityTier(totalScore),
    }
  })

  // Filter cycles
  let filteredCycles = scoredCycles
  
  if (onlyBalanced) {
    filteredCycles = filteredCycles.filter(c => c.isValueBalanced)
  }
  
  if (minScore > 0) {
    filteredCycles = filteredCycles.filter(c => c.totalScore >= minScore)
  }

  // Sort by total score (best first)
  return filteredCycles.sort((a, b) => b.totalScore - a.totalScore)
}

/**
 * Remove duplicate raw cycles (rotations of the same cycle)
 */
function removeDuplicateCyclesRaw(
  cycles: { participants: SwapNode[], chainLength: number }[]
): { participants: SwapNode[], chainLength: number }[] {
  const seen = new Set<string>()
  const unique: { participants: SwapNode[], chainLength: number }[] = []

  for (const cycle of cycles) {
    const ids = cycle.participants.map((p) => p.userId)
    const minIdx = ids.indexOf(ids.reduce((a, b) => (a < b ? a : b)))
    const rotated = [...ids.slice(minIdx), ...ids.slice(0, minIdx)].join(',')

    if (!seen.has(rotated)) {
      seen.add(rotated)
      unique.push(cycle)
    }
  }

  return unique
}

// ========================
// PUBLIC API FUNCTIONS
// ========================

/**
 * Find multi-swap opportunities for a specific user (v2.0)
 */
export async function findMultiSwapOpportunities(
  userId: string,
  options: MultiSwapOptions = {}
): Promise<SwapChain[]> {
  const { 
    onlyBalanced = false, 
    minScore = 0,
    minTrustScore = MIN_TRUST_SCORE,
    excludeUsers = [],
    categoryFilter
  } = options
  
  const graph = await buildSwapGraph({ minTrustScore, excludeUsers })
  const allCycles = findSwapCycles(graph, MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH, {
    onlyBalanced,
    minScore
  })
  
  // Filter cycles that include the specified user
  let userCycles = allCycles.filter((cycle) =>
    cycle.participants.some((p) => p.userId === userId)
  )

  // Apply category filter if specified
  if (categoryFilter) {
    userCycles = userCycles.filter(cycle =>
      cycle.participants.some(p => p.productCategoryId === categoryFilter)
    )
  }

  return userCycles
}

/**
 * Get swap algorithm statistics (v2.0 enhanced)
 */
export async function getSwapAlgorithmStats(): Promise<{
  totalPendingRequests: number
  totalPossibleCycles: number
  balancedCycles: number
  unbalancedCycles: number
  averageChainLength: number
  averageValueScore: number
  averageLocationScore: number
  averageTrustScore: number
  qualityDistribution: { excellent: number; good: number; fair: number; poor: number }
}> {
  const graph = await buildSwapGraph()
  const allCycles = findSwapCycles(graph)
  
  const balancedCycles = allCycles.filter(c => c.isValueBalanced).length
  const unbalancedCycles = allCycles.length - balancedCycles
  
  const avgChainLength = allCycles.length > 0
    ? allCycles.reduce((sum, c) => sum + c.chainLength, 0) / allCycles.length
    : 0
    
  const avgValueScore = allCycles.length > 0
    ? allCycles.reduce((sum, c) => sum + c.valueBalanceScore, 0) / allCycles.length
    : 0
    
  const avgLocationScore = allCycles.length > 0
    ? allCycles.reduce((sum, c) => sum + c.locationScore, 0) / allCycles.length
    : 0

  const avgTrustScore = allCycles.length > 0
    ? allCycles.reduce((sum, c) => sum + c.trustScore, 0) / allCycles.length
    : 0

  // Quality distribution
  const qualityDistribution = {
    excellent: allCycles.filter(c => c.qualityTier === 'excellent').length,
    good: allCycles.filter(c => c.qualityTier === 'good').length,
    fair: allCycles.filter(c => c.qualityTier === 'fair').length,
    poor: allCycles.filter(c => c.qualityTier === 'poor').length,
  }

  // Count pending requests
  let totalRequests = 0
  graph.forEach(nodes => totalRequests += nodes.length)

  return {
    totalPendingRequests: totalRequests,
    totalPossibleCycles: allCycles.length,
    balancedCycles,
    unbalancedCycles,
    averageChainLength: Math.round(avgChainLength * 10) / 10,
    averageValueScore: Math.round(avgValueScore),
    averageLocationScore: Math.round(avgLocationScore),
    averageTrustScore: Math.round(avgTrustScore),
    qualityDistribution,
  }
}

/**
 * Suggest alternative cycles when one is rejected (NEW in v2.0)
 */
export async function suggestAlternativeCycles(
  rejectedSwapId: string,
  rejectorId: string
): Promise<SwapChain[]> {
  // Get participants from rejected swap
  const rejectedSwap = await prisma.multiSwap.findUnique({
    where: { id: rejectedSwapId },
    include: {
      participants: true
    }
  })

  if (!rejectedSwap) return []

  const alternatives: SwapChain[] = []

  // Find alternatives for each non-rejector participant
  for (const participant of rejectedSwap.participants) {
    if (participant.userId === rejectorId) continue

    const cycles = await findMultiSwapOpportunities(participant.userId, {
      onlyBalanced: true,
      excludeUsers: [rejectorId],
      minScore: 50
    })

    // Add top 2 alternatives per participant
    alternatives.push(...cycles.slice(0, 2))
  }

  // Remove duplicates and sort
  const uniqueAlternatives = new Map<string, SwapChain>()
  for (const alt of alternatives) {
    const key = alt.participants.map(p => p.userId).sort().join(',')
    if (!uniqueAlternatives.has(key)) {
      uniqueAlternatives.set(key, alt)
    }
  }

  return Array.from(uniqueAlternatives.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5) // Return max 5 alternatives
}

// ========================
// MULTI-SWAP MANAGEMENT
// ========================

/**
 * Create a multi-swap from a cycle
 */
export async function createMultiSwap(
  participants: SwapNode[],
  initiatorId: string
): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + EXPIRATION_HOURS)

  const multiSwap = await prisma.multiSwap.create({
    data: {
      status: 'pending',
      initiatorId,
      expiresAt,
      participants: {
        create: participants.map((p, idx) => ({
          userId: p.userId,
          givesProductId: p.productId,
          receivesFromUserId: participants[(idx + participants.length - 1) % participants.length].userId,
          confirmed: p.userId === initiatorId,
          respondedAt: p.userId === initiatorId ? new Date() : null,
        })),
      },
    },
  })

  return { id: multiSwap.id, expiresAt }
}

/**
 * Confirm participation in a multi-swap
 */
export async function confirmMultiSwapParticipation(
  multiSwapId: string,
  userId: string
): Promise<{
  allConfirmed: boolean
  remainingCount: number
  participants: { userId: string; userName: string; confirmed: boolean }[]
}> {
  const multiSwap = await prisma.multiSwap.findUnique({
    where: { id: multiSwapId },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true } } }
      }
    }
  })

  if (!multiSwap) {
    throw new Error('Takas bulunamadı')
  }

  if (multiSwap.status !== 'pending') {
    throw new Error('Bu takas artık aktif değil')
  }

  if (new Date() > multiSwap.expiresAt) {
    await prisma.multiSwap.update({
      where: { id: multiSwapId },
      data: { status: 'expired' }
    })
    throw new Error('Takas süresi dolmuş')
  }

  await prisma.multiSwapParticipant.updateMany({
    where: { multiSwapId, userId },
    data: { confirmed: true, respondedAt: new Date() },
  })

  const updatedParticipants = await prisma.multiSwapParticipant.findMany({
    where: { multiSwapId },
    include: { user: { select: { id: true, name: true } } }
  })

  const allConfirmed = updatedParticipants.every((p) => p.confirmed)
  const remainingCount = updatedParticipants.filter(p => !p.confirmed).length

  if (allConfirmed) {
    await prisma.multiSwap.update({
      where: { id: multiSwapId },
      data: { status: 'confirmed', confirmedAt: new Date() },
    })
  }

  return {
    allConfirmed,
    remainingCount,
    participants: updatedParticipants.map(p => ({
      userId: p.userId,
      userName: p.user.name || 'Kullanıcı',
      confirmed: p.confirmed
    }))
  }
}

/**
 * Reject a multi-swap participation (v2.0: triggers alternative suggestions)
 */
export async function rejectMultiSwap(
  multiSwapId: string,
  userId: string,
  reason?: string
): Promise<{
  affectedParticipants: { userId: string; userName: string }[]
  alternatives: SwapChain[]
}> {
  const multiSwap = await prisma.multiSwap.findUnique({
    where: { id: multiSwapId },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true } } }
      }
    }
  })

  if (!multiSwap) {
    throw new Error('Takas bulunamadı')
  }

  if (multiSwap.status !== 'pending') {
    throw new Error('Bu takas artık aktif değil')
  }

  await prisma.multiSwap.update({
    where: { id: multiSwapId },
    data: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedById: userId,
      rejectionReason: reason || null
    }
  })

  const affectedParticipants = multiSwap.participants
    .filter(p => p.userId !== userId)
    .map(p => ({ userId: p.userId, userName: p.user.name || 'Kullanıcı' }))

  // Find alternative cycles for affected participants
  const alternatives = await suggestAlternativeCycles(multiSwapId, userId)

  return { affectedParticipants, alternatives }
}

/**
 * Check and expire old pending multi-swaps
 */
export async function expireOldMultiSwaps(): Promise<number> {
  const result = await prisma.multiSwap.updateMany({
    where: {
      status: 'pending',
      expiresAt: { lt: new Date() }
    },
    data: { status: 'expired' }
  })

  return result.count
}

/**
 * Get pending multi-swaps for notification
 */
export async function getPendingNotifications(): Promise<{
  multiSwapId: string
  participants: { userId: string; confirmed: boolean; notifiedAt: Date | null }[]
}[]> {
  const pendingSwaps = await prisma.multiSwap.findMany({
    where: {
      status: 'pending',
      expiresAt: { gt: new Date() }
    },
    include: {
      participants: {
        select: { userId: true, confirmed: true, notifiedAt: true }
      }
    }
  })

  return pendingSwaps.map(swap => ({
    multiSwapId: swap.id,
    participants: swap.participants
  }))
}

/**
 * Mark participant as notified
 */
export async function markParticipantNotified(
  multiSwapId: string,
  userId: string
): Promise<void> {
  await prisma.multiSwapParticipant.updateMany({
    where: { multiSwapId, userId },
    data: { notifiedAt: new Date() }
  })
}

// Export types for API usage
export type { SwapNode, SwapChain, MultiSwapOptions }

// Export constants for UI usage
export const MULTI_SWAP_CONFIG = {
  VALUE_TOLERANCE,
  SCORING_WEIGHTS,
  LOCATION_WEIGHTS,
  MIN_TRUST_SCORE,
  RECOMMENDED_TRUST_SCORE,
  MIN_CYCLE_LENGTH,
  MAX_CYCLE_LENGTH,
  EXPIRATION_HOURS,
}
