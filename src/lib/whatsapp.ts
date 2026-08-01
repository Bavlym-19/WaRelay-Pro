// Re-export from baileys.ts for backward compatibility
export {
  sendBaileysMessage as sendMessage,
  sendBaileysMessage as sendMessageRoundRobin,
  sendBaileysMessageFromSession as sendMessageFromSession,
  checkBaileysConnection as checkConnection,
  checkAllBaileysConnections as checkAllConnections,
  getSessionState,
  getAllSessionStates,
  startSession,
  stopSession,
  restartSession,
  initSessions,
  startKeepAlive,
  requestPairingCodeForSession,
} from "./baileys.js";

export function buildMessage(template: string | null | undefined, contact: {
  name: string;
  plotNumber: string;
  area?: string;
  district: string;
  neighborhood: string;
}, variant = 0, previousMessages: string[] = []): string {
  if (template) {
    const rendered = template
      .replace(/\{name\}/g, contact.name)
      .replace(/\{plotNumber\}/g, contact.plotNumber)
      .replace(/\{area\}/g, contact.area ?? "")
      .replace(/\{المساحة\}/g, contact.area ?? "")
      .replace(/\{district\}/g, contact.district)
      .replace(/\{neighborhood\}/g, contact.neighborhood);
    if (!previousMessages.some((message) => message.trim() === rendered.trim())) return rendered;
    const variations = [
      `أهلاً أستاذ ${contact.name}، ${rendered}`,
      `${rendered}\n\nوشكرًا لوقتك.`,
      `مساء الخير يا أستاذ ${contact.name}،\n${rendered}`,
    ];
    return variations.find((message) => !previousMessages.some((previous) => previous.trim() === message.trim()))
      ?? `${rendered}\n\nهل تسمح لي بمعرفة رأيك؟`;
  }

  const variants = [
    `يا أهلا أستاذ ${contact.name}\nمكتب عقارات بالعاشر مع حضرتك\nهل قطعة الأرض رقم (${contact.plotNumber}) ومساحتها (${contact.area ?? "غير محددة"}) في ${contact.neighborhood} ${contact.district} هل يوجد نيه للبيع ولو متاحة إيه السعر النهائي المطلوب فيها`,
    `أهلاً أستاذ ${contact.name}، معاك مكتب عقارات بالعاشر.\nبخصوص القطعة رقم (${contact.plotNumber}) بمساحة (${contact.area ?? "غير محددة"}) في ${contact.neighborhood} ${contact.district}، هل حضرتك ناوي تبيعها؟ ولو متاحة، إيه السعر المطلوب؟`,
    `مساء الخير يا أستاذ ${contact.name}.\nكنت بسأل على قطعة (${contact.plotNumber}) مساحتها (${contact.area ?? "غير محددة"}) الموجودة في ${contact.neighborhood} ${contact.district}، هل فيه نية للبيع؟`,
  ];
  const previous = new Set(previousMessages.map((message) => message.trim()));
  for (let offset = 0; offset < variants.length; offset++) {
    const candidate = variants[(variant + offset) % variants.length];
    if (!previous.has(candidate.trim())) return candidate;
  }
  return variants[variant % variants.length];
}
