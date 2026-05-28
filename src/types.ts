/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PaymentMethod {
  CASH = 'CASH',          // نقدًا (الخزنة)
  BANKILY = 'BANKILY',    // بنكيلي
  MASRIFY = 'MASRIFY',    // مصرفي
  SADAD = 'SADAD',        // سداد
  DEBT = 'DEBT'           // دين
}

export enum TransactionType {
  SALE = 'SALE',                  // عملية بيع
  PURCHASE = 'PURCHASE',          // عملية شراء للمخزن
  DAMAGED = 'DAMAGED',            // بضاعة تالفة / خسائر
  PRICE_ADJUST = 'PRICE_ADJUST',  // تعديل أسعار السوق
  PAY_CUSTOMER = 'PAY_CUSTOMER',  // سداد دين من عميل
  PAY_SUPPLIER = 'PAY_SUPPLIER',  // دفع مستحقات لمورد
  TRANSFER = 'TRANSFER',          // تحويل داخلي بين الحسابات
  EXPENSE = 'EXPENSE',            // مصروفات عامة
  LIQUIDITY_ADD = 'LIQUIDITY_ADD', // إضافة سيولة للحساب
  INVENTORY_ADJUST = 'INVENTORY_ADJUST' // تعديل يدوي افتتاحي للمخزن
}

export interface InventoryState {
  purchaseValue: number; // التكلفة الشرائية الإجمالية الحالية للمخزن
  marketValue: number;   // القيمة السوقية الإجمالية الحالية للمخزن
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  debt: number; // المبلغ المستحق عليه (بالأوقية)
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  debt: number; // دين علينا كتاجر له
  createdAt: string;
}

export interface AccountBalances {
  cash: number;      // الخزنة
  bankily: number;   // بنكيلي
  masrify: number;   // مصرفي
  sadad: number;     // سداد
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;             // القيمة المالية للعملية
  partyId?: string;           // معرف العميل أو المورد إذا وجد
  partyName?: string;         // اسم العميل أو المورد للتسهيل في السجل
  paymentMethod?: PaymentMethod;
  fromAccount?: keyof AccountBalances | 'DEBT';
  toAccount?: keyof AccountBalances | 'DEBT';
  description: string;
  timestamp: string;          // وقت العملية
  details?: {
    prevValue?: number;
    newValue?: number;
    ratioUsed?: number;       // النسبة المستخدمة في حساب التكلفة (الربط الذكي)
    calculatedCost?: number;  // التكلفة الشرائية المحتسبة
    profit?: number;          // صافي الربح المحتسب
    prevPurchaseValue?: number;
    prevMarketValue?: number;
    marketValueDeducted?: number;
    marketValueAdded?: number;
  };
}

export interface AppState {
  inventory: InventoryState;
  accounts: AccountBalances;
  customers: Customer[];
  suppliers: Supplier[];
  transactions: Transaction[];
  settings: {
    defaultProfitMargin: number; // هامش الربح الافتراضي في حال عدم وجود بضاعة (نسبة مئوية، مثلاً 25)
  };
}
