/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, TransactionType, PaymentMethod } from './types';

// تنسيق المبالغ المالية بطريقة عربية أنيقة مع إضافة كلمة 'أوقية'
export function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString('ar-MR')} أوقية`;
}

// تنسيق الوقت والتاريخ بطريقة سهلة القراءة
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('ar-MR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }) + ' - ' + date.toLocaleDateString('ar-MR', {
    month: 'short',
    day: 'numeric',
  });
}

// البيانات التجريبية الافتراضية للتطبيق لكي يعمل مباشرة بمظهر ممتلئ واحترافي
export const DEFAULT_INITIAL_STATE: AppState = {
  inventory: {
    purchaseValue: 0,
    marketValue: 0,
  },
  accounts: {
    cash: 0,
    bankily: 0,
    masrify: 0,
    sadad: 0,
  },
  customers: [],
  suppliers: [],
  transactions: [],
  settings: {
    defaultProfitMargin: 25 // 25%
  }
};
