/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  Coins, 
  ArrowDownLeft, 
  ArrowUpRight, 
  UserMinus, 
  PiggyBank, 
  Activity,
  Check,
  CreditCard
} from 'lucide-react';
import { AppState, Customer, Supplier, TransactionType, PaymentMethod } from '../types';
import { formatCurrency, formatDateTime } from '../utils';

interface ContactsProps {
  appState: AppState;
  onAddTransaction: (tx: any, updatedInventory?: any, updatedAccounts?: any, updatedCustomers?: any, updatedSuppliers?: any) => void;
  onAddCustomer: (customer: Customer) => void;
  onAddSupplier: (supplier: Supplier) => void;
}

export default function Contacts({ appState, onAddTransaction, onAddCustomer, onAddSupplier }: ContactsProps) {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // نماذج الإضافة والجدولة
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showSettleModal, setShowSettleModal] = useState<boolean>(false);

  // حقول إضافة جهة اتصال جديدة
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  // حقول سداد الديون
  const [selectedParty, setSelectedParty] = useState<{ id: string; name: string; type: 'customer' | 'supplier'; currentDebt: number } | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [depositAccount, setDepositAccount] = useState<string>('cash'); // وين بيروح المبلغ أو من وين بيندفع؟ (cash, bankily, masrify, sadad)

  // تصفية وبحث جهات الاتصال
  const filteredCustomers = useMemo(() => {
    return appState.customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    );
  }, [appState.customers, searchTerm]);

  const filteredSuppliers = useMemo(() => {
    return appState.suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.phone.includes(searchTerm)
    );
  }, [appState.suppliers, searchTerm]);

  // إجمالي ديون العملاء (فلوسنا برّا)
  const totalCustomersDebts = useMemo(() => {
    return appState.customers.reduce((sum, c) => sum + c.debt, 0);
  }, [appState.customers]);

  // إجمالي ديون الموردين (مطلوبات علينا)
  const totalSuppliersDebts = useMemo(() => {
    return appState.suppliers.reduce((sum, s) => sum + s.debt, 0);
  }, [appState.suppliers]);

  // ١. حفظ جهة الاتصال الجديدة (سواء عميل أو مورد)
  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (activeTab === 'customers') {
      const newCust: Customer = {
        id: `cust-${Date.now()}`,
        name: name.trim(),
        phone: phone.trim() || 'بلا هاتف',
        debt: 0,
        createdAt: new Date().toISOString()
      };
      onAddCustomer(newCust);
    } else {
      const newSupp: Supplier = {
        id: `supp-${Date.now()}`,
        name: name.trim(),
        phone: phone.trim() || 'بلا هاتف',
        debt: 0,
        createdAt: new Date().toISOString()
      };
      onAddSupplier(newSupp);
    }

    setName('');
    setPhone('');
    setShowAddModal(false);
  };

  // ٢. ترحيل دفعة سداد أو دفع الديون
  const handleSettleDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(settleAmount) || 0;
    if (amount <= 0 || !selectedParty) return;

    if (amount > selectedParty.currentDebt) {
      const confirmExceed = window.confirm('تحذير: القيمة المدفوعة تتجاوز إجمالي الدين المسجل. هل تريد تسجيل العملية كدفعة فائضة ترحل بالسالب؟');
      if (!confirmExceed) return;
    }

    const { id, type, name: partyName } = selectedParty;
    let updatedAccounts = { ...appState.accounts };
    let updatedCustomers = [...appState.customers];
    let updatedSuppliers = [...appState.suppliers];

    const accountKey = depositAccount as 'cash' | 'bankily' | 'masrify' | 'sadad';
    let pMethod = PaymentMethod.CASH;
    let label = 'الخزنة النقذية';

    // مطابقة الحساب والاسم
    switch (depositAccount) {
      case 'bankily': pMethod = PaymentMethod.BANKILY; label = 'تطبيق بنكيلي'; break;
      case 'masrify': pMethod = PaymentMethod.MASRIFY; label = 'تطبيق مصرفي'; break;
      case 'sadad': pMethod = PaymentMethod.SADAD; label = 'تطبيق سداد'; break;
    }

    if (type === 'customer') {
      // سداد دين العميل (يزيد رصيد الكاش/البنك وبنخفص دين العميل)
      updatedAccounts[accountKey] += amount;
      updatedCustomers = appState.customers.map(c => {
        if (c.id === id) {
          return { ...c, debt: Math.max(0, c.debt - amount) };
        }
        return c;
      });

      const tx = {
        id: `tx-${Date.now()}`,
        type: TransactionType.PAY_CUSTOMER,
        amount,
        paymentMethod: pMethod,
        toAccount: depositAccount,
        partyId: id,
        partyName,
        description: `سداد دين من العميل [ ${partyName} ]، تم الاستلام في [ ${label} ]`,
        timestamp: new Date().toISOString(),
      };

      onAddTransaction(tx, undefined, updatedAccounts, updatedCustomers, undefined);

    } else {
      // سداد دين للمورد (بينقص رصيد الكاش/البنك عشان بندفعله وبنخفض دين المورّد علينا)
      if (updatedAccounts[accountKey] < amount) {
        const confirmMinus = window.confirm(`الملحوظة: رصيدك في [ ${label} ] غير كاف للدفع واقعياً، هل تريد إكمال وتمرير رصيد سالب؟`);
        if (!confirmMinus) return;
      }
      updatedAccounts[accountKey] -= amount;
      updatedSuppliers = appState.suppliers.map(s => {
        if (s.id === id) {
          return { ...s, debt: Math.max(0, s.debt - amount) };
        }
        return s;
      });

      const tx = {
        id: `tx-${Date.now()}`,
        type: TransactionType.PAY_SUPPLIER,
        amount,
        paymentMethod: pMethod,
        fromAccount: depositAccount,
        partyId: id,
        partyName,
        description: `أداء مستحقات ودفع دين للمورد [ ${partyName} ]، تم السحب من [ ${label} ]`,
        timestamp: new Date().toISOString(),
      };

      onAddTransaction(tx, undefined, updatedAccounts, undefined, updatedSuppliers);
    }

    // تصفير وتنظيف المودال
    setSettleAmount('');
    setSelectedParty(null);
    setShowSettleModal(false);
    alert('تم ترحيل دفعة السداد وتحديث أرصدة الحسابات والديون بنجاح دقيق! ✅');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white min-h-[calc(100vh-64px)] pb-12 overflow-y-auto">
      
      {/* البطاقات العلوية المالي لملخص الديون الإجمالي */}
      <div className="p-4 grid grid-cols-2 gap-3">
        
        {/* ديون العملاء لصالجنا (فلوسنا برا) */}
        <div className="bg-amber-950/20 p-4 rounded-2xl border border-amber-900/40 relative overflow-hidden">
          <div className="absolute left-3 top-3 text-amber-500/80">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <p className="text-[10px] text-amber-400 font-bold uppercase">الديون المستحقة لنا (العملاء)</p>
          <p className="text-xl font-bold font-mono text-amber-300 mt-1">{formatCurrency(totalCustomersDebts)}</p>
          <span className="text-[9px] text-slate-500 block mt-1.5">{appState.customers.length} عملاء مسجلين</span>
        </div>

        {/* ديون الموردين علينا (فلوس للناس) */}
        <div className="bg-rose-950/25 p-4 rounded-2xl border border-rose-900/40 relative overflow-hidden">
          <div className="absolute left-3 top-3 text-rose-500/80">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <p className="text-[10px] text-rose-400 font-bold uppercase">الديون المستحقة علينا (للموردين)</p>
          <p className="text-xl font-bold font-mono text-rose-300 mt-1">{formatCurrency(totalSuppliersDebts)}</p>
          <span className="text-[9px] text-slate-500 block mt-1.5">{appState.suppliers.length} موردين مصنفين</span>
        </div>

      </div>

      {/* شريط التحكم: البحث وتبديل التبويبات */}
      <div className="px-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => { setActiveTab('customers'); setSearchTerm(''); }}
            className={`pb-3 pt-1 text-sm font-bold relative transition-all ${
              activeTab === 'customers' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>دفتر ديون الزبناء</span>
            {activeTab === 'customers' && (
              <motion.div layoutId="contact-active-bar" className="absolute bottom-0 right-0 left-0 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => { setActiveTab('suppliers'); setSearchTerm(''); }}
            className={`pb-3 pt-1 text-sm font-bold relative transition-all ${
              activeTab === 'suppliers' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>حقوق الموردين (الموزعين)</span>
            {activeTab === 'suppliers' && (
              <motion.div layoutId="contact-active-bar" className="absolute bottom-0 right-0 left-0 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className={`flex items-center gap-1.5 text-xs font-bold py-1 px-3 border rounded-xl shadow-sm transition-all ${
            activeTab === 'customers' 
              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30' 
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-450 border-emerald-500/30'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{activeTab === 'customers' ? 'عميل جديد' : 'مورد جديد'}</span>
        </button>
      </div>

      {/* صندوق البحث المستمر والسريع من التابلت أو الجوال */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={activeTab === 'customers' ? "ابحث في الزبناء بالاسم أو الهاتف..." : "ابحث في الموردين بالاسم أو رقم الاتصال..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50 placeholder:text-slate-600 font-medium"
          />
        </div>
      </div>

      {/* قائمة جهات الاتصال المسجلة حالياً */}
      <div className="px-4 space-y-2 flex-1">
        {activeTab === 'customers' ? (
          filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-slate-600 text-xs">لا يوجد عملاء يطابقون خيارات البحث.</div>
          ) : (
            filteredCustomers.map(cust => (
              <div 
                key={cust.id} 
                className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-805/50 flex items-center justify-between transition-all hover:bg-slate-800/60"
              >
                <div>
                  <h4 className="font-bold text-white text-sm">{cust.name}</h4>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-1 font-mono">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{cust.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">الدين الحالي</span>
                    <span className={`text-sm font-bold font-mono ${cust.debt > 0 ? 'text-rose-450' : 'text-slate-400'}`}>
                      {formatCurrency(cust.debt)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedParty({
                        id: cust.id,
                        name: cust.name,
                        type: 'customer',
                        currentDebt: cust.debt
                      });
                      setShowSettleModal(true);
                    }}
                    disabled={cust.debt <= 0}
                    className={`py-1.5 px-3 rounded-xl text-[10px] font-bold border transition-all ${
                      cust.debt > 0 
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 border-amber-600 active:scale-95 cursor-pointer font-extrabold' 
                        : 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    قبض سداد 💰
                  </button>
                </div>
              </div>
            ))
          )
        ) : (
          filteredSuppliers.length === 0 ? (
            <div className="text-center py-12 text-slate-600 text-xs">لا يوجد موردون يطابقون البحث.</div>
          ) : (
            filteredSuppliers.map(supp => (
              <div 
                key={supp.id} 
                className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-805/50 flex items-center justify-between transition-all hover:bg-slate-800/60"
              >
                <div>
                  <h4 className="font-bold text-white text-sm">{supp.name}</h4>
                  <div className="flex items-center gap-1.5 text-slate-405 text-[11px] mt-1 font-mono">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{supp.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">مطلوب علينا</span>
                    <span className={`text-sm font-bold font-mono ${supp.debt > 0 ? 'text-amber-450' : 'text-slate-450'}`}>
                      {formatCurrency(supp.debt)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedParty({
                        id: supp.id,
                        name: supp.name,
                        type: 'supplier',
                        currentDebt: supp.debt
                      });
                      setShowSettleModal(true);
                    }}
                    disabled={supp.debt <= 0}
                    className={`py-1.5 px-3 rounded-xl text-[10px] font-bold border transition-all ${
                      supp.debt > 0 
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 border-emerald-600 active:scale-95 cursor-pointer font-extrabold' 
                        : 'bg-slate-900 border-slate-850 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    دفع دين المورّد 💸
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* مودال منبثق لإضافة جهة اتصال جديدة */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 bg-slate-800/80 flex items-center justify-between border-b border-slate-805">
                <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-450 hover:text-white text-xs font-bold">
                  إغلاق
                </button>
                <h4 className="font-bold text-white text-sm">
                  {activeTab === 'customers' ? 'إضافة زبون لدليل الديون' : 'إضافة مورّد جديد للمحل'}
                </h4>
                <div className="w-5"></div>
              </div>

              <form onSubmit={handleCreateContact} className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={activeTab === 'customers' ? "مثال: سالم ولد الراضي" : "مثال: شركة النعمة الوطنية للخضار"}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-805 rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">رقم الهاتف للاتصال</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: 46115599"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-805 rounded-xl text-xs text-white text-right font-mono focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full py-2.5 font-bold rounded-xl text-xs transition-all text-slate-950 shadow ${
                    activeTab === 'customers' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-emerald-500 hover:bg-emerald-450'
                  }`}
                >
                  حفظ وتسجيل جهة الاتصال
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* مودال سداد الديون (الموحد للعملاء والموردين) */}
      <AnimatePresence>
        {showSettleModal && selectedParty && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 bg-slate-800/80 flex items-center justify-between border-b border-slate-850">
                <button type="button" onClick={() => { setSelectedParty(null); setShowSettleModal(false); }} className="text-slate-400 hover:text-white text-xs font-bold">
                  إلغاء
                </button>
                <h4 className="font-bold text-white text-sm">تسجيل سداد مالي للدفاتر</h4>
                <div className="w-5"></div>
              </div>

              <form onSubmit={handleSettleDebt} className="p-5 space-y-4">
                
                {/* تفاصيل جهة الاتصال المسددة */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-550 block text-[9px] mb-0.5">صاحب الحساب</span>
                    <span className="font-bold text-white">{selectedParty.name}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-slate-550 block text-[9px] mb-0.5">
                      {selectedParty.type === 'customer' ? 'الديْن المتبقي عليه' : 'ديننا المسجل له'}
                    </span>
                    <span className="font-mono font-bold text-rose-450">{formatCurrency(selectedParty.currentDebt)}</span>
                  </div>
                </div>

                {/* ادخال المبلغ المسدد */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">المبلغ المدفوع حقيقةً *</label>
                  <input
                    type="number"
                    required
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder="أدخل مبلغ السداد بالأوقية"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-805 rounded-xl text-sm font-mono text-white focus:outline-none"
                  />
                </div>

                {/* ادخال الحساب البنكي / الخزنة المعنية */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    {selectedParty.type === 'customer' ? 'الحساب الذي استقبلنا فيه المال (إيداع)' : 'الحساب المالي الذي سحبنا منه لتسليمه (سحب)'}
                  </label>
                  <select
                    value={depositAccount}
                    onChange={(e) => setDepositAccount(e.target.value)}
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
                  className={`w-full py-2.5 font-bold rounded-2xl text-xs transition-all text-slate-950 shadow-md ${
                    selectedParty.type === 'customer' ? 'bg-amber-400 hover:bg-amber-300' : 'bg-emerald-400 hover:bg-emerald-300'
                  }`}
                >
                  ترحيل عملية السداد وتعديل الدفتر
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
