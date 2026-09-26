import { ChatbotSettings } from '../types';

export const DEFAULT_CHATBOT_SETTINGS: ChatbotSettings = {
  workHours: '09:00 - 20:00 (Өдөр бүр)',
  deliveryZones: 'Даланзадгад хотын төвийн бүс',
  deliveryDuration: 'Захиалга баталгаажсанаас хойш 60-120 минут',
  deliveryNotes: '',
  paymentTerms: 'Захиалгын төлбөрийг дансаар шилжүүлнэ. Гүйлгээний утгад захиалгын дугаараа бичнэ.',
  productNotes: 'Барааны үнэ болон үлдэгдлийг систем дэх хамгийн сүүлийн мэдээллээр хариулна.',
  promotions: '',
  loyaltyNotes: 'Loyalty оноо болон урамшуулал нь тухайн үеийн хүчинтэй дүрмээр тооцогдоно.',
  orderInstructions: 'Бараагаа сагсанд нэмээд, хүргэлтийн мэдээллээ бөглөж, захиалгаа баталгаажуулна. Дараа нь заасан дансанд төлбөр шилжүүлнэ.',
};

export function normalizeChatbotSettings(value: unknown): ChatbotSettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = (key: keyof ChatbotSettings) => {
    const candidate = source[key];
    return typeof candidate === 'string' ? candidate : DEFAULT_CHATBOT_SETTINGS[key];
  };

  return {
    workHours: text('workHours'),
    deliveryZones: text('deliveryZones'),
    deliveryDuration: text('deliveryDuration'),
    deliveryNotes: text('deliveryNotes'),
    paymentTerms: text('paymentTerms'),
    productNotes: text('productNotes'),
    promotions: text('promotions'),
    loyaltyNotes: text('loyaltyNotes'),
    orderInstructions: text('orderInstructions'),
  };
}
