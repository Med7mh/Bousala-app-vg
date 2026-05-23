/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Keyboard, 
  HelpCircle, 
  UserPlus, 
  Search, 
  CheckCircle, 
  Wallet, 
  CreditCard, 
  User, 
  ArrowLeft,
  X,
  Phone
} from 'lucide-react';
import { AppState, PaymentMethod, TransactionType, Customer } from '../types';
import { formatCurrency } from '../utils';

interface CashierProps {
  appState: AppState;
  onAddTransaction: (tx: any, updatedInventory?: any, updatedAccounts?: any, updatedCustomers?: any) => void;
  onAddCustomer: (customer: Customer) => void;
}

export default function Cashier({ appState, onAddTransaction, onAddCustomer }: CashierProps) {
  const [amountInput, setAmountInput] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('خضار');
  const [showDebtOverlay, setShowDebtOverlay] = useState<boolean>(false);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  
  // حقول إضافة عميل مستعجل
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>('');

  // لوحة المفاتيح الرقمية
  const handleKeyPair = (val: string) => {
    if (val === 'C') {
      setAmountInput('');
    } else {
      // تجنب كتابة أصفر مكررة في البداية
      if ((val === '0' || val === '00') && amountInput === '') return;
      // الحد الأقصى للمبالغ هو 9 أرقام لتفادي الأخطاء الكبيرة
      if (amountInput.length >= 9) return;
      setAmountInput(prev => prev + val);
    }
  };

  const currentAmount = parseFloat(amountInput) || 0;

  // فئات الخضار والمطبخ السريعة
  const categories = [
    { name: 'خضار', color: 'bg-emerald-600 text-white border-emerald-700' },
    { name: 'فواكه', color: 'bg-orange-500 text-white border-orange-600' },
    { name: 'ورقيات', color: 'bg-green-600 text-white border-green-700' },
    { name: 'أخرى', color: 'bg-slate-600 text-white border-slate-700' },
  ];

  // فلترة الزبائن للبيع بالدين
  const filteredCustomers = useMemo(() => {
    return appState.customers.filter(c => 
      c.name.includes(customerSearch) || c.phone.includes(customerSearch)
    );
  }, [appState.customers, customerSearch]);

  // حساب التكلفة وصافي الربح في الخلفية بالاعتماد على "المخزن المالي"
  const calculatedMetrics = useMemo(() => {
    const { purchaseValue, marketValue } = appState.inventory;
    let ratio = appState.settings.defaultProfitMargin / 100; // الافتراضي
    let ratioUsed = 1 - ratio; // نسبة التكلفة إلى البيع

    if (marketValue > 0) {
      ratioUsed = purchaseValue / marketValue;
    }

    const calculatedCost = currentAmount * ratioUsed;
    const profit = currentAmount - calculatedCost;

    return {
      ratioUsed,
      calculatedCost,
      profit
    };
  }, [appState.inventory, appState.settings.defaultProfitMargin, currentAmount]);

  // معالجة الدفع السريع (كاش أو تطبيقات بنكية)
  const handlePayment = (method: PaymentMethod, customer?: Customer) => {
    if (currentAmount <= 0) return;

    // 1. تحديد الحساب المناسب
    let targetAccount: 'cash' | 'bankily' | 'masrify' | 'sadad' | 'DEBT' = 'cash';
    let accountLabel = 'الخزنة';

    if (method === PaymentMethod.BANKILY) {
      targetAccount = 'bankily';
      accountLabel = 'بنكيلي';
    } else if (method === PaymentMethod.MASRIFY) {
      targetAccount = 'masrify';
      accountLabel = 'مصرفي';
    } else if (method === PaymentMethod.SADAD) {
      targetAccount = 'sadad';
      accountLabel = 'سداد';
    } else if (method === PaymentMethod.DEBT) {
      targetAccount = 'DEBT';
      accountLabel = 'دفتر الدين';
    }

    // 2. تحديث المخزون مالياً (الربط التلقائي والذكي)
    const updatedInventory = { ...appState.inventory };
    const costToDeduct = calculatedMetrics.calculatedCost;
    
    // ننقص القيمة السوقية بقيمة البيع بالكامل، والتكلفة الشرائية بالتكلفة الشرائية المقابلة
    updatedInventory.marketValue = Math.max(0, updatedInventory.marketValue - currentAmount);
    updatedInventory.purchaseValue = Math.max(0, updatedInventory.purchaseValue - costToDeduct);

    // 3. تحديث الحسابات أو رصيد العميل
    let updatedAccounts = { ...appState.accounts };
    let updatedCustomers = [...appState.customers];

    if (method === PaymentMethod.DEBT) {
      if (!customer) return;
      updatedCustomers = appState.customers.map(c => {
        if (c.id === customer.id) {
          return { ...c, debt: c.debt + currentAmount };
        }
        return c;
      });
    } else {
      updatedAccounts[targetAccount] += currentAmount;
    }

    // 4. إنشاء السجل المالي
    const description = method === PaymentMethod.DEBT 
      ? `بيع [ ${selectedCategory} ] بالدين للعميل: ${customer?.name}`
      : `بيع [ ${selectedCategory} ] عبر [ ${accountLabel} ]`;

    const newTx = {
      id: `tx-${Date.now()}`,
      type: TransactionType.SALE,
      amount: currentAmount,
      paymentMethod: method,
      toAccount: targetAccount,
      partyId: customer?.id,
      partyName: customer?.name,
      description,
      timestamp: new Date().toISOString(),
      details: {
        ratioUsed: calculatedMetrics.ratioUsed,
        calculatedCost: costToDeduct,
        profit: calculatedMetrics.profit
      }
    };

    onAddTransaction(newTx, updatedInventory, updatedAccounts, updatedCustomers);
    
    // تصفير لوحة الكاشير
    setAmountInput('');
    setShowDebtOverlay(false);
    setCustomerSearch('');

    // إشعار سريع للمستخدم (سنعرض واجهة تفاعلية بسيطة)
  };

  // تقديم عميل جديد فورياً داخل نافذة الديون
  const handleQuickAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || 'لا يوجد هاتف',
      debt: 0,
      createdAt: new Date().toISOString()
    };

    onAddCustomer(newCust);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setShowAddCustomerModal(false);
    
    // حدده للبيع مباشرة
    handlePayment(PaymentMethod.DEBT, newCust);
  };

  return (
    <div id="cashier-screen" className="flex flex-col h-full bg-slate-900 text-white select-none">
      
      {/* هيدر معلومات المخزن المالي الحالي لمساعدة الكاشير */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700/50 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">القيمة السوقية للمخزن:</span>
          <span className="font-mono font-semibold text-emerald-400">{formatCurrency(appState.inventory.marketValue)}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span>التكلفة الشرائية:</span>
          <span className="font-mono text-slate-300">{formatCurrency(appState.inventory.purchaseValue)}</span>
        </div>
      </div>

      {/* شاشة العرض الرقمية للمبلغ المكتوب */}
      <div className="flex-1 flex flex-col justify-end px-6 py-4 bg-gradient-to-t from-slate-950 to-slate-900 border-b border-slate-800">
        <span className="text-xs text-emerald-500 font-medium tracking-wide uppercase mb-1">المبلغ المطلوب تسجيله</span>
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500 text-sm">أوقية موريتانية</span>
          <div className="text-right">
            <motion.span 
              key={amountInput}
              initial={{ scale: 0.95, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-5xl font-bold font-mono tracking-tight text-white drop-shadow-md"
            >
              {currentAmount.toLocaleString('ar-MR')}
            </motion.span>
          </div>
        </div>
        
        {/* الربط التلقائي والذكي في الخلفية - يوضح التاجر كم التكلفة والربح لهذه الحسبة */}
        <AnimatePresence>
          {currentAmount > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-3 pt-3 border-t border-slate-800/80 flex justify-between text-xs text-slate-400"
            >
              <div className="flex items-center gap-1">
                <span>التكلفة الشرائية التقريبية:</span>
                <span className="font-mono text-slate-200">{formatCurrency(calculatedMetrics.calculatedCost)}</span>
              </div>
              <div className="flex items-center gap-1 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-920">
                <span className="text-emerald-400">ربح فوري متوقع:</span>
                <span className="font-mono font-bold text-emerald-400">+{formatCurrency(calculatedMetrics.profit)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* لوحة الكاشير السريعة: الأقسام + الأزرار الرقمية */}
      <div className="p-4 bg-slate-950 space-y-4">
        
        {/* اختيار القسم بلمسة واحدة */}
        <div>
          <span className="text-[10px] text-slate-500 block mb-1.5 uppercase font-semibold">1. اختر القسم</span>
          <div className="grid grid-cols-4 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.name}
                id={`cat-btn-${cat.name}`}
                onClick={() => setSelectedCategory(cat.name)}
                className={`py-2 px-1 rounded-xl text-center text-sm font-bold transition-all border duration-100 ${
                  selectedCategory === cat.name 
                    ? `${cat.color} shadow-lg shadow-emerald-950/55 scale-[1.03] ring-2 ring-emerald-400/30` 
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* لوحة المفاتيح الرقمية المدمجة والذكية لتسجيل المبالغ البرقية */}
        <div>
          <span className="text-[10px] text-slate-500 block mb-1.5 uppercase font-semibold">2. اكتب المبلغ</span>
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'C'].map((btn) => (
              <button
                key={btn}
                id={`num-btn-${btn}`}
                onClick={() => handleKeyPair(btn)}
                className={`py-3.5 rounded-xl font-mono text-xl font-semibold transition-all border ${
                  btn === 'C'
                    ? 'bg-rose-950/60 hover:bg-rose-900 border-rose-900 text-rose-300 active:scale-95'
                    : btn === '0' || btn === '00'
                    ? 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/40 text-slate-200 active:scale-95'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700/60 text-white active:scale-95'
                }`}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>

        {/* أزرار الدفع والترحيل المباشر بلمسة واحدة */}
        <div>
          <span className="text-[10px] text-slate-500 block mb-1.5 uppercase font-semibold">3. اضغط وسيلة الدفع فوراً للترحيل</span>
          <div className="grid grid-cols-4 gap-2">
            
            {/* دفع كاش */}
            <button
              id="pay-btn-cash"
              disabled={currentAmount <= 0}
              onClick={() => handlePayment(PaymentMethod.CASH)}
              className={`col-span-1 p-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border ${
                currentAmount > 0 
                  ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-600 text-slate-950 shadow-md shadow-emerald-950/20 active:scale-95' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="text-xs font-bold">كاش</span>
            </button>

            {/* سداد بنكيلي */}
            <button
              id="pay-btn-bankily"
              disabled={currentAmount <= 0}
              onClick={() => handlePayment(PaymentMethod.BANKILY)}
              className={`col-span-1 p-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border ${
                currentAmount > 0 
                  ? 'bg-sky-500 hover:bg-sky-400 border-sky-600 text-slate-950 shadow-md shadow-sky-950/20 active:scale-95' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <CreditCard className="w-5 h-5 text-sky-950" />
              <span className="text-xs font-bold">بنكيلي</span>
            </button>

            {/* مصرفي / سداد */}
            <button
              id="pay-btn-masrify"
              disabled={currentAmount <= 0}
              onClick={() => {
                // نغير الترحيل بين مصرفي أو نقدر نعمل خيارات ثانية، هنا نرحل لمصرفي مباشرة كخيار سريع
                handlePayment(PaymentMethod.MASRIFY);
              }}
              className={`col-span-1 p-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border ${
                currentAmount > 0 
                  ? 'bg-purple-500 hover:bg-purple-400 border-purple-600 text-slate-950 shadow-md shadow-purple-950/20 active:scale-95' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <CreditCard className="w-5 h-5 text-purple-950" />
              <span className="text-xs font-bold">مصرفي</span>
            </button>

            {/* دفع بالدين للمستهلك الزبون */}
            <button
              id="pay-btn-debt"
              disabled={currentAmount <= 0}
              onClick={() => {
                if (currentAmount > 0) setShowDebtOverlay(true);
              }}
              className={`col-span-1 p-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border ${
                currentAmount > 0 
                  ? 'bg-amber-500 hover:bg-amber-400 border-amber-600 text-slate-950 shadow-md shadow-amber-950/20 active:scale-95 animate-pulse' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-xs font-bold">ديْن ⚠️</span>
            </button>

          </div>
        </div>

      </div>

      {/* غطاء البيع بالدين للعملاء - دفتر الديون الرقمي السريع */}
      <AnimatePresence>
        {showDebtOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 z-55 flex flex-col p-4 md:p-6"
          >
            {/* الهيدر */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <button 
                onClick={() => setShowDebtOverlay(false)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h3 className="text-lg font-bold text-amber-400">اختر العميل لترحيل {formatCurrency(currentAmount)} للدين</h3>
              <div className="w-10"></div>
            </div>

            {/* محرك البحث وإضافة عميل مستعجل */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم العميل أو رقم هاتفه..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-amber-500 text-white font-medium"
                />
              </div>
              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/20 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>عميل جديد</span>
              </button>
            </div>

            {/* قائمة العملاء وسلفياتهم السابقة */}
            <div className="flex-1 overflow-y-auto space-y-2 pb-6">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <p className="text-sm">لم يعثر على عميل بهذا الاسم أو الرقم.</p>
                  <p className="text-xs">اضغط على "عميل جديد" لإضافته بسرعة وسجل الدين عليه.</p>
                </div>
              ) : (
                filteredCustomers.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => handlePayment(PaymentMethod.DEBT, customer)}
                    className="w-full text-right p-3.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl flex items-center justify-between transition-all"
                  >
                    <div>
                      <h4 className="font-bold text-white text-sm">{customer.name}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{customer.phone}</p>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] text-slate-500 block">الدين الحالي لديه:</span>
                      <span className={`text-sm font-bold font-mono ${customer.debt > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {formatCurrency(customer.debt)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* مودال فرعي لإضافة زبون مستعجل */}
      <AnimatePresence>
        {showAddCustomerModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 bg-slate-800/60 flex items-center justify-between border-b border-slate-800">
                <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
                <h4 className="font-bold text-white text-sm">تسجيل عميل جديد والبيع له مباشرة</h4>
                <div className="w-5"></div>
              </div>

              <form onSubmit={handleQuickAddCustomer} className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">اسم العميل (ثلاثي أو مميز) *</label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="مثال: اعل ولد محمد"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-amber-500 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">رقم الهاتف (اختياري)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="مثال: 46221122"
                      className="w-full pl-3 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-amber-500 text-white text-right font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md active:scale-95"
                >
                  حفظ وتسجيل البيع فوراً
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
