import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateWhatsAppMessage(contact: {
  name: string;
  plotNumber: string;
  area?: string;
  district: string;
  neighborhood: string;
  variant?: number;
  previousMessages?: string[];
}): Promise<string> {
  const prompt = `أنت مسوق عقاري محترف مصري. اكتب رسالة واتساب قصيرة ومؤدبة وودودة لصاحب قطعة أرض لتسأله عن نيته في البيع.

معلومات صاحب الأرض:
- الاسم: ${contact.name}
- رقم القطعة: ${contact.plotNumber}
- المساحة: ${contact.area ?? "غير محددة"}
- الحي: ${contact.district}
- المجاورة: ${contact.neighborhood}

شروط الرسالة:
- ابدأ بتحية مناسبة باسم الشخص
- اذكر رقم القطعة والموقع
- اسأل عن نية البيع بأسلوب لطيف
- لا تكن مُلح أو مزعج
- قصيرة (3-4 أسطر فقط)
- باللغة العربية المصرية العامية المهذبة
- لا تضع أي تعليقات أو شرح، فقط نص الرسالة`;
  const styleHint = [
    "ابدأ بتحية مباشرة وبسيطة.",
    "استخدم أسلوبًا ودودًا مختلفًا عن الصياغة التقليدية.",
    "اجعل السؤال مختصرًا وابدأ بعبارة مساءلة لطيفة.",
  ][(contact.variant ?? 0) % 3];

  const previousMessages = (contact.previousMessages ?? []).slice(-5);
  const historyHint = previousMessages.length
    ? `\nلا تكرر أيًا من هذه الرسائل السابقة لنفس الرقم، واكتب صياغة مختلفة بوضوح:\n${previousMessages.map((message) => `- ${message}`).join("\n")}`
    : "";
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: `${prompt}\n\nتنويع الصياغة:\n- ${styleHint}${historyHint}` }] }],
    config: { maxOutputTokens: 8192 },
  });

  return response.text ?? buildFallbackMessage(contact);
}

export async function generateWhatsAppMessageVariants(contact: {
  name: string;
  plotNumber: string;
  area?: string;
  district: string;
  neighborhood: string;
}, count = 10): Promise<string[]> {
  const safeCount = Math.max(10, Math.min(20, Math.floor(count)));
  const prompt = `أنت كاتب رسائل واتساب عقارية محترف باللهجة المصرية المهذبة.
اكتب ${safeCount} صيغ مختلفة تمامًا في البداية والنهاية والأسلوب، لكن كلها تحمل نفس المعنى:
التواصل مع صاحب قطعة أرض باحترام للسؤال هل لديه نية للبيع، مع ذكر بيانات القطعة.

بيانات نموذج للمعاينة فقط:
- الاسم: ${contact.name}
- رقم القطعة: ${contact.plotNumber}
- المساحة: ${contact.area ?? "غير محددة"}
- الحي: ${contact.district}
- المجاورة: ${contact.neighborhood}

الشروط:
- كل صيغة من 3 إلى 4 أسطر قصيرة.
- اكتب الرسائل كقوالب قابلة لإعادة الاستخدام، ولا تضع بيانات النموذج الفعلية داخلها.
- استخدم المتغيرات كما هي: {name} للاسم، {plotNumber} لرقم القطعة، {area} للمساحة، {district} للحي، {neighborhood} للمجاورة.
- لا تستخدم أسلوبًا ضاغطًا أو مزعجًا.
- غيّر التحية، ترتيب الجمل، السؤال، والخاتمة بين الصيغ.
- لا تضف شرحًا أو ترقيمًا داخل النص.
- أعد النتيجة كـ JSON array فقط، يحتوي على نصوص الرسائل.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
  });

  const raw = response.text?.trim() ?? "";
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
    if (Array.isArray(parsed)) {
      const variants = parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
      if (variants.length >= 10) return variants.slice(0, safeCount);
    }
  } catch {
    // Fall through to deterministic variants when Gemini returns non-JSON text.
  }

  return buildMessageVariants(contact);
}

function buildMessageVariants(contact: {
  name: string;
  plotNumber: string;
  area?: string;
  district: string;
  neighborhood: string;
}): string[] {
  const name = "{name}";
  const plot = "{plotNumber}";
  const area = "{area}";
  const location = "{neighborhood} {district}";
  return [
    `أهلاً أستاذ ${name}\nمعاك مكتب عقارات بالعاشر.\nحابين نسأل حضرتك عن قطعة الأرض رقم (${plot}) بمساحة (${area}) في ${location}، هل في نية للبيع؟\nشكرًا لوقتك.`,
    `مساء الخير يا أستاذ ${name}\nبتواصل مع حضرتك بخصوص القطعة رقم (${plot}) الموجودة في ${location}.\nهل حضرتك بتفكر في بيعها حاليًا؟\nيسعدنا نعرف رأي حضرتك.`,
    `أستاذ ${name}، أتمنى تكون بخير.\nهل قطعة الأرض (${plot}) ومساحتها (${area}) في ${location} متاحة للبيع؟\nلو مناسبة، يهمنا نعرف السعر المطلوب.\nتحياتي لحضرتك.`,
    `يا أهلاً بحضرتك أستاذ ${name}\nممكن أعرف لو سمحت هل عند حضرتك نية لبيع قطعة (${plot}) في ${location}؟\nالمساحة المسجلة عندنا (${area}).\nأشكرك مقدمًا.`,
    `صباح الخير أستاذ ${name}\nمعاك مكتب متخصص في عقارات العاشر.\nاستفسار بسيط بخصوص أرض رقم (${plot}) في ${location}: هل البيع مطروح؟\nكل التقدير لحضرتك.`,
    `أهلاً بحضرتك يا أستاذ ${name}\nكنت حابب أستأذن حضرتك في سؤال سريع عن قطعة (${plot}) بمساحة (${area}) في ${location}.\nهل تفكر في بيعها؟\nمستني رد حضرتك في الوقت المناسب.`,
    `تحياتي أستاذ ${name}\nهل ما زالت قطعة الأرض رقم (${plot}) في ${location} معروضة أو متاحة للبيع؟\nالمساحة حوالي (${area}).\nلو تسمح، عرفنا برغبتك.`,
    `مساء النور يا أستاذ ${name}\nوصلنا بيانات عن قطعة (${plot}) في ${location} وحبينا نتأكد من حضرتك.\nهل يوجد اهتمام ببيعها، ولو نعم ما السعر المتوقع؟\nشكرًا لحضرتك.`,
    `أستاذ ${name}، أتواصل مع حضرتك بكل احترام.\nبخصوص أرض رقم (${plot}) ومساحتها (${area}) في ${location}، هل البيع ممكن يكون مطروح الفترة دي؟\nيسعدنا التواصل وقت ما يناسبك.`,
    `كل عام وحضرتك بخير يا أستاذ ${name}\nعندي استفسار عن قطعة الأرض (${plot}) في ${location}.\nهل حضرتك ناوي تبيعها أو تسمح بعرض مناسب عليها؟\nبانتظار ردك الكريم.`,
  ];
}

function buildFallbackMessage(contact: {
  name: string;
  plotNumber: string;
  district: string;
  neighborhood: string;
  area?: string;
}): string {
  return `يا أهلا أستاذ ${contact.name}\nمكتب عقارات بالعاشر مع حضرتك\nهل قطعة الأرض رقم (${contact.plotNumber}) ومساحتها (${contact.area ?? "غير محددة"}) في المجاورة (${contact.neighborhood}) بالحي (${contact.district}) هل يوجد نيه للبيع؟`;
}
