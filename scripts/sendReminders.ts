/**
 * TAKAS-A Automated Reminder Notifications Script
 * Runs hourly to send reminder notifications for:
 * - SwapRequest pending responses (24h, 8h, 2h)
 * - MultiSwap participant confirmations (24h, 8h, 2h)
 * - Delivery confirmations (48h, 24h, 6h)
 * - Dispute evidence uploads (24h, 6h)
 */

import { PrismaClient } from '@prisma/client'
import * as webpush from 'web-push'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') })

const prisma = new PrismaClient()

// Configure VAPID
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.NEXTAUTH_URL || 'https://takas-a.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

// Notification types
const NotificationTypes = {
  SWAP_REMINDER_24H: 'swap_reminder_24h',
  SWAP_REMINDER_8H: 'swap_reminder_8h',
  SWAP_REMINDER_2H: 'swap_reminder_2h',
  MULTI_SWAP_REMINDER_24H: 'multi_swap_reminder_24h',
  MULTI_SWAP_REMINDER_8H: 'multi_swap_reminder_8h',
  MULTI_SWAP_REMINDER_2H: 'multi_swap_reminder_2h',
  DELIVERY_REMINDER_48H: 'delivery_reminder_48h',
  DELIVERY_REMINDER_24H: 'delivery_reminder_24h',
  DELIVERY_REMINDER_6H: 'delivery_reminder_6h',
  DISPUTE_DEADLINE_WARNING: 'dispute_deadline_warning',
}

// Notification templates
const getNotificationPayload = (type: string, data: any): { title: string; body: string; url: string; tag: string } => {
  const templates: Record<string, () => { title: string; body: string; url: string; tag: string }> = {
    [NotificationTypes.SWAP_REMINDER_24H]: () => ({
      title: '⏰ Takas Hatırlatması - 24 Saat Kaldı',
      body: `"${data.productTitle}" için takas teklifinize ${data.hoursLeft} saat içinde yanıt verin!`,
      url: '/profil?tab=offers',
      tag: `swap-reminder-24h-${data.swapId}`
    }),
    [NotificationTypes.SWAP_REMINDER_8H]: () => ({
      title: '⚠️ Acil: Sadece 8 Saat Kaldı!',
      body: `"${data.productTitle}" takas teklifine yanıt vermeyi unutmayın. Aksi halde otomatik iptal olacak!`,
      url: '/profil?tab=offers',
      tag: `swap-reminder-8h-${data.swapId}`
    }),
    [NotificationTypes.SWAP_REMINDER_2H]: () => ({
      title: '🚨 Son 2 Saat! Kararınızı Verin',
      body: `"${data.productTitle}" takas teklifi 2 saat içinde sona erecek! Hemen değerlendirin.`,
      url: '/profil?tab=offers',
      tag: `swap-reminder-2h-${data.swapId}`
    }),
    [NotificationTypes.MULTI_SWAP_REMINDER_24H]: () => ({
      title: '⏰ Çoklu Takas - 24 Saat Kaldı',
      body: `${data.participantCount} kişilik takas zincirine katılım için ${data.hoursLeft} saat kaldı!`,
      url: '/takas-firsatlari',
      tag: `multi-swap-reminder-24h-${data.multiSwapId}`
    }),
    [NotificationTypes.MULTI_SWAP_REMINDER_8H]: () => ({
      title: '⚠️ Çoklu Takas - 8 Saat Kaldı!',
      body: `Takas zinciri onayınızı bekleniyor. Onaylamazsanız ${data.participantCount} kişilik zincir iptal olacak!`,
      url: '/takas-firsatlari',
      tag: `multi-swap-reminder-8h-${data.multiSwapId}`
    }),
    [NotificationTypes.MULTI_SWAP_REMINDER_2H]: () => ({
      title: '🚨 Son 2 Saat! Takas Zinciri Bekleniyor',
      body: `Onayınız olmadan ${data.participantCount} kişilik takas zinciri iptal olacak. Hemen onaylayın!`,
      url: '/takas-firsatlari',
      tag: `multi-swap-reminder-2h-${data.multiSwapId}`
    }),
    [NotificationTypes.DELIVERY_REMINDER_48H]: () => ({
      title: '📦 Teslimat Hatırlatması',
      body: `"${data.productTitle}" için teslimat ${data.hoursLeft} saat içinde yapılmalı. QR kodunuz hazır!`,
      url: '/profil?tab=swaps',
      tag: `delivery-reminder-48h-${data.swapId}`
    }),
    [NotificationTypes.DELIVERY_REMINDER_24H]: () => ({
      title: '⚠️ Teslimat İçin 24 Saat!',
      body: `"${data.productTitle}" teslimatı yarın sona eriyor. Teslimat noktasında buluşmayı unutmayın!`,
      url: '/profil?tab=swaps',
      tag: `delivery-reminder-24h-${data.swapId}`
    }),
    [NotificationTypes.DELIVERY_REMINDER_6H]: () => ({
      title: '🚨 Son 6 Saat! Teslimat Acil',
      body: `"${data.productTitle}" teslimatı 6 saat içinde yapılmazsa takas iptal edilecek!`,
      url: '/profil?tab=swaps',
      tag: `delivery-reminder-6h-${data.swapId}`
    }),
    [NotificationTypes.DISPUTE_DEADLINE_WARNING]: () => ({
      title: '⚠️ Kanıt Süresi Doluyor',
      body: `"${data.productTitle}" için kanıt yükleme süreniz ${data.hoursLeft} saat içinde dolacak!`,
      url: '/profil?tab=swaps',
      tag: `dispute-deadline-${data.disputeId}`
    }),
  }
  
  return templates[type]?.() || { title: 'TAKAS-A', body: '', url: '/', tag: 'default' }
}

