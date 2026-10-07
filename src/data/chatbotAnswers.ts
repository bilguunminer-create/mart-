function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatMnt(value: number) {
  return `${new Intl.NumberFormat('mn-MN').format(value)} ₮`;
}

export function getConfiguredAnswer(data: Record<string, unknown>, message: string): string | null {
  // Leave human support requests to the authenticated chat service.
  if (/(админ|оператор|хүнтэй\s*(яр|холб)|гомдол|мөнгө\s*буца|төлбөр\s*буца|залилан|маргаан)/iu.test(message)) return null;
  const normalized = message.normalize('NFKC').toLocaleLowerCase('mn-MN').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const chatbot = data.chatbot_settings && typeof data.chatbot_settings === 'object'
    ? data.chatbot_settings as Record<string, unknown>
    : {};
  const bank = data.bank_accounts && typeof data.bank_accounts === 'object'
    ? data.bank_accounts as Record<string, unknown>
    : {};

  if (/^(сайн\s*(байна\s*уу|уу)|өглөөний\s*мэнд|өдрийн\s*мэнд|оройн\s*мэнд|hello|hi|hey|сайн\s*байну|сайн\s*бн\s*уу|sain\s*(baina\s*uu|bnu|uu)|snu)[!?.\s]*$/iu.test(normalized)) {
    return 'Сайн байна уу! US&K Family Mart-ийн AI туслах байна. Ажиллах цаг, хүргэлт, төлбөр, барааны үнэ ба үлдэгдэл, урамшуулал эсвэл захиалгын талаар асуугаарай.';
  }

  if (/(ажиллах\s*цаг|цагийн\s*хуваарь|хэдээс\s*хэд|хэдэн\s*цагт)/iu.test(normalized)) {
    return `Манай дэлгүүрийн ажиллах цаг: ${asText(data.work_hours, asText(chatbot.workHours, 'Сайтад одоогоор бүртгээгүй байна.'))}`;
  }

  if (/(хаяг|байршил|хаана|утас|холбоо\s*барих)/iu.test(normalized)) {
    return [
      asText(data.store_address) && `Хаяг: ${asText(data.store_address)}`,
      asText(data.store_phone) && `Утас: ${asText(data.store_phone)}`,
      asText(data.store_email) && `И-мэйл: ${asText(data.store_email)}`,
      asText(data.google_maps_url),
    ].filter(Boolean).join('\n') || 'Холбоо барих мэдээлэл сайтад одоогоор бүртгээгүй байна.';
  }

  const products = Array.isArray(data.products) ? data.products as Record<string, unknown>[] : [];
  const matches = products.filter(product => {
    const name = asText(product.name).normalize('NFKC').toLocaleLowerCase('mn-MN');
    return product.published !== false && name.length >= 2 && normalized.includes(name);
  }).slice(0, 5);
  if (matches.length) {
    return matches.map(product => {
      const stock = asNumber(product.stock ?? product.stock_quantity, 0);
      const available = product.in_stock !== false && stock > 0;
      return `${asText(product.name)}: ${formatMnt(asNumber(product.price, 0))}. ${available ? `Үлдэгдэл ${stock} ш.` : 'Одоогоор дууссан.'}`;
    }).join('\n');
  }

  if (/(хүргэлтийн\s*бүс|хүргэлтийн\s*үнэ|хүргэлтийн\s*хугацаа|хүргэлт)/iu.test(normalized)) {
    const parts = [
      asText(chatbot.deliveryZones) && `Хүргэлтийн бүс: ${asText(chatbot.deliveryZones)}`,
      `Үндсэн хүргэлтийн үнэ: ${formatMnt(asNumber(data.delivery_fee, 3000))}`,
      (data.rules as Record<string, unknown> | undefined)?.free_delivery_enabled === false
        ? 'Үнэгүй хүргэлт одоогоор идэвхгүй.'
        : `Үнэгүй хүргэлтийн босго: ${formatMnt(asNumber(data.free_delivery_threshold, 100000))}`,
      asNumber(data.min_order_amount, 0) > 0 && `Захиалгын доод дүн: ${formatMnt(asNumber(data.min_order_amount, 0))}`,
      asText(chatbot.deliveryDuration) && `Хугацаа: ${asText(chatbot.deliveryDuration)}`,
      asText(chatbot.deliveryNotes),
    ].filter(Boolean);
    return parts.join('\n');
  }

  if (/(төлбөр|яаж\s*төл|данс|qpay|кью\s*пэй)/iu.test(normalized)) {
    const account = [
      asText(bank.bankName ?? bank.bank_name),
      asText(bank.accountNumber ?? bank.account_number),
      asText(bank.iban),
      asText(bank.accountHolder ?? bank.account_holder),
    ].filter(Boolean).join(' · ');
    return [
      asText(chatbot.paymentTerms, 'Захиалгын төлбөрийг заасан дансаар шилжүүлнэ.'),
      account && `Төлбөрийн данс: ${account}`,
      `Төлөгдөөгүй захиалга ${asNumber(data.unpaid_cancellation_minutes, 60)} минутын дараа автоматаар цуцлагдана.`,
    ].filter(Boolean).join('\n');
  }

  if (/(барааны\s*үнэ.*үлдэгдэл|үнэ\s*болон\s*үлдэгдэл|үнэ.*нөөц)/iu.test(normalized)) {
    return `${asText(chatbot.productNotes, 'Барааны үнэ болон үлдэгдлийг систем дэх хамгийн сүүлийн мэдээллээр хариулна.')} Сонирхож буй барааныхаа нэрийг бичээрэй.`;
  }

  if (/(урамшуулал|loyalty|лояалти|оноо|cashback|кэшбэк)/iu.test(normalized)) {
    return [
      `Суурь loyalty cashback: ${asNumber(data.loyalty_cashback_pct, 1)}%.`,
      asText(chatbot.promotions) || 'Одоогоор chatbot-д тусгай урамшуулал бүртгэгдээгүй байна.',
      asText(chatbot.loyaltyNotes),
    ].filter(Boolean).join('\n');
  }

  if (/(захиалга.*(заавар|яаж|хийх)|хэрхэн\s*захиалах)/iu.test(normalized)) {
    return asText(chatbot.orderInstructions, 'Бараагаа сагсанд нэмээд хүргэлтийн мэдээллээ бөглөж, захиалгаа баталгаажуулна. Дараа нь заасан дансанд төлбөр шилжүүлнэ.');
  }

  return null;
}


