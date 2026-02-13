"use strict";
/**
 * TAKAS-A Scheduled Push Notification Script
 * Günde 4 kez (09:00, 13:00, 18:00, 21:00 Türkiye saati) çalışır
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var web_push_1 = require("web-push");
// Şablonlar - Her zaman dilimi için en az 3 farklı şablon
var morningTemplates = [
    function () { return ({
        title: 'Günaydın! ☀️',
        body: "Bugün TAKAS-A'yı ziyaret ettin mi? Günlük bonus Valor'unu kaçırma!",
    }); },
    function () { return ({
        title: 'Yeni güne TAKAS-A ile başla! 🌅',
        body: 'Günlük bonusun seni bekliyor. Hemen giriş yap ve kazan!',
    }); },
    function () { return ({
        title: 'Bonus zamanı! 🎁',
        body: 'Her gün olduğu gibi bugün de Valor bonusun hazır. Şimdi al!',
    }); },
    function () { return ({
        title: 'Günaydın TAKAS-A! ☕',
        body: 'Günün ilk bonusu seni bekliyor. Kaçırma!',
    }); },
];
var noonTemplates = [
    function (ctx) { return ({
        title: 'Yeni ürünler eklendi! 🆕',
        body: "Son 24 saatte ".concat(ctx.count, " yeni \u00FCr\u00FCn y\u00FCklendi. G\u00F6z atmak ister misin?"),
    }); },
    function (ctx) { return ({
        title: 'TAKAS-A güncellendi! 📦',
        body: "".concat(ctx.count, " yeni ilan seni bekliyor. F\u0131rsatlar\u0131 ka\u00E7\u0131rma!"),
    }); },
    function (ctx) { return ({
        title: 'Taze ilanlar geldi! 🛍️',
        body: "Son 24 saatte ".concat(ctx.count, " \u00FCr\u00FCn eklendi. Hemen ke\u015Ffet!"),
    }); },
    function (ctx) { return ({
        title: 'Yeni ürün alarmı! 🔔',
        body: "".concat(ctx.count, " yeni \u00FCr\u00FCn platformda. Belki arad\u0131\u011F\u0131n burada!"),
    }); },
];
var eveningTemplates = [
    function (ctx) { return ({
        title: 'Akşam fırsatları! 🌟',
        body: "".concat(ctx.category, " kategorisinde ").concat(ctx.count, " \u00FCr\u00FCn seni bekliyor!"),
    }); },
    function (ctx) { return ({
        title: 'Akşam takas zamanı! 🌆',
        body: "".concat(ctx.category, " kategorisinde harika f\u0131rsatlar var. ").concat(ctx.count, "+ \u00FCr\u00FCn!"),
    }); },
    function (ctx) { return ({
        title: 'Popüler kategorilerde hareket! 🔥',
        body: "".concat(ctx.category, " kategorisi \u00E7ok pop\u00FCler! ").concat(ctx.count, " aktif \u00FCr\u00FCn."),
    }); },
    function (ctx) { return ({
        title: 'Akşam indirimi! 💫',
        body: "".concat(ctx.category, " kategorisinde ").concat(ctx.count, " \u00FCr\u00FCn indirimde. Ka\u00E7\u0131rma!"),
    }); },
];
var nightTemplates = [
    function () { return ({
        title: 'İyi geceler! 🌙',
        body: 'Yarın için takas planın var mı? Favorilerine göz at!',
    }); },
    function () { return ({
        title: 'Gün bitmeden... 🌜',
        body: 'Favorilediğin ürünlere tekrar bakmak ister misin?',
    }); },
    function () { return ({
        title: 'Favori kontrolü! ⭐',
        body: 'Beğendiğin ürünler hala burada. Yarın geç kalma!',
    }); },
    function () { return ({
        title: 'Uyumadan önce... 😴',
        body: 'Favorilerini kontrol et, belki yarın takas zamanı!',
    }); },
];
// Yardımcı fonksiyonlar
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function getTurkeyHour() {
    var now = new Date();
    var turkeyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
    return turkeyTime.getHours();
}
// Ana fonksiyon
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var prisma, vapidPublicKey, vapidPrivateKey, vapidSubject, hour, notification, template, _a, title, body, since, count, template, _b, title, body, popularCategory, template, _c, title, body, template, _d, title, body, subscriptions, payload, successCount, failCount, _i, subscriptions_1, sub, pushSubscription, error_1, error_2;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    prisma = new client_1.PrismaClient();
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 17, 18, 20]);
                    vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
                    vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
                    vapidSubject = process.env.VAPID_SUBJECT || 'mailto:info@takas-a.com';
                    if (!vapidPublicKey || !vapidPrivateKey) {
                        throw new Error('VAPID keys not found in environment');
                    }
                    web_push_1.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
                    hour = getTurkeyHour();
                    console.log("[".concat(new Date().toISOString(), "] Current Turkey hour: ").concat(hour));
                    notification = null;
                    if (!(hour === 9)) return [3 /*break*/, 2];
                    template = pickRandom(morningTemplates);
                    _a = template({}), title = _a.title, body = _a.body;
                    notification = { title: title, body: body, url: '/valor-kazan' };
                    console.log('Sending morning notification');
                    return [3 /*break*/, 7];
                case 2:
                    if (!(hour === 13)) return [3 /*break*/, 4];
                    since = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    return [4 /*yield*/, prisma.product.count({
                            where: {
                                createdAt: { gte: since },
                                status: 'active',
                            },
                        })];
                case 3:
                    count = _e.sent();
                    if (count > 0) {
                        template = pickRandom(noonTemplates);
                        _b = template({ count: count }), title = _b.title, body = _b.body;
                        notification = { title: title, body: body, url: '/urunler?sort=newest' };
                        console.log("Sending noon notification (".concat(count, " new products)"));
                    }
                    else {
                        console.log('No new products in last 24h, skipping noon notification');
                    }
                    return [3 /*break*/, 7];
                case 4:
                    if (!(hour === 18)) return [3 /*break*/, 6];
                    return [4 /*yield*/, prisma.category.findFirst({
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
                        })];
                case 5:
                    popularCategory = _e.sent();
                    if (popularCategory && popularCategory._count.products > 0) {
                        template = pickRandom(eveningTemplates);
                        _c = template({
                            category: popularCategory.name,
                            count: popularCategory._count.products
                        }), title = _c.title, body = _c.body;
                        notification = {
                            title: title,
                            body: body,
                            url: "/urunler?category=".concat(popularCategory.slug)
                        };
                        console.log("Sending evening notification (".concat(popularCategory.name, ": ").concat(popularCategory._count.products, " products)"));
                    }
                    else {
                        console.log('No popular category found, skipping evening notification');
                    }
                    return [3 /*break*/, 7];
                case 6:
                    if (hour === 21) {
                        template = pickRandom(nightTemplates);
                        _d = template({}), title = _d.title, body = _d.body;
                        notification = { title: title, body: body, url: '/profil?tab=favorilerim' };
                        console.log('Sending night notification');
                    }
                    else {
                        console.log("Hour ".concat(hour, " is not a notification time, skipping"));
                        return [2 /*return*/];
                    }
                    _e.label = 7;
                case 7:
                    if (!notification) {
                        console.log('No notification to send');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, prisma.pushSubscription.findMany({
                            where: { isActive: true },
                        })];
                case 8:
                    subscriptions = _e.sent();
                    console.log("Found ".concat(subscriptions.length, " active subscriptions"));
                    payload = JSON.stringify({
                        type: 'SYSTEM',
                        title: notification.title,
                        body: notification.body,
                        url: notification.url,
                        timestamp: Date.now(),
                    });
                    successCount = 0;
                    failCount = 0;
                    _i = 0, subscriptions_1 = subscriptions;
                    _e.label = 9;
                case 9:
                    if (!(_i < subscriptions_1.length)) return [3 /*break*/, 16];
                    sub = subscriptions_1[_i];
                    _e.label = 10;
                case 10:
                    _e.trys.push([10, 12, , 15]);
                    pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth,
                        },
                    };
                    return [4 /*yield*/, web_push_1.sendNotification(pushSubscription, payload)];
                case 11:
                    _e.sent();
                    successCount++;
                    return [3 /*break*/, 15];
                case 12:
                    error_1 = _e.sent();
                    failCount++;
                    if (!(error_1.statusCode === 410 || error_1.statusCode === 404)) return [3 /*break*/, 14];
                    return [4 /*yield*/, prisma.pushSubscription.update({
                            where: { id: sub.id },
                            data: { isActive: false },
                        })];
                case 13:
                    _e.sent();
                    console.log("Deactivated expired subscription: ".concat(sub.id));
                    _e.label = 14;
                case 14: return [3 /*break*/, 15];
                case 15:
                    _i++;
                    return [3 /*break*/, 9];
                case 16:
                    console.log("Push notifications sent: ".concat(successCount, " success, ").concat(failCount, " failed"));
                    return [3 /*break*/, 20];
                case 17:
                    error_2 = _e.sent();
                    console.error('Error sending scheduled push notifications:', error_2);
                    throw error_2;
                case 18: return [4 /*yield*/, prisma.$disconnect()];
                case 19:
                    _e.sent();
                    return [7 /*endfinally*/];
                case 20: return [2 /*return*/];
            }
        });
    });
}
main();