// Paths
const LOG_DIR = path.join(__dirname, '../logs')
const TRACKING_FILE = path.join(LOG_DIR, 'sent_reminders.json')

interface SentReminder {
  entityType: string
  entityId: string
  reminderType: string
  userId: string
  sentAt: string
}

let sentReminders: SentReminder[] = []

// Load previously sent reminders
function loadSentReminders(): void {
  try {
    if (fs.existsSync(TRACKING_FILE)) {
      const data = fs.readFileSync(TRACKING_FILE, 'utf-8')
      sentReminders = JSON.parse(data)
      // Keep only reminders from last 72 hours
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
      sentReminders = sentReminders.filter(r => r.sentAt > cutoff)
    }
  } catch (error) {
    console.error('Error loading sent reminders:', error)
    sentReminders = []
  }
}

// Save sent reminders
function saveSentReminders(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
    fs.writeFileSync(TRACKING_FILE, JSON.stringify(sentReminders, null, 2))
  } catch (error) {
    console.error('Error saving sent reminders:', error)
  }
}

// Check if reminder was already sent
function wasReminderSent(entityType: string, entityId: string, reminderType: string, userId: string): boolean {
  return sentReminders.some(
    r => r.entityType === entityType && 
         r.entityId === entityId && 
         r.reminderType === reminderType &&
         r.userId === userId
  )
}

// Mark reminder as sent
function markReminderSent(entityType: string, entityId: string, reminderType: string, userId: string): void {
  sentReminders.push({
    entityType,
    entityId,
    reminderType,
    userId,
    sentAt: new Date().toISOString()
  })
}

