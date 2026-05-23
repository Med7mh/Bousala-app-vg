/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, 
  ArrowLeftRight, 
  FileText, 
  Clock, 
  HelpCircle, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Share2, 
  Coins, 
  Landmark,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  TrendingUpIcon
} from 'lucide-react';
import { AppState, TransactionType, PaymentMethod, AccountBalances } from '../types';
import { formatCurrency, formatDateTime } from '../utils';

interface AccountsProps {
  appState: AppState;
  onAddTransaction: (tx: any, updatedInventory?: any, updatedAccounts?: any) => void;
}

export default function Accounts({ appState, onAddTransaction }: AccountsProps) {
  const [activeTab, setActiveTab] = useState<'vault' | 'history'>('vault');
  const [filterType, setFilterType] = useState<string>('ALL');

  // نماذج التحويل والمصروفات
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);

  // حقول التحويل الداخلي
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [fromAccount, setFromAccount] = useState<keyof AccountBalances>('cash');
  const [toAccount, setToAccount] = useState<keyof AccountBalances>('bankily');

  // حقول المصروفات العامة المباشرة
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseSource, setExpenseSource] = useState<keyof AccountBalances>('cash');
  const [expenseDescription, setExpenseDescription] = useState<string>('شراء أكياس بلاستيكية للتعبئة');

  // حساب السيولة الإجمالية المتوفرة حالياً
  const totalLiquidity = useMemo(() => {
    const { cash, bankily, masrify, sadad } = appState.accounts;
    return cash + bankily + masrify + sadad;
  }, [appState.accounts]);

  // تصفية السجل المالي
  const filteredTransactions = useMemo(() => {
    if (filterType === 'ALL') {
      return [...appState.transactions].reverse();
    }
    return appState.transactions.filter(tx => tx.type === filterType).reverse();
  }, [appState.transactions, filterType]);

  // حساب كشف ملخص للأرباح والخسائر السريعة من السجل لغرض الإحصاء
  const financialSummary = useMemo(() => {
    let salesTotal = 0;
    let netProfitTotal = 0;
    let purchaseTotal = 0;
    let lossesTotal = 0;
    let directExpenses = 0;

    appState.transactions.forEach(tx => {
      if (tx.type === TransactionType.SALE) {
        salesTotal += tx.amount;
        if (tx.details?.profit) {
          netProfitTotal += tx.details.profit;
        }
      } else if (tx.type === TransactionType.PURCHASE) {
        purchaseTotal += tx.amount;
      } else if (tx.type === TransactionType.DAMAGED) {
        lossesTotal += tx.amount; // البضاعة التالفة بالعملة
      } else if (tx.type === TransactionType.EXPENSE) {
        directExpenses += tx.amount; // المصروفات المباشرة
      }
    });

    return {
      salesTotal,
      netProfitTotal: Math.max(0, netProfitTotal - lossesTotal - directExpenses), // الربح الصافي الفعلي بعد خصم الهدر والمصاريف
      purchaseTotal,
      lossesTotal,
      directExpenses
    };
  }, [appState.transactions]);

  // ١. تنفيذ عملية تحويل مالي بين الحسابات
  const handleInternalTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount) || 0;
    if (amount <= 0) return;

    if (fromAccount === toAccount) {
      alert('لا يمكنك التحويل لنفس الحساب المكتشف!');
      return;
    }

    if (appState.accounts[fromAccount] < amount) {
      const confirmTransfer = window.confirm(`الملحوظة: حساب المصدر غير كافٍ واقعياً، هل تريد إكمال وتمرير رصيد سالب؟`);
      if (!confirmTransfer) return;
    }

    const updatedAccounts = { ...appState.accounts };
    updatedAccounts[fromAccount] -= amount;
    updatedAccounts[toAccount] += amount;

    const translateAccount = (key: string) => {
      if (key === 'cash') return 'الخزنة النقذية';
      if (key === 'bankily') return 'تطبيق بنكيلي';
      if (key === 'masrify') return 'تطبيق مصرفي';
      return 'تطبيق سداد';
    };

    const description = `تحويل داخلي بقيمة: [ ${formatCurrency(amount)} ] من [ ${translateAccount(fromAccount)} ] إلى [ ${translateAccount(toAccount)} ]`;

    const tx = {
      id: `tx-${Date.now()}`,
      type: TransactionType.TRANSFER,
      amount,
      fromAccount,
      toAccount,
      description,
      timestamp: new Date().toISOString()
    };

    onAddTransaction(tx, undefined, updatedAccounts);
    setTransferAmount('');
    setShowTransferModal(false);
    alert('تم التحويل وتسجيل القيد بنجاح! 🔃');
  };

  // ٢. تسجيل مصروف مباشر
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount) || 0;
    if (amount <= 0 || !expenseDescription.trim()) return;

    if (appState.accounts[expenseSource] < amount) {
      const confirmExpense = window.confirm(`الملحوظة: الرصيد غير كافٍ واقعياً، هل تريد الاستمرار وتسجيل الحساب بالسالب؟`);
      if (!confirmExpense) return;
    }

    const updatedAccounts = { ...appState.accounts };
    updatedAccounts[expenseSource] -= amount;

    const translateAccount = (key: string) => {
      if (key === 'cash') return 'الخزنة النقذية';
      if (key === 'bankily') return 'تطبيق بنكيلي';
      if (key === 'masrify') return 'تطبيق مصرفي';
      return 'تطبيق سداد';
    };

    const description = `مصروف مباشر: [ ${expenseDescription.trim()} ] - تم الدفع من [ ${translateAccount(expenseSource)} ]`;

    const tx = {
      id: `tx-${Date.now()}`,
      type: TransactionType.EXPENSE,
      amount,
      fromAccount: expenseSource,
      description,
      timestamp: new Date().toISOString()
    };

    onAddTransaction(tx, undefined, updatedAccounts);
    setExpenseAmount('');
    setExpenseDescription('شراء أكياس بلاستيكية للتعبئة');
    setShowExpenseModal(false);
    alert('تم قيد المصروف بنجاح وخصمه من الحساب! 🧾');
  };

  // ترجمة أنواع العمليات إلى العربية بوشاح ملون
  const getTxBadge = (type: TransactionType) => {
    switch (type) {
      case TransactionType.SALE:
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">مبيعات</span>;
      case TransactionType.PURCHASE:
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">مشتريات</span>;
      case TransactionType.DAMAGED:
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">تالف وهدر</span>;
      case TransactionType.PRICE_ADJUST:
        return <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">تعديل سعر</span>;
      case TransactionType.PAY_CUSTOMER:
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">سداد دين</span>;
      case TransactionType.PAY_SUPPLIER:
        return <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">دفع للمورّد</span>;
      case TransactionType.TRANSFER:
        return <span className="bg-slate-500/20 text-slate-300 border border-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">تحويل رصيد</span>;
      case TransactionType.EXPENSE:
        return <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">مصروف عام</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white min-h-[calc(100vh-64px)] pb-12 overflow-y-auto">
      
      {/* مؤشر إجمالي السيولة النقدية المتاحة كأصل مركزي */}
      <div className="p-4 bg-gradient-to-b from-slate-850 to-slate-900 border-b border-slate-800">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">إجمالي السيولة النقدية المتوفرة حالياً</p>
        <h2 className="text-3xl font-extrabold font-mono text-emerald-400">{formatCurrency(totalLiquidity)}</h2>
        
        {/* أرباح حية متحققة من السجل لمصادقة نجاح التاجر */}
        <div className="flex items-center gap-2 mt-3 text-xs">
          <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2 py-1 rounded-xl flex items-center gap-1 font-semibold">
            <TrendingUpIcon className="w-3.5 h-3.5" />
            <span>صافي أرباح المحل الفعلية: {formatCurrency(financialSummary.netProfitTotal)}</span>
          </div>
        </div>
      </div>

      {/* التبويبات الفرعية: الأرصدة والسجل المالي الفعلي */}
      <div className="px-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('vault')}
            className={`pb-3 pt-3 text-sm font-bold relative transition-all ${
              activeTab === 'vault' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <span>أرصدة التطبيقات والخزنة</span>
            {activeTab === 'vault' && (
              <motion.div layoutId="acc-active-bar" className="absolute bottom-0 right-0 left-0 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 pt-3 text-sm font-bold relative transition-all ${
              activeTab === 'history' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <span>سجل العمليات (الدفتر)</span>
            {activeTab === 'history' && (
              <motion.div layoutId="acc-active-bar" className="absolute bottom-0 right-0 left-0 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>
        </div>

        {/* أزرار العمليات السريعة من هيدر الحسابات */}
        {activeTab === 'vault' && (
          <div className="flex gap-1.5 py-2">
            <button
              onClick={() => setShowTransferModal(true)}
              className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1.5 rounded-lg flex items-center gap-1"
            >
              <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
              <span>تحويل رصيد</span>
            </button>

            <button
              onClick={() => setShowExpenseModal(true)}
              className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1.5 rounded-lg flex items-center gap-1"
            >
              <PlusCircle className="w-3 h-3 text-rose-400" />
              <span>مصروف مباشر</span>
            </button>
          </div>
        )}
      </div>

      {/* المحتوى الفعلي */}
      <div className="flex-1 p-4">
        <AnimatePresence mode="wait">
          
          {/* تبويب: أرصدة التطبيقات والخزنة */}
          {activeTab === 'vault' && (
            <motion.div 
              key="vault-list"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              {/* قائمة الحسابات بتصميم بطاقات متناسقة */}
              <div className="grid grid-cols-1 gap-2.5">
                
                {/* ١. الخزنة النقذية */}
                <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-amber-400">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">الخزنة النقذية (كاش المحل)</h3>
                      <p className="text-[10px] text-slate-500">الأوراق النقدية والعملة المعدنية المتوفرة بالمنضدة</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg text-amber-400">{formatCurrency(appState.accounts.cash)}</span>
                </div>

                {/* ٢. بنكيلي Bankily */}
                <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/20 text-sky-450">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">تطبيق بنكيلي (Bankily)</h3>
                      <p className="text-[10px] text-slate-500">رصيد حساب بنك الصادرات الموريتاني (BPM)</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg text-sky-400">{formatCurrency(appState.accounts.bankily)}</span>
                </div>

                {/* ٣. مصرفي Masrify */}
                <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20 text-purple-400">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">تطبيق جيب مصرفي (Masrify)</h3>
                      <p className="text-[10px] text-slate-500">رصيد حساب التجاري بنك الموريتاني</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg text-purple-400">{formatCurrency(appState.accounts.masrify)}</span>
                </div>

                {/* ٤. سداد Sadad */}
                <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-teal-500/10 p-2.5 rounded-xl border border-teal-500/20 text-teal-400">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">تطبيق السداد (Sadad)</h3>
                      <p className="text-[10px] text-slate-500">رصيد حساب بنك الأمان الموريتاني</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg text-teal-400">{formatCurrency(appState.accounts.sadad)}</span>
                </div>

              </div>

              {/* ملخص إحصائيات الجلسة لتوعية وتحفيز البائع */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">كشف التحليلات المالي لليوم</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block">مبيعات اليوم الكلية</span>
                    <span className="font-mono text-sm text-slate-200 font-bold">{formatCurrency(financialSummary.salesTotal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">صافي الأرباح</span>
                    <span className="font-mono text-sm text-emerald-400 font-bold">+{formatCurrency(financialSummary.netProfitTotal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">التالف والخسران</span>
                    <span className="font-mono text-sm text-rose-450 font-bold">-{formatCurrency(financialSummary.lossesTotal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">مصروفات إدارية</span>
                    <span className="font-mono text-sm text-slate-400 font-bold">-{formatCurrency(financialSummary.directExpenses)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* تبويب: دفتر العمليات التاريخي وقوات السنترة */}
          {activeTab === 'history' && (
            <motion.div 
              key="history-panel"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              {/* خيارات تصفية دفتر اليومية المالي */}
              <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-3 py-1.5 rounded-xl border shrink-0 transition-all ${
                    filterType === 'ALL' ? 'bg-white text-slate-950 border-white font-bold' : 'bg-slate-800 text-slate-350 border-slate-800'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setFilterType(TransactionType.SALE)}
                  className={`px-3 py-1.5 rounded-xl border shrink-0 transition-all ${
                    filterType === TransactionType.SALE ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-bold' : 'bg-slate-800 text-slate-350 border-slate-800'
                  }`}
                >
                  مبيعات
                </button>
                <button
                  onClick={() => setFilterType(TransactionType.PURCHASE)}
                  className={`px-3 py-1.5 rounded-xl border shrink-0 transition-all ${
                    filterType === TransactionType.PURCHASE ? 'bg-blue-500 text-slate-950 border-blue-500 font-bold' : 'bg-slate-800 text-slate-350 border-slate-800'
                  }`}
                >
                  مشتريات
                </button>
                <button
                  onClick={() => setFilterType(TransactionType.DAMAGED)}
                  className={`px-3 py-1.5 rounded-xl border shrink-0 transition-all ${
                    filterType === TransactionType.DAMAGED ? 'bg-rose-500 text-slate-950 border-rose-500 font-bold' : 'bg-slate-800 text-slate-350 border-slate-800'
                  }`}
                >
                  تالف وخسائر
                </button>
                <button
                  onClick={() => setFilterType(TransactionType.PAY_CUSTOMER)}
                  className={`px-3 py-1.5 rounded-xl border shrink-0 transition-all ${
                    filterType === TransactionType.PAY_CUSTOMER ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold' : 'bg-slate-800 text-slate-350 border-slate-800'
                  }`}
                >
                  سداد ديون
                </button>
              </div>

              {/* ورقة العمليات الفعلية */}
              <div className="space-y-2 pb-6">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-12 text-slate-600 text-xs">لا يوجد مقيدات مالية تطابق الصنف المختار.</div>
                ) : (
                  filteredTransactions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-800 flex flex-col gap-2 transition-all hover:bg-slate-800/65"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTxBadge(tx.type)}
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span className="font-mono">{formatDateTime(tx.timestamp)}</span>
                          </div>
                        </div>

                        {/* سعر العملية وحساب التكلفة والربح الملتصق بالبيع */}
                        <div className="text-left">
                          <span className="font-mono font-extrabold text-sm text-slate-150">
                            {tx.type === TransactionType.DAMAGED || tx.type === TransactionType.EXPENSE
                              ? `-${formatCurrency(tx.amount)}`
                              : formatCurrency(tx.amount)
                            }
                          </span>
                        </div>
                      </div>

                      {/* المكتوب التوضيحي بالكامل */}
                      <p className="text-xs text-slate-300 font-medium leading-relaxed">{tx.description}</p>
                      
                      {/* تفاصيل الربح للعمليات البيعية التلقائية لكي تذكر وتؤكد نجاح العملية */}
                      {tx.type === TransactionType.SALE && tx.details?.profit !== undefined && (
                        <div className="p-2 bg-emerald-950/20 border border-emerald-900/10 rounded-xl flex justify-between items-center text-[10px] text-slate-400 font-mono">
                          <span>التكلفة: {formatCurrency(tx.details.calculatedCost || 0)}</span>
                          <span className="text-emerald-400 font-bold">الربح الصافي: +{formatCurrency(tx.details.profit || 0)}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* مودال التحويل الداخلي بين الحسابات */}
      <AnimatePresence>
        {showTransferModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 bg-slate-800/80 flex items-center justify-between border-b border-slate-800">
                <button type="button" onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">
                  إلغاء
                </button>
                <h4 className="font-bold text-white text-sm">تحويل داخلي لتطبيقات البنك</h4>
                <div className="w-5"></div>
              </div>

              <form onSubmit={handleInternalTransfer} className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">مبلغ التحويل المطلوب *</label>
                  <input
                    type="number"
                    required
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="أدخل قيمة التحويل بالأوقية"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-805 rounded-xl font-mono text-sm text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">من حساب (المرسل)</label>
                    <select
                      value={fromAccount}
                      onChange={(e: any) => setFromAccount(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-805 rounded-xl text-xs"
                    >
                      <option value="cash">الCash الخزنة</option>
                      <option value="bankily">بنكيلي</option>
                      <option value="masrify">مصرفي</option>
                      <option value="sadad">سداد</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">إلى حساب (المتلقي)</label>
                    <select
                      value={toAccount}
                      onChange={(e: any) => setToAccount(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-805 rounded-xl text-xs"
                    >
                      <option value="bankily">بنكيلي</option>
                      <option value="cash">الCash الخزنة</option>
                      <option value="masrify">مصرفي</option>
                      <option value="sadad">سداد</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-xl font-bold text-xs"
                >
                  ترحيل وإتمام عملية النقل المالي
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* مودال تسجيل المصروفات المباشرة */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 bg-slate-800/80 flex items-center justify-between border-b border-slate-800">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">
                  إلغاء
                </button>
                <h4 className="font-bold text-white text-sm">تسجيل مصروفات المحل المباشرة</h4>
                <div className="w-5"></div>
              </div>

              <form onSubmit={handleAddExpense} className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">مبلغ المصروف بالأوقية *</label>
                  <input
                    type="number"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="قيمة المصروف نقداً"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-805 rounded-xl font-mono text-sm text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">طبيعة أو بيان المصروف *</label>
                  <input
                    type="text"
                    required
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                    placeholder="مثال: فاتورة كهرباء المحل، كراء، أكياس بصل"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-805 rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">دفع الخصم المالي من حساب</label>
                  <select
                    value={expenseSource}
                    onChange={(e: any) => setExpenseSource(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-805 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="cash">الخزنة النقذية (كاش بـ {formatCurrency(appState.accounts.cash)})</option>
                    <option value="bankily">تطبيق بنكيلي (رصيد: {formatCurrency(appState.accounts.bankily)})</option>
                    <option value="masrify">تطبيق مصرفي (رصيد: {formatCurrency(appState.accounts.masrify)})</option>
                    <option value="sadad">تطبيق سداد (رصيد: {formatCurrency(appState.accounts.sadad)})</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 font-bold text-white rounded-xl text-xs"
                >
                  ترحيل وخصم المصاريف
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
