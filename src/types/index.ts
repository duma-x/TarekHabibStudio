export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface Client {
  id: string;
  name: string;
  mobile: string;
  mobile_normalized: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  order_count?: number;
  total_balance?: number;
}

export interface PriceListItem {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  selling_price: number;
  quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'جديد' | 'قيد التنفيذ' | 'جاهز' | 'تم التسليم' | 'ملغي';
export type ItemType = 'service' | 'price_list' | 'product' | 'custom';
export type PaymentMethod = 'نقدي' | 'تحويل بنكي' | 'دفع إلكتروني';
export type BookingStatus = 'جديد' | 'مؤكد' | 'مكتمل' | 'ملغي';
export type MovementType = 'in' | 'out' | 'adjustment' | 'return';
export type GoalType = 'monthly' | 'annual';

export interface OrderLine {
  id?: string;
  order_id?: string;
  item_type: ItemType;
  item_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  order_number: string;
  client_id: string | null;
  client?: Client;
  order_date: string;
  delivery_date?: string;
  status: OrderStatus;
  subtotal: number;
  discount_percentage: number;
  discount_amount: number;
  total: number;
  total_paid: number;
  remaining: number;
  notes?: string;
  stock_deducted: boolean;
  order_lines?: OrderLine[];
  payments?: Payment[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  order?: Partial<Order>;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  note?: string;
  recorded_by?: string;
  recorder?: { username: string; email: string };
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  client_name: string;
  client_mobile: string;
  event_type: string;
  booking_date: string;
  booking_time: string;
  agreed_price: number;
  deposit_paid: number;
  status: BookingStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  name: string;
  mobile: string;
  job_role: string;
  is_active: boolean;
  user_profile_id?: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialGoal {
  id: string;
  goal_type: GoalType;
  year: number;
  month?: number;
  goal_amount: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  product?: Partial<Product>;
  movement_type: MovementType;
  quantity: number;
  reason: string;
  order_id?: string;
  performed_by?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user?: { username: string; email: string };
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface DashboardStats {
  orders_new: number;
  orders_in_progress: number;
  orders_ready: number;
  orders_delivered: number;
  total_order_value: number;
  total_collected: number;
  total_outstanding: number;
  upcoming_bookings: number;
}