// Log notification
function logNotification(message: string): void {
  const date = new Date().toISOString().split('T')[0]
  const logFile = path.join(LOG_DIR, `reminders_${date}.log`)
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${message}\n`
  
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
    fs.appendFileSync(logFile, logEntry)
  } catch (error) {
    console.error('Error writing to log file:', error)
  }
  console.log(logEntry.trim())
}

// Send push notification
async function sendPushNotification(
  userId: string,
  notificationType: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId, isActive: true }
    })
    
    if (subscriptions.length === 0) {
      return false
    }
    
    const payload = getNotificationPayload(notificationType, data)
    const fullPayload = {
      ...payload,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
    }
    const payloadString = JSON.stringify(fullPayload)
    
    let sent = 0
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payloadString
        )
        sent++
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false }
          })
        }
      }
    }
    
    return sent > 0
  } catch (error) {
    console.error(`Failed to send push to user ${userId}:`, error)
    return false
  }
}

// Check if deadline is in reminder window
function isInReminderWindow(deadline: Date, hoursRemaining: number): boolean {
  const now = new Date()
  const targetTime = new Date(deadline.getTime() - hoursRemaining * 60 * 60 * 1000)
  const windowEnd = new Date(targetTime.getTime() + 60 * 60 * 1000)
  
  return now >= targetTime && now < windowEnd && deadline > now
}

// Process SwapRequest reminders
async function processSwapRequestReminders(): Promise<void> {
  logNotification('Processing SwapRequest reminders...')
  
  const pendingSwaps = await prisma.swapRequest.findMany({
    where: { status: 'pending' },
    include: {
      product: true,
      requester: true,
      owner: true,
    }
  })
  
  for (const swap of pendingSwaps) {
    const expiresAt = new Date(swap.createdAt.getTime() + 48 * 60 * 60 * 1000)
    
    const configs = [
      { hours: 24, type: NotificationTypes.SWAP_REMINDER_24H },
      { hours: 8, type: NotificationTypes.SWAP_REMINDER_8H },
      { hours: 2, type: NotificationTypes.SWAP_REMINDER_2H },
    ]
    
    for (const config of configs) {
      if (isInReminderWindow(expiresAt, config.hours)) {
        if (!wasReminderSent('SWAP_REQUEST', swap.id, config.type, swap.ownerId)) {
          const sent = await sendPushNotification(swap.ownerId, config.type, {
            swapId: swap.id,
            productTitle: swap.product?.title || 'Ürün',
            hoursLeft: config.hours,
          })
          
          if (sent) {
            markReminderSent('SWAP_REQUEST', swap.id, config.type, swap.ownerId)
            logNotification(`Sent ${config.type} to owner ${swap.ownerId} for swap ${swap.id}`)
          }
        }
      }
    }
  }
}

// Process MultiSwap reminders
async function processMultiSwapReminders(): Promise<void> {
  logNotification('Processing MultiSwap reminders...')
  
  const pendingMultiSwaps = await prisma.multiSwap.findMany({
    where: {
      status: 'pending',
      expiresAt: { gt: new Date() }
    },
    include: {
      participants: {
        include: { user: true }
      }
    }
  })
  
  for (const multiSwap of pendingMultiSwaps) {
    const configs = [
      { hours: 24, type: NotificationTypes.MULTI_SWAP_REMINDER_24H },
      { hours: 8, type: NotificationTypes.MULTI_SWAP_REMINDER_8H },
      { hours: 2, type: NotificationTypes.MULTI_SWAP_REMINDER_2H },
    ]
    
    for (const config of configs) {
      if (isInReminderWindow(multiSwap.expiresAt, config.hours)) {
        const unconfirmed = multiSwap.participants.filter((p: any) => !p.confirmed)
        
        for (const participant of unconfirmed) {
          if (!wasReminderSent('MULTI_SWAP', multiSwap.id, config.type, participant.userId)) {
            const sent = await sendPushNotification(participant.userId, config.type, {
              multiSwapId: multiSwap.id,
              participantCount: multiSwap.participants.length,
              hoursLeft: config.hours
            })
            
            if (sent) {
              markReminderSent('MULTI_SWAP', multiSwap.id, config.type, participant.userId)
              logNotification(`Sent ${config.type} to user ${participant.userId} for multiSwap ${multiSwap.id}`)
            }
          }
        }
      }
    }
  }
}

// Process Delivery reminders
async function processDeliveryReminders(): Promise<void> {
  logNotification('Processing Delivery reminders...')
  
  const acceptedSwaps = await prisma.swapRequest.findMany({
    where: {
      status: 'accepted',
      deliveryConfirmDeadline: { not: null, gt: new Date() },
      receiverConfirmed: false
    },
    include: { product: true }
  })
  
  for (const swap of acceptedSwaps) {
    if (!swap.deliveryConfirmDeadline) continue
    
    const configs = [
      { hours: 48, type: NotificationTypes.DELIVERY_REMINDER_48H },
      { hours: 24, type: NotificationTypes.DELIVERY_REMINDER_24H },
      { hours: 6, type: NotificationTypes.DELIVERY_REMINDER_6H },
    ]
    
    for (const config of configs) {
      if (isInReminderWindow(swap.deliveryConfirmDeadline, config.hours)) {
        for (const userId of [swap.requesterId, swap.ownerId]) {
          if (!wasReminderSent('DELIVERY', swap.id, config.type, userId)) {
            const sent = await sendPushNotification(userId, config.type, {
              swapId: swap.id,
              productTitle: swap.product?.title || 'Ürün',
              hoursLeft: config.hours
            })
            
            if (sent) {
              markReminderSent('DELIVERY', swap.id, config.type, userId)
              logNotification(`Sent ${config.type} to user ${userId} for delivery ${swap.id}`)
            }
          }
        }
      }
    }
  }
}

// Process Dispute Evidence reminders
async function processDisputeReminders(): Promise<void> {
  logNotification('Processing Dispute Evidence reminders...')
  
  const openDisputes = await prisma.disputeReport.findMany({
    where: {
      status: { in: ['open', 'evidence_pending'] },
      evidenceDeadline: { not: null, gt: new Date() }
    },
    include: {
      swapRequest: { include: { product: true } }
    }
  })
  
  for (const dispute of openDisputes) {
    if (!dispute.evidenceDeadline) continue
    
    const configs = [
      { hours: 24, key: 'DISPUTE_24H' },
      { hours: 6, key: 'DISPUTE_6H' },
    ]
    
    for (const config of configs) {
      if (isInReminderWindow(dispute.evidenceDeadline, config.hours)) {
        for (const userId of [dispute.reporterId, dispute.reportedUserId]) {
          if (!wasReminderSent('DISPUTE', dispute.id, config.key, userId)) {
            const sent = await sendPushNotification(userId, NotificationTypes.DISPUTE_DEADLINE_WARNING, {
              disputeId: dispute.id,
              productTitle: dispute.swapRequest?.product?.title || 'Ürün',
              hoursLeft: config.hours
            })
            
            if (sent) {
              markReminderSent('DISPUTE', dispute.id, config.key, userId)
              logNotification(`Sent ${config.key} to user ${userId} for dispute ${dispute.id}`)
              
              if (!dispute.evidenceReminderSent) {
                await prisma.disputeReport.update({
                  where: { id: dispute.id },
                  data: { evidenceReminderSent: true }
                })
              }
            }
          }
        }
      }
    }
  }
}

// Main
async function main(): Promise<void> {
  logNotification('=== Starting TAKAS-A Reminder Notifications ===')
  
  try {
    loadSentReminders()
    
    await processSwapRequestReminders()
    await processMultiSwapReminders()
    await processDeliveryReminders()
    await processDisputeReminders()
    
    saveSentReminders()
    
    logNotification('=== Reminder Notifications Completed Successfully ===')
  } catch (error) {
    logNotification(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
