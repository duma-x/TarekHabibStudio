export const ORDER_STATUSES = ['جديد', 'قيد التنفيذ', 'جاهز', 'تم التسليم', 'ملغي'] as const;
export const BOOKING_STATUSES = ['جديد', 'مؤكد', 'مكتمل', 'ملغي'] as const;
export const PAYMENT_METHODS = ['نقدي', 'تحويل بنكي', 'دفع إلكتروني'] as const;

export const STATUS_COLORS: Record<string, string> = {
  'جديد': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'قيد التنفيذ': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'جاهز': 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  'تم التسليم': 'bg-green-500/15 text-green-400 border-green-500/20',
  'ملغي': 'bg-red-500/15 text-red-400 border-red-500/20',
  'مؤكد': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'مكتمل': 'bg-green-500/15 text-green-400 border-green-500/20',
};

export const ARABIC_MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

export const EVENT_TYPES = [
  'جلسة تصوير داخلية','جلسة تصوير خارجية','تصوير أفراح',
  'تصوير خطوبة','تصوير منتجات','تصوير أطفال','تصوير عائلي','أخرى',
];

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  in: 'إضافة مخزون', out: 'خصم مخزون', adjustment: 'تعديل يدوي', return: 'إرجاع',
};

export const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  in: 'text-green-400', out: 'text-red-400', adjustment: 'text-amber-400', return: 'text-blue-400',
};

export const JOB_ROLES = [
  'مصور','مصمم','محرر صور','مساعد','موظف استقبال','مدير','أخرى',
];
