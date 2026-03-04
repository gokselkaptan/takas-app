/**
 * Çok Dilli Bildirim Mesajları
 * TR (Türkçe), EN (English), ES (Español), CA (Català)
 */

export const notifications = {
  // Takas Teklifi
  swapOfferSent: {
    tr: "Takas teklifiniz gönderildi!",
    en: "Your swap offer has been sent!",
    es: "¡Tu oferta de intercambio ha sido enviada!",
    ca: "La teva oferta d'intercanvi s'ha enviat!"
  },
  swapOfferReceived: {
    tr: "Yeni takas teklifi aldınız!",
    en: "You received a new swap offer!",
    es: "¡Has recibido una nueva oferta de intercambio!",
    ca: "Has rebut una nova oferta d'intercanvi!"
  },

  // Takas Durumu
  swapAccepted: {
    tr: "Takas teklifiniz kabul edildi!",
    en: "Your swap offer has been accepted!",
    es: "¡Tu oferta de intercambio ha sido aceptada!",
    ca: "La teva oferta d'intercanvi ha estat acceptada!"
  },
  swapRejected: {
    tr: "Takas teklifiniz reddedildi.",
    en: "Your swap offer has been rejected.",
    es: "Tu oferta de intercambio ha sido rechazada.",
    ca: "La teva oferta d'intercanvi ha estat rebutjada."
  },
  swapCancelled: {
    tr: "Takas iptal edildi.",
    en: "The swap has been cancelled.",
    es: "El intercambio ha sido cancelado.",
    ca: "L'intercanvi s'ha cancel·lat."
  },
  swapCompleted: {
    tr: "Takas tamamlandı! 🎉",
    en: "Swap completed! 🎉",
    es: "¡Intercambio completado! 🎉",
    ca: "Intercanvi completat! 🎉"
  },

  // Süre/Zaman Aşımı
  offerExpired: {
    tr: "Takas teklifiniz süresi doldu.",
    en: "Your swap offer has expired.",
    es: "Tu oferta de intercambio ha expirado.",
    ca: "La teva oferta d'intercanvi ha expirat."
  },
  offerAutoCancel: {
    tr: "⏰ Takas teklifiniz 48 saat içinde yanıtlanmadığı için otomatik iptal edildi.",
    en: "⏰ Your swap offer was automatically cancelled as it wasn't responded to within 48 hours.",
    es: "⏰ Tu oferta fue cancelada automáticamente por no recibir respuesta en 48 horas.",
    ca: "⏰ La teva oferta s'ha cancel·lat automàticament perquè no va rebre resposta en 48 hores."
  },

  // Limitler
  dailyLimitReached: {
    tr: "Günlük 3 teklif limitinize ulaştınız. Yarın tekrar deneyebilirsiniz.",
    en: "You've reached your daily limit of 3 offers. Try again tomorrow.",
    es: "Has alcanzado tu límite diario de 3 ofertas. Inténtalo mañana.",
    ca: "Has assolit el teu límit diari de 3 ofertes. Torna-ho a provar demà."
  },
  weeklyLimitReached: {
    tr: "Haftalık teklif limitinize ulaştınız.",
    en: "You've reached your weekly offer limit.",
    es: "Has alcanzado tu límite semanal de ofertas.",
    ca: "Has assolit el teu límit setmanal d'ofertes."
  },

  // Teslimat
  deliveryProposed: {
    tr: "Buluşma noktası önerildi.",
    en: "Meeting point has been proposed.",
    es: "Se ha propuesto un punto de encuentro.",
    ca: "S'ha proposat un punt de trobada."
  },
  deliveryAccepted: {
    tr: "Buluşma noktası kabul edildi.",
    en: "Meeting point has been accepted.",
    es: "El punto de encuentro ha sido aceptado.",
    ca: "El punt de trobada ha estat acceptat."
  },
  deliveryDateSet: {
    tr: "Teslim tarihi belirlendi.",
    en: "Delivery date has been set.",
    es: "La fecha de entrega ha sido establecida.",
    ca: "La data de lliurament s'ha establert."
  },
  deliveryOverdue: {
    tr: "⚠️ Teslim tarihi geçti! Lütfen karşı tarafla iletişime geçin.",
    en: "⚠️ Delivery date has passed! Please contact the other party.",
    es: "⚠️ ¡La fecha de entrega ha pasado! Por favor contacta a la otra parte.",
    ca: "⚠️ La data de lliurament ha passat! Si us plau, contacta amb l'altra part."
  },

  // QR Kod
  qrCodeGenerated: {
    tr: "QR kodunuz oluşturuldu.",
    en: "Your QR code has been generated.",
    es: "Tu código QR ha sido generado.",
    ca: "El teu codi QR s'ha generat."
  },
  qrCodeScanned: {
    tr: "QR kod başarıyla okutuldu!",
    en: "QR code scanned successfully!",
    es: "¡Código QR escaneado con éxito!",
    ca: "Codi QR escanejat amb èxit!"
  },

  // Varış
  bothPartiesArrived: {
    tr: "İki taraf da buluşma noktasına ulaştı.",
    en: "Both parties have arrived at the meeting point.",
    es: "Ambas partes han llegado al punto de encuentro.",
    ca: "Ambdues parts han arribat al punt de trobada."
  },
  waitingForOtherParty: {
    tr: "Karşı tarafın gelmesini bekliyorsunuz...",
    en: "Waiting for the other party to arrive...",
    es: "Esperando a que llegue la otra parte...",
    ca: "Esperant que arribi l'altra part..."
  },

  // Çoklu Takas
  multiSwapCreated: {
    tr: "Çoklu takas oluşturuldu! Katılımcıların onayı bekleniyor.",
    en: "Multi-swap created! Waiting for participants' approval.",
    es: "¡Intercambio múltiple creado! Esperando la aprobación de los participantes.",
    ca: "Intercanvi múltiple creat! Esperant l'aprovació dels participants."
  },
  multiSwapConfirmed: {
    tr: "Çoklu takas herkes tarafından onaylandı!",
    en: "Multi-swap confirmed by all participants!",
    es: "¡Intercambio múltiple confirmado por todos los participantes!",
    ca: "Intercanvi múltiple confirmat per tots els participants!"
  },
  multiSwapCancelled: {
    tr: "Çoklu takas iptal edildi.",
    en: "Multi-swap has been cancelled.",
    es: "El intercambio múltiple ha sido cancelado.",
    ca: "L'intercanvi múltiple s'ha cancel·lat."
  },

  // Valor
  valorReceived: {
    tr: "Valor bakiyenize eklendi!",
    en: "Valor has been added to your balance!",
    es: "¡Se ha añadido Valor a tu saldo!",
    ca: "S'ha afegit Valor al teu saldo!"
  },
  valorDeducted: {
    tr: "Valor bakiyenizden düşüldü.",
    en: "Valor has been deducted from your balance.",
    es: "Se ha deducido Valor de tu saldo.",
    ca: "S'ha deduït Valor del teu saldo."
  },
  insufficientValor: {
    tr: "Yetersiz Valor bakiyesi.",
    en: "Insufficient Valor balance.",
    es: "Saldo de Valor insuficiente.",
    ca: "Saldo de Valor insuficient."
  },

  // Genel
  messageReceived: {
    tr: "Yeni mesajınız var!",
    en: "You have a new message!",
    es: "¡Tienes un nuevo mensaje!",
    ca: "Tens un nou missatge!"
  },
  profileUpdated: {
    tr: "Profiliniz güncellendi.",
    en: "Your profile has been updated.",
    es: "Tu perfil ha sido actualizado.",
    ca: "El teu perfil s'ha actualitzat."
  },
  productAdded: {
    tr: "Ürününüz başarıyla eklendi!",
    en: "Your product has been added successfully!",
    es: "¡Tu producto ha sido añadido con éxito!",
    ca: "El teu producte s'ha afegit amb èxit!"
  },
  productRemoved: {
    tr: "Ürün silindi.",
    en: "Product has been removed.",
    es: "El producto ha sido eliminado.",
    ca: "El producte s'ha eliminat."
  },

  // Hatalar
  errorGeneral: {
    tr: "Bir hata oluştu. Lütfen tekrar deneyin.",
    en: "An error occurred. Please try again.",
    es: "Ha ocurrido un error. Por favor, inténtalo de nuevo.",
    ca: "S'ha produït un error. Si us plau, torna-ho a provar."
  },
  errorNetwork: {
    tr: "Bağlantı hatası. İnternet bağlantınızı kontrol edin.",
    en: "Connection error. Check your internet connection.",
    es: "Error de conexión. Comprueba tu conexión a internet.",
    ca: "Error de connexió. Comprova la teva connexió a internet."
  },

  // Filtreler (GÖREV 19)
  filterAll: {
    tr: "Tümü",
    en: "All",
    es: "Todos",
    ca: "Tots"
  },
  filterIncoming: {
    tr: "Gelen Talepler",
    en: "Incoming Requests",
    es: "Solicitudes Recibidas",
    ca: "Sol·licituds Rebudes"
  },
  filterOutgoing: {
    tr: "Giden Talepler",
    en: "Outgoing Requests",
    es: "Solicitudes Enviadas",
    ca: "Sol·licituds Enviades"
  },
  incomingBadge: {
    tr: "📥 Gelen Teklif",
    en: "📥 Incoming Offer",
    es: "📥 Oferta Recibida",
    ca: "📥 Oferta Rebuda"
  },
  outgoingBadge: {
    tr: "📤 Gönderilen Teklif",
    en: "📤 Sent Offer",
    es: "📤 Oferta Enviada",
    ca: "📤 Oferta Enviada"
  }
}

