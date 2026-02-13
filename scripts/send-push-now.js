/**
 * TAKAS-A Scheduled Push Notification Script
 * Günde 4 kez (09:00, 13:00, 18:00, 21:00 Türkiye saati) çalışır
 */

const { PrismaClient } = require('@prisma/client');
const webpush = require('web-push');

// Şablonlar - Her zaman dilimi için en az 3 farklı şablon
const morningTemplates = [
  () => ({
    title: 'Günaydın! ☀️',
    body: "Bugün TAKAS-A'yı ziyaret ettin mi? Günlük bonus Valor'unu kaçırma!",
  }),
  () => ({
    title: 'Yeni güne TAKAS-A ile başla! 🌅',
    body: 'Günlük bonusun seni bekliyor. Hemen giriş yap ve kazan!',
  }),
  () => ({
    title: 'Bonus zamanı! 🎁',
    body: 'Her gün olduğu gibi bugün de Valor bonusun hazır. Şimdi al!',
  }),
  () => ({
    title: 'Günaydın TAKAS-A! ☕',
    body: 'Günün ilk bonusu seni bekliyor. Kaçırma!',
  }),
];

const noonTemplates = [
  (ctx) => ({
    title: 'Yeni ürünler eklendi! 🆕',
    body: `Son 24 saatte ${ctx.count} yeni ürün yüklendi. Göz atmak ister misin?`,
  }),
  (ctx) => ({
    title: 'TAKAS-A güncellendi! 📦',
    body: `${ctx.count} yeni ilan seni bekliyor. Fırsatları kaçırma!`,
  }),
  (ctx) => ({
    title: 'Taze ilanlar geldi! 🛍️',
    body: `Son 24 saatte ${ctx.count} ürün eklendi. Hemen keşfet!`,
  }),
  (ctx) => ({
    title: 'Yeni ürün alarmı! 🔔',
    body: `${ctx.count} yeni ürün platformda. Belki aradığın burada!`,
  }),
];

const eveningTemplates = [
  (ctx) => ({
    title: 'Akşam fırsatları! 🌟',
    body: `${ctx.category} kategorisinde ${ctx.count} ürün seni bekliyor!`,
  }),
  (ctx) => ({
    title: 'Akşam takas zamanı! 🌆',
    body: `${ctx.category} kategorisinde harika fırsatlar var. ${ctx.count}+ ürün!`,
  }),
  (ctx) => ({
    title: 'Popüler kategorilerde hareket! 🔥',
    body: `${ctx.category} kategorisi çok popüler! ${ctx.count} aktif ürün.`,
  }),
  (ctx) => ({
    title: 'Akşam indirimi! 💫',
    body: `${ctx.category} kategorisinde ${ctx.count} ürün indirimde. Kaçırma!`,
  }),
];

const nightTemplates = [
  () => ({
    title: 'İyi geceler! 🌙',
    body: 'Yarın için takas planın var mı? Favorilerine göz at!',
  }),
  () => ({
    title: 'Gün bitmeden... 🌜',
    body: 'Favorilediğin ürünlere tekrar bakmak ister misin?',
  }),
  () => ({
    title: 'Favori kontrolü! ⭐',
    body: 'Beğendiğin ürünler hala burada. Yarın geç kalma!',
  }),
  () => ({
    title: 'Uyumadan önce... 😴',
    body: 'Favorilerini kontrol et, belki yarın takas zamanı!',
  }),
];

// Yardımcı fonksiyonlar
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTurkeyHour() {
  const now = new Date();
  const turkeyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  return turkeyTime.getHours();
}

// Ana fonksiyon
async function main() {
  const prisma = new PrismaClient();
  
  try {
    // VAPID keys from environment
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:info@takas-a.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not found in environment');
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const hour = getTurkeyHour();
    console.log(`[${new Date().toISOString()}] Current Turkey hour: ${hour}`);

    let notification = null;

    if (hour === 9) {
      // Sabah bildirimi
      const template = pickRandom(morningTemplates);
      const { title, body } = template({});
      notification = { title, body, url: '/valor-kazan' };
      console.log('Sending morning notification');
    } else if (hour === 13) {
      // Öğle bildirimi - yeni ürün sayısı
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const count = await prisma.product.count({
        where: {
          createdAt: { gte: since },
          status: 'active',
        },
      });
      
      if (count > 0) {
        const template = pickRandom(noonTemplates);
        const { title, body } = template({ count });
        notification = { title, body, url: '/urunler?sort=newest' };
        console.log(`Sending noon notification (${count} new products)`);
      } else {
        console.log('No new products in last 24h, skipping noon notification');
      }
    } else if (hour === 18) {
      // Akşam bildirimi - popüler kategori
      const popularCategory = await prisma.category.findFirst({
        where: {
          products: {
            some: { status: 'active' }
          }
        },
        include: {
          _count: {
            select: { products: { where: { status: 'active' } } }
          }
        },
        orderBy: {
          products: { _count: 'desc' }
        }
      });

      if (popularCategory && popularCategory._count.products > 0) {
        const template = pickRandom(eveningTemplates);
        const { title, body } = template({ 
          category: popularCategory.name, 
          count: popularCategory._count.products 
        });
        notification = { 
          title, 
          body, 
          url: `/urunler?category=${popularCategory.slug}` 
        };
        console.log(`Sending evening notification (${popularCategory.name}: ${popularCategory._count.products} products)`);
      } else {
        console.log('No popular category found, skipping evening notification');
      }
    } else if (hour === 21) {
      // Gece bildirimi
      const template = pickRandom(nightTemplates);
      const { title, body } = template({});
      notification = { title, body, url: '/profil?tab=favorilerim' };
      console.log('Sending night notification');
    } else {
      console.log(`Hour ${hour} is not a notification time, skipping`);
      return;
    }

    if (!notification) {
      console.log('No notification to send');
      return;
    }

    // Aktif push subscription'ları al
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { isActive: true },
    });

    console.log(`Found ${subscriptions.length} active subscriptions`);

    const payload = JSON.stringify({
      type: 'SYSTEM',
      title: notification.title,
      body: notification.body,
      url: notification.url,
      timestamp: Date.now(),
    });

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload);
        successCount++;
      } catch (error) {
        failCount++;
        // 410 Gone veya 404 Not Found - subscription artık geçerli değil
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          });
          console.log(`Deactivated expired subscription: ${sub.id}`);
        }
      }
    }

    console.log(`Push notifications sent: ${successCount} success, ${failCount} failed`);

  } catch (error) {
    console.error('Error sending scheduled push notifications:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
