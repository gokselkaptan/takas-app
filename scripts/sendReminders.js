"use strict";
/**
 * TAKAS-A Automated Reminder Notifications Script
 * Runs hourly to send reminder notifications for:
 * - SwapRequest pending responses (24h, 8h, 2h)
 * - MultiSwap participant confirmations (24h, 8h, 2h)
 * - Delivery confirmations (48h, 24h, 6h)
 * - Dispute evidence uploads (24h, 6h)
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var webpush = require("web-push");
var fs = require("fs");
var path = require("path");
var dotenv = require("dotenv");
// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
var prisma = new client_1.PrismaClient();
// Configure VAPID
var vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
var vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
var vapidSubject = process.env.NEXTAUTH_URL || 'https://takas-a.com';
if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}
// Notification types
var NotificationTypes = {
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
};
// Notification templates
var getNotificationPayload = function (type, data) {
    var _a;
    var _b;
    var templates = (_a = {},
        _a[NotificationTypes.SWAP_REMINDER_24H] = function () { return ({
            title: '⏰ Takas Hatırlatması - 24 Saat Kaldı',
            body: "\"".concat(data.productTitle, "\" i\u00E7in takas teklifinize ").concat(data.hoursLeft, " saat i\u00E7inde yan\u0131t verin!"),
            url: '/profil?tab=offers',
            tag: "swap-reminder-24h-".concat(data.swapId)
        }); },
        _a[NotificationTypes.SWAP_REMINDER_8H] = function () { return ({
            title: '⚠️ Acil: Sadece 8 Saat Kaldı!',
            body: "\"".concat(data.productTitle, "\" takas teklifine yan\u0131t vermeyi unutmay\u0131n. Aksi halde otomatik iptal olacak!"),
            url: '/profil?tab=offers',
            tag: "swap-reminder-8h-".concat(data.swapId)
        }); },
        _a[NotificationTypes.SWAP_REMINDER_2H] = function () { return ({
            title: '🚨 Son 2 Saat! Kararınızı Verin',
            body: "\"".concat(data.productTitle, "\" takas teklifi 2 saat i\u00E7inde sona erecek! Hemen de\u011Ferlendirin."),
            url: '/profil?tab=offers',
            tag: "swap-reminder-2h-".concat(data.swapId)
        }); },
        _a[NotificationTypes.MULTI_SWAP_REMINDER_24H] = function () { return ({
            title: '⏰ Çoklu Takas - 24 Saat Kaldı',
            body: "".concat(data.participantCount, " ki\u015Filik takas zincirine kat\u0131l\u0131m i\u00E7in ").concat(data.hoursLeft, " saat kald\u0131!"),
            url: '/takas-firsatlari',
            tag: "multi-swap-reminder-24h-".concat(data.multiSwapId)
        }); },
        _a[NotificationTypes.MULTI_SWAP_REMINDER_8H] = function () { return ({
            title: '⚠️ Çoklu Takas - 8 Saat Kaldı!',
            body: "Takas zinciri onay\u0131n\u0131z\u0131 bekleniyor. Onaylamazsan\u0131z ".concat(data.participantCount, " ki\u015Filik zincir iptal olacak!"),
            url: '/takas-firsatlari',
            tag: "multi-swap-reminder-8h-".concat(data.multiSwapId)
        }); },
        _a[NotificationTypes.MULTI_SWAP_REMINDER_2H] = function () { return ({
            title: '🚨 Son 2 Saat! Takas Zinciri Bekleniyor',
            body: "Onay\u0131n\u0131z olmadan ".concat(data.participantCount, " ki\u015Filik takas zinciri iptal olacak. Hemen onaylay\u0131n!"),
            url: '/takas-firsatlari',
            tag: "multi-swap-reminder-2h-".concat(data.multiSwapId)
        }); },
        _a[NotificationTypes.DELIVERY_REMINDER_48H] = function () { return ({
            title: '📦 Teslimat Hatırlatması',
            body: "\"".concat(data.productTitle, "\" i\u00E7in teslimat ").concat(data.hoursLeft, " saat i\u00E7inde yap\u0131lmal\u0131. QR kodunuz haz\u0131r!"),
            url: '/profil?tab=swaps',
            tag: "delivery-reminder-48h-".concat(data.swapId)
        }); },
        _a[NotificationTypes.DELIVERY_REMINDER_24H] = function () { return ({
            title: '⚠️ Teslimat İçin 24 Saat!',
            body: "\"".concat(data.productTitle, "\" teslimat\u0131 yar\u0131n sona eriyor. Teslimat noktas\u0131nda bulu\u015Fmay\u0131 unutmay\u0131n!"),
            url: '/profil?tab=swaps',
            tag: "delivery-reminder-24h-".concat(data.swapId)
        }); },
        _a[NotificationTypes.DELIVERY_REMINDER_6H] = function () { return ({
            title: '🚨 Son 6 Saat! Teslimat Acil',
            body: "\"".concat(data.productTitle, "\" teslimat\u0131 6 saat i\u00E7inde yap\u0131lmazsa takas iptal edilecek!"),
            url: '/profil?tab=swaps',
            tag: "delivery-reminder-6h-".concat(data.swapId)
        }); },
        _a[NotificationTypes.DISPUTE_DEADLINE_WARNING] = function () { return ({
            title: '⚠️ Kanıt Süresi Doluyor',
            body: "\"".concat(data.productTitle, "\" i\u00E7in kan\u0131t y\u00FCkleme s\u00FCreniz ").concat(data.hoursLeft, " saat i\u00E7inde dolacak!"),
            url: '/profil?tab=swaps',
            tag: "dispute-deadline-".concat(data.disputeId)
        }); },
        _a);
    return ((_b = templates[type]) === null || _b === void 0 ? void 0 : _b.call(templates)) || { title: 'TAKAS-A', body: '', url: '/', tag: 'default' };
};
// Paths
var LOG_DIR = path.join(__dirname, '../logs');
var TRACKING_FILE = path.join(LOG_DIR, 'sent_reminders.json');
var sentReminders = [];
// Load previously sent reminders
function loadSentReminders() {
    try {
        if (fs.existsSync(TRACKING_FILE)) {
            var data = fs.readFileSync(TRACKING_FILE, 'utf-8');
            sentReminders = JSON.parse(data);
            // Keep only reminders from last 72 hours
            var cutoff_1 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
            sentReminders = sentReminders.filter(function (r) { return r.sentAt > cutoff_1; });
        }
    }
    catch (error) {
        console.error('Error loading sent reminders:', error);
        sentReminders = [];
    }
}
// Save sent reminders
function saveSentReminders() {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        fs.writeFileSync(TRACKING_FILE, JSON.stringify(sentReminders, null, 2));
    }
    catch (error) {
        console.error('Error saving sent reminders:', error);
    }
}
// Check if reminder was already sent
function wasReminderSent(entityType, entityId, reminderType, userId) {
    return sentReminders.some(function (r) { return r.entityType === entityType &&
        r.entityId === entityId &&
        r.reminderType === reminderType &&
        r.userId === userId; });
}
// Mark reminder as sent
function markReminderSent(entityType, entityId, reminderType, userId) {
    sentReminders.push({
        entityType: entityType,
        entityId: entityId,
        reminderType: reminderType,
        userId: userId,
        sentAt: new Date().toISOString()
    });
}
// Log notification
function logNotification(message) {
    var date = new Date().toISOString().split('T')[0];
    var logFile = path.join(LOG_DIR, "reminders_".concat(date, ".log"));
    var timestamp = new Date().toISOString();
    var logEntry = "[".concat(timestamp, "] ").concat(message, "\n");
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        fs.appendFileSync(logFile, logEntry);
    }
    catch (error) {
        console.error('Error writing to log file:', error);
    }
    console.log(logEntry.trim());
}
// Send push notification
function sendPushNotification(userId, notificationType, data) {
    return __awaiter(this, void 0, void 0, function () {
        var subscriptions, payload, fullPayload, payloadString, sent, _i, subscriptions_1, sub, error_1, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 10, , 11]);
                    return [4 /*yield*/, prisma.pushSubscription.findMany({
                            where: { userId: userId, isActive: true }
                        })];
                case 1:
                    subscriptions = _a.sent();
                    if (subscriptions.length === 0) {
                        return [2 /*return*/, false];
                    }
                    payload = getNotificationPayload(notificationType, data);
                    fullPayload = __assign(__assign({}, payload), { icon: '/icons/icon-192x192.png', badge: '/icons/icon-96x96.png' });
                    payloadString = JSON.stringify(fullPayload);
                    sent = 0;
                    _i = 0, subscriptions_1 = subscriptions;
                    _a.label = 2;
                case 2:
                    if (!(_i < subscriptions_1.length)) return [3 /*break*/, 9];
                    sub = subscriptions_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 8]);
                    return [4 /*yield*/, webpush.sendNotification({
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth
                            }
                        }, payloadString)];
                case 4:
                    _a.sent();
                    sent++;
                    return [3 /*break*/, 8];
                case 5:
                    error_1 = _a.sent();
                    if (!(error_1.statusCode === 404 || error_1.statusCode === 410)) return [3 /*break*/, 7];
                    return [4 /*yield*/, prisma.pushSubscription.update({
                            where: { id: sub.id },
                            data: { isActive: false }
                        })];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7: return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 2];
                case 9: return [2 /*return*/, sent > 0];
                case 10:
                    error_2 = _a.sent();
                    console.error("Failed to send push to user ".concat(userId, ":"), error_2);
                    return [2 /*return*/, false];
                case 11: return [2 /*return*/];
            }
        });
    });
}
// Check if deadline is in reminder window
function isInReminderWindow(deadline, hoursRemaining) {
    var now = new Date();
    var targetTime = new Date(deadline.getTime() - hoursRemaining * 60 * 60 * 1000);
    var windowEnd = new Date(targetTime.getTime() + 60 * 60 * 1000);
    return now >= targetTime && now < windowEnd && deadline > now;
}
// Process SwapRequest reminders
function processSwapRequestReminders() {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var pendingSwaps, _i, pendingSwaps_1, swap, expiresAt, configs, _b, configs_1, config, sent;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    logNotification('Processing SwapRequest reminders...');
                    return [4 /*yield*/, prisma.swapRequest.findMany({
                            where: { status: 'pending' },
                            include: {
                                product: true,
                                requester: true,
                                owner: true,
                            }
                        })];
                case 1:
                    pendingSwaps = _c.sent();
                    _i = 0, pendingSwaps_1 = pendingSwaps;
                    _c.label = 2;
                case 2:
                    if (!(_i < pendingSwaps_1.length)) return [3 /*break*/, 7];
                    swap = pendingSwaps_1[_i];
                    expiresAt = new Date(swap.createdAt.getTime() + 48 * 60 * 60 * 1000);
                    configs = [
                        { hours: 24, type: NotificationTypes.SWAP_REMINDER_24H },
                        { hours: 8, type: NotificationTypes.SWAP_REMINDER_8H },
                        { hours: 2, type: NotificationTypes.SWAP_REMINDER_2H },
                    ];
                    _b = 0, configs_1 = configs;
                    _c.label = 3;
                case 3:
                    if (!(_b < configs_1.length)) return [3 /*break*/, 6];
                    config = configs_1[_b];
                    if (!isInReminderWindow(expiresAt, config.hours)) return [3 /*break*/, 5];
                    if (!!wasReminderSent('SWAP_REQUEST', swap.id, config.type, swap.ownerId)) return [3 /*break*/, 5];
                    return [4 /*yield*/, sendPushNotification(swap.ownerId, config.type, {
                            swapId: swap.id,
                            productTitle: ((_a = swap.product) === null || _a === void 0 ? void 0 : _a.title) || 'Ürün',
                            hoursLeft: config.hours,
                        })];
                case 4:
                    sent = _c.sent();
                    if (sent) {
                        markReminderSent('SWAP_REQUEST', swap.id, config.type, swap.ownerId);
                        logNotification("Sent ".concat(config.type, " to owner ").concat(swap.ownerId, " for swap ").concat(swap.id));
                    }
                    _c.label = 5;
                case 5:
                    _b++;
                    return [3 /*break*/, 3];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Process MultiSwap reminders
function processMultiSwapReminders() {
    return __awaiter(this, void 0, void 0, function () {
        var pendingMultiSwaps, _i, pendingMultiSwaps_1, multiSwap, configs, _a, configs_2, config, unconfirmed, _b, unconfirmed_1, participant, sent;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    logNotification('Processing MultiSwap reminders...');
                    return [4 /*yield*/, prisma.multiSwap.findMany({
                            where: {
                                status: 'pending',
                                expiresAt: { gt: new Date() }
                            },
                            include: {
                                participants: {
                                    include: { user: true }
                                }
                            }
                        })];
                case 1:
                    pendingMultiSwaps = _c.sent();
                    _i = 0, pendingMultiSwaps_1 = pendingMultiSwaps;
                    _c.label = 2;
                case 2:
                    if (!(_i < pendingMultiSwaps_1.length)) return [3 /*break*/, 9];
                    multiSwap = pendingMultiSwaps_1[_i];
                    configs = [
                        { hours: 24, type: NotificationTypes.MULTI_SWAP_REMINDER_24H },
                        { hours: 8, type: NotificationTypes.MULTI_SWAP_REMINDER_8H },
                        { hours: 2, type: NotificationTypes.MULTI_SWAP_REMINDER_2H },
                    ];
                    _a = 0, configs_2 = configs;
                    _c.label = 3;
                case 3:
                    if (!(_a < configs_2.length)) return [3 /*break*/, 8];
                    config = configs_2[_a];
                    if (!isInReminderWindow(multiSwap.expiresAt, config.hours)) return [3 /*break*/, 7];
                    unconfirmed = multiSwap.participants.filter(function (p) { return !p.confirmed; });
                    _b = 0, unconfirmed_1 = unconfirmed;
                    _c.label = 4;
                case 4:
                    if (!(_b < unconfirmed_1.length)) return [3 /*break*/, 7];
                    participant = unconfirmed_1[_b];
                    if (!!wasReminderSent('MULTI_SWAP', multiSwap.id, config.type, participant.userId)) return [3 /*break*/, 6];
                    return [4 /*yield*/, sendPushNotification(participant.userId, config.type, {
                            multiSwapId: multiSwap.id,
                            participantCount: multiSwap.participants.length,
                            hoursLeft: config.hours
                        })];
                case 5:
                    sent = _c.sent();
                    if (sent) {
                        markReminderSent('MULTI_SWAP', multiSwap.id, config.type, participant.userId);
                        logNotification("Sent ".concat(config.type, " to user ").concat(participant.userId, " for multiSwap ").concat(multiSwap.id));
                    }
                    _c.label = 6;
                case 6:
                    _b++;
                    return [3 /*break*/, 4];
                case 7:
                    _a++;
                    return [3 /*break*/, 3];
                case 8:
                    _i++;
                    return [3 /*break*/, 2];
                case 9: return [2 /*return*/];
            }
        });
    });
}
// Process Delivery reminders
function processDeliveryReminders() {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var acceptedSwaps, _i, acceptedSwaps_1, swap, configs, _b, configs_3, config, _c, _d, userId, sent;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    logNotification('Processing Delivery reminders...');
                    return [4 /*yield*/, prisma.swapRequest.findMany({
                            where: {
                                status: 'accepted',
                                deliveryConfirmDeadline: { not: null, gt: new Date() },
                                receiverConfirmed: false
                            },
                            include: { product: true }
                        })];
                case 1:
                    acceptedSwaps = _e.sent();
                    _i = 0, acceptedSwaps_1 = acceptedSwaps;
                    _e.label = 2;
                case 2:
                    if (!(_i < acceptedSwaps_1.length)) return [3 /*break*/, 9];
                    swap = acceptedSwaps_1[_i];
                    if (!swap.deliveryConfirmDeadline)
                        return [3 /*break*/, 8];
                    configs = [
                        { hours: 48, type: NotificationTypes.DELIVERY_REMINDER_48H },
                        { hours: 24, type: NotificationTypes.DELIVERY_REMINDER_24H },
                        { hours: 6, type: NotificationTypes.DELIVERY_REMINDER_6H },
                    ];
                    _b = 0, configs_3 = configs;
                    _e.label = 3;
                case 3:
                    if (!(_b < configs_3.length)) return [3 /*break*/, 8];
                    config = configs_3[_b];
                    if (!isInReminderWindow(swap.deliveryConfirmDeadline, config.hours)) return [3 /*break*/, 7];
                    _c = 0, _d = [swap.requesterId, swap.ownerId];
                    _e.label = 4;
                case 4:
                    if (!(_c < _d.length)) return [3 /*break*/, 7];
                    userId = _d[_c];
                    if (!!wasReminderSent('DELIVERY', swap.id, config.type, userId)) return [3 /*break*/, 6];
                    return [4 /*yield*/, sendPushNotification(userId, config.type, {
                            swapId: swap.id,
                            productTitle: ((_a = swap.product) === null || _a === void 0 ? void 0 : _a.title) || 'Ürün',
                            hoursLeft: config.hours
                        })];
                case 5:
                    sent = _e.sent();
                    if (sent) {
                        markReminderSent('DELIVERY', swap.id, config.type, userId);
                        logNotification("Sent ".concat(config.type, " to user ").concat(userId, " for delivery ").concat(swap.id));
                    }
                    _e.label = 6;
                case 6:
                    _c++;
                    return [3 /*break*/, 4];
                case 7:
                    _b++;
                    return [3 /*break*/, 3];
                case 8:
                    _i++;
                    return [3 /*break*/, 2];
                case 9: return [2 /*return*/];
            }
        });
    });
}
// Process Dispute Evidence reminders
function processDisputeReminders() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var openDisputes, _i, openDisputes_1, dispute, configs, _c, configs_4, config, _d, _e, userId, sent;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    logNotification('Processing Dispute Evidence reminders...');
                    return [4 /*yield*/, prisma.disputeReport.findMany({
                            where: {
                                status: { in: ['open', 'evidence_pending'] },
                                evidenceDeadline: { not: null, gt: new Date() }
                            },
                            include: {
                                swapRequest: { include: { product: true } }
                            }
                        })];
                case 1:
                    openDisputes = _f.sent();
                    _i = 0, openDisputes_1 = openDisputes;
                    _f.label = 2;
                case 2:
                    if (!(_i < openDisputes_1.length)) return [3 /*break*/, 10];
                    dispute = openDisputes_1[_i];
                    if (!dispute.evidenceDeadline)
                        return [3 /*break*/, 9];
                    configs = [
                        { hours: 24, key: 'DISPUTE_24H' },
                        { hours: 6, key: 'DISPUTE_6H' },
                    ];
                    _c = 0, configs_4 = configs;
                    _f.label = 3;
                case 3:
                    if (!(_c < configs_4.length)) return [3 /*break*/, 9];
                    config = configs_4[_c];
                    if (!isInReminderWindow(dispute.evidenceDeadline, config.hours)) return [3 /*break*/, 8];
                    _d = 0, _e = [dispute.reporterId, dispute.reportedUserId];
                    _f.label = 4;
                case 4:
                    if (!(_d < _e.length)) return [3 /*break*/, 8];
                    userId = _e[_d];
                    if (!!wasReminderSent('DISPUTE', dispute.id, config.key, userId)) return [3 /*break*/, 7];
                    return [4 /*yield*/, sendPushNotification(userId, NotificationTypes.DISPUTE_DEADLINE_WARNING, {
                            disputeId: dispute.id,
                            productTitle: ((_b = (_a = dispute.swapRequest) === null || _a === void 0 ? void 0 : _a.product) === null || _b === void 0 ? void 0 : _b.title) || 'Ürün',
                            hoursLeft: config.hours
                        })];
                case 5:
                    sent = _f.sent();
                    if (!sent) return [3 /*break*/, 7];
                    markReminderSent('DISPUTE', dispute.id, config.key, userId);
                    logNotification("Sent ".concat(config.key, " to user ").concat(userId, " for dispute ").concat(dispute.id));
                    if (!!dispute.evidenceReminderSent) return [3 /*break*/, 7];
                    return [4 /*yield*/, prisma.disputeReport.update({
                            where: { id: dispute.id },
                            data: { evidenceReminderSent: true }
                        })];
                case 6:
                    _f.sent();
                    _f.label = 7;
                case 7:
                    _d++;
                    return [3 /*break*/, 4];
                case 8:
                    _c++;
                    return [3 /*break*/, 3];
                case 9:
                    _i++;
                    return [3 /*break*/, 2];
                case 10: return [2 /*return*/];
            }
        });
    });
}
// Main
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logNotification('=== Starting TAKAS-A Reminder Notifications ===');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 9]);
                    loadSentReminders();
                    return [4 /*yield*/, processSwapRequestReminders()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, processMultiSwapReminders()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, processDeliveryReminders()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, processDisputeReminders()];
                case 5:
                    _a.sent();
                    saveSentReminders();
                    logNotification('=== Reminder Notifications Completed Successfully ===');
                    return [3 /*break*/, 9];
                case 6:
                    error_3 = _a.sent();
                    logNotification("ERROR: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)));
                    throw error_3;
                case 7: return [4 /*yield*/, prisma.$disconnect()];
                case 8:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error('Fatal error:', error);
    process.exit(1);
});