export type NotificationKey = keyof typeof notifications
export type SupportedLocale = 'tr' | 'en' | 'es' | 'ca'

/**
 * Kullanıcının diline göre bildirim mesajını döndürür
 * @param key Bildirim anahtarı
 * @param locale Kullanıcı dili (varsayılan: 'tr')
 * @returns Çevrilmiş mesaj
 */
export function getNotification(key: NotificationKey, locale: string = 'tr'): string {
  const notification = notifications[key]
  if (!notification) return ''
  return notification[locale as SupportedLocale] || notification.tr
}

/**
 * Tüm bildirimleri belirli bir dilde döndürür
 * @param locale Kullanıcı dili
 * @returns Tüm bildirimler
 */
export function getAllNotifications(locale: SupportedLocale = 'tr'): Record<NotificationKey, string> {
  const result: Partial<Record<NotificationKey, string>> = {}
  for (const key of Object.keys(notifications) as NotificationKey[]) {
    result[key] = notifications[key][locale] || notifications[key].tr
  }
  return result as Record<NotificationKey, string>
}

/**
 * Dinamik değişkenli bildirim mesajı oluşturur
 * @param key Bildirim anahtarı
 * @param locale Kullanıcı dili
 * @param vars Değişkenler (örn: {productTitle: 'iPhone 14'})
 * @returns Çevrilmiş ve değişkenleri içeren mesaj
 */
export function getNotificationWithVars(
  key: NotificationKey, 
  locale: string = 'tr',
  vars: Record<string, string | number> = {}
): string {
  let message = getNotification(key, locale)
  for (const [varKey, varValue] of Object.entries(vars)) {
    message = message.replace(`{${varKey}}`, String(varValue))
  }
  return message
}
