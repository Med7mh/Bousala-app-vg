/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  PlusCircle, 
  Trash2, 
  RefreshCcw, 
  ChevronDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Store,
  Users,
  AlertTriangle,
  Coins,
  Percent
} from 'lucide-react';
import { AppState, TransactionType, PaymentMethod, Supplier } from '../types';
import { formatCurrency } from '../utils';

interface InventoryProps {
  appState: AppState;
  onAddTransaction: (tx: any, updatedInventory?: any, updatedAccounts?: any, updatedCustomers?: any, updatedSuppliers?: any) => void;
  onAddSupplier: (supplier: Supplier) => void;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export default function Inventory({ appState, onAddTransaction, onAddSupplier, setAppState }: InventoryProps) {
  // للتحكم في النوافذ المنبثقة والتبويبات
  const [activeTab, setActiveTab] = useState<'purchase' | 'fluctuation' | 'waste' | 'manual_adjust'>('purchase');

  // حقول التعديل اليدوي والافتتاحي
  const [manualPurchase, setManualPurchase] = useState<string>('');
  const [manualMarket, setManualMarket] = useState<string>('');
  
  // حاسبة التقلب اليدوية
  const [customFluctuation, setCustomFluctuation] = useState<string>('');
  
  // حقول إضافة مشتريات للمخزن
  const [purchaseCost, setPurchaseCost] = useState<string>('');
  const [projectedValue, setProjectedValue] = useState<string>('');
  const [fundingSource, setFundingSource] = useState<string>('cash'); // cash, bankily, masrify, sadad, supplier_debt
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');
  
  // حقول تقلب الأسعار
  const [adjustPercentage, setAdjustPercentage] = useState<number>(-10); // الافتراضي هبوط 10%

  // حقول إدارة التالف
  const [damagedAmount, setDamagedAmount] = useState<string>('');
  const [damageType, setDamageType] = useState<'purchase' | 'market'>('purchase'); // هل التقدير بالتكلفة الشرائية أم السوقية
  const [damagedReason, setDamagedReason] = useState<string>('بسبب الذبول الطبيعي أو الرطوبة');

  // حساب الأرباح المتوقعة لغرض العرض البصري الجذاب الموجه للتاجر
  const { expectedProfit, profitPercentage } = useMemo(() => {
    const { purchaseValue, marketValue } = appState.inventory;
    const diff = marketValue - purchaseValue;
    const percentage = purchaseValue > 0 ? (diff / purchaseValue) * 100 : 0;
    return {
      expectedProfit: Math.max(0, diff),
      profitPercentage: percentage
    };
  }, [appState.inventory]);

  // حساب النسبة المقترحة للبيع في حقل المشتريات لتسريع العمل
  const handleAutoCalcMarketValue = () => {
    const cost = parseFloat(purchaseCost) || 0;
    if (cost > 0) {
      // نقترح بيعها بزيادة ٢٥٪ كقيمة سوقية افتراضية لتوفير الوقت للتاجر
      setProjectedValue(Math.round(cost * 1.25).toString());
    }
  };

  // ١. تقديم عملية شراء بضاعة جديدة للمخزن وترحيلها للحسابات
  const handleAddPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(purchaseCost) || 0;
    const market = parseFloat(projectedValue) || 0;

    if (cost <= 0 || market <= 0) {
      alert('الرجاء إدخال أرقام صحيحة وتتجاوز الصفر');
      return;
    }

    // تجهيز قيم المخزون المالي المحدثة
    const updatedInventory = {
      purchaseValue: appState.inventory.purchaseValue + cost,
      marketValue: appState.inventory.marketValue + market
    };

    let updatedAccounts = { ...appState.accounts };
    let updatedSuppliers = [...appState.suppliers];
    let methodUsed = PaymentMethod.CASH;
    let label = 'الخزنة النقذية';
    let supplierName = '';

    // تكييف مصدر التمويل
    if (fundingSource === 'supplier_debt') {
      methodUsed = PaymentMethod.DEBT;
      const supplier = appState.suppliers.find(s => s.id === selectedSupplierId);
      if (!supplier) {
        alert('الرجاء تحديد المورد لكي نتمكن من ترحيل الدين لدفتره المالي');
        return;
      }
      supplierName = supplier.name;
      // زيادة دين المورد
      updatedSuppliers = appState.suppliers.map(s => {
        if (s.id === selectedSupplierId) {
          return { ...s, debt: s.debt + cost };
        }
        return s;
      });
    } else {
      const accountKey = fundingSource as 'cash' | 'bankily' | 'masrify' | 'sadad';
      if (updatedAccounts[accountKey] < cost) {
        const confirmAnyway = window.confirm(`الملحوظة: رصيد [ ${accountKey} ] غير كافٍ. هل تريد مواصلة العملية وتسجيل كشف بالسالب ليتطابق مع صندوقك الواقعي؟`);
        if (!confirmAnyway) return;
      }
      updatedAccounts[accountKey] -= cost;
      
      switch(fundingSource) {
        case 'bankily': methodUsed = PaymentMethod.BANKILY; label = 'تطبيق بنكيلي'; break;
        case 'masrify': methodUsed = PaymentMethod.MASRIFY; label = 'تطبيق مصرفي'; break;
        case 'sadad': methodUsed = PaymentMethod.SADAD; label = 'تطبيق سداد'; break;
      }
    }

    const description = fundingSource === 'supplier_debt'
      ? `شراء بضاعة للمخزن بالآجل (دين) من المورد: ${supplierName}`
      : `شراء بضاعة للمخزن نقداً بتمويل من [ ${label} ]`;

    const tx = {
      id: `tx-${Date.now()}`,
      type: TransactionType.PURCHASE,
      amount: cost,
      paymentMethod: methodUsed,
      fromAccount: fundingSource === 'supplier_debt' ? 'DEBT' : fundingSource,
      partyId: fundingSource === 'supplier_debt' ? selectedSupplierId : undefined,
      partyName: fundingSource === 'supplier_debt' ? supplierName : undefined,
      description,
      timestamp: new Date().toISOString(),
      details: {
        prevValue: appState.inventory.purchaseValue,
        newValue: updatedInventory.purchaseValue,
        marketValueAdded: market
      }
    };

    onAddTransaction(tx, updatedInventory, updatedAccounts, undefined, updatedSuppliers);
    
    // تصفير الحقول
    setPurchaseCost('');
    setProjectedValue('');
    setSelectedSupplierId('');
    
    alert('تم ترحيل المشتريات وتحديث قيم المخازن المالي والحسابات بنجاح! 🚀');
  };

  // ٢. تطبيق حاسبة تقلب الأسعار في السوق (تعديل القيمة السوقية بضغطة زر)
  const handlePriceAdjustment = (percentage: number) => {
    const marketVal = appState.inventory.marketValue;
    if (marketVal <= 0) {
      alert('المخزن فارغ تماماً حالياً، لا توجد قيمة سوقية لتعديلها!');
      return;
    }

    const multiplier = 1 + (percentage / 100);
    const newValue = Math.round(marketVal * multiplier);
    
    const updatedInventory = {
      ...appState.inventory,
      marketValue: newValue
    };

    const actionText = percentage < 0 ? `تخفيض أسعار السوق` : `ارتفاع أسعار السوق`;
    const description = `تعديل قيمة المخزن السوقية بنسبة [ ${percentage}% ] لمواكبة تقلبات السوق (${actionText})`;

    const tx = {
      id: `tx-${Date.now()}`,
      type: TransactionType.PRICE_ADJUST,
      amount: Math.abs(newValue - marketVal),
      description,
      timestamp: new Date().toISOString(),
      details: {
        prevValue: marketVal,
        newValue: newValue
      }
    };

    onAddTransaction(tx, updatedInventory);
    alert(`تم تعديل القيمة السوقية للمخزن بمقدار ${percentage}% بنجاح! 🥬`);
  };

  // تعيين الأرصدة الافتتاحية / اليدوية للمخزن بدون تأثير على الصندوق
  const handleManualAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    const pVal = parseFloat(manualPurchase) || 0;
    const mVal = parseFloat(manualMarket) || 0;
    if (pVal < 0 || mVal < 0) return;
    const confirmIt = window.confirm('هل أنت متأكد من تغيير أصول المخزن المالي يدوياً؟ هذا سيستبدل القيم الحالية.');
    if (!confirmIt) return;

    const tx = {
      id: `tx-${Date.now()}`,
      type: TransactionType.INVENTORY_ADJUST,
      amount: 0,
      description: `تعديل يدوي/افتتاحي للمخزن. القيمة الشرائية: ${formatCurrency(pVal)}، السوقية: ${formatCurrency(mVal)}`,
      timestamp: new Date().toISOString(),
      details: {
        prevPurchaseValue: appState.inventory.purchaseValue,
        prevMarketValue: appState.inventory.marketValue,
        newValue: pVal,
      }
    };
    
    setAppState(prev => ({
      ...prev,
      inventory: { purchaseValue: pVal, marketValue: mVal },
      transactions: [...prev.transactions, tx]
    }));
    
    setManualPurchase('');
    setManualMarket('');
    alert('تم تعيين أرصدة المخزن الافتتاحية/اليدوية بنجاح! 📦');
  };

  // ٣. تسجيل البضاعة التالفة والهدر من الخضار
  const handleAddDamage = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(damagedAmount) || 0;
    if (amount <= 0) {
      alert('الرجاء إدخال قيمة تالف صحيحة');
      return;
    }

    const currentInventory = appState.inventory;
    let purchaseDeduct = 0;
    let marketDeduct = 0;

    if (damageType === 'purchase') {
      // المتلف مقدر بالتكلفة الشرائية
      purchaseDeduct = amount;
      // نحسب ما يقابلها في القيمة السوقية بالاعتماد على النسبة الحالية لكي لا ينحرف الميزان المالي
      const ratio = currentInventory.purchaseValue > 0 ? (currentInventory.marketValue / currentInventory.purchaseValue) : 1.25;
      marketDeduct = amount * ratio;
    } else {
      // المتلف مقدر بالقيمة السوقية (قيمة البيع المحتملة)
      marketDeduct = amount;
      // نحولها لتكلفة شرائية لخصمها الفعلي من أصول المخزن وتوليد الخسارة
      const ratio = currentInventory.marketValue > 0 ? (currentInventory.purchaseValue / currentInventory.marketValue) : 0.75;
      purchaseDeduct = amount * ratio;
    }

    if (currentInventory.purchaseValue < purchaseDeduct) {
      const confirmExceed = window.confirm('تحذير: القيمة التالفة تتجاوز القيمة الإجمالية المسجلة في المخزن حالياً. هل تريد خفض المخزون المالي لدرجة الصفر؟');
      if (!confirmExceed) return;
      purchaseDeduct = currentInventory.purchaseValue;
      marketDeduct = currentInventory.marketValue;
    }

    const updatedInventory = {
      purchaseValue: Math.max(0, currentInventory.purchaseValue - purchaseDeduct),
      marketValue: Math.max(0, currentInventory.marketValue - marketDeduct)
    };

    const description = `تسجيل بضاعة تالفة وهدر: [ ${damagedReason} ] بقيمة تكلفتها الشرائية: [ ${formatCurrency(purchaseDeduct)} ]`;

    const tx = {
      id: `tx-${Date.now()}`,
      type: TransactionType.DAMAGED,
      amount: purchaseDeduct, // نسجله في قائمة الخسائر والتالف بقيمة الخسارة المادية الفعلية (التكلفة)
      description,
      timestamp: new Date().toISOString(),
      details: {
        damageType,
        calculatedCost: purchaseDeduct,
        marketValueDeducted: marketDeduct
      }
    };

    onAddTransaction(tx, updatedInventory);
    setDamagedAmount('');
    alert('تم تسجيل بضاعة تالفة وخصم تكلفتها فوراً من أصول المخزن المالي، مما يحافظ على دقة أرباحك الصافية! 📉');
  };

  // تقديم مورد جديد على عجل
  const handleQuickAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    const newSupp: Supplier = {
      id: `supp-${Date.now()}`,
      name: newSupplierName.trim(),
      phone: newSupplierPhone.trim() || 'لا يوجد هاتف',
      debt: 0,
      createdAt: new Date().toISOString()
    };

    onAddSupplier(newSupp);
    setSelectedSupplierId(newSupp.id);
    setNewSupplierName('');
    setNewSupplierPhone('');
    setShowAddSupplierModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white min-h-[calc(100vh-64px)] overflow-y-auto pb-12">
      
      {/* البطاقة الرئيسية لقيم المخزون المالي بطريقة "البينتو غريّد" */}
      <div className="p-4 grid grid-cols-2 gap-3">
        
        {/* صندوق القيمة الشرائية للمخزن - الأصول الفورية */}
        <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 shadow-sm relative overflow-hidden">
          <div className="absolute left-3 top-3 bg-slate-700/50 p-1.5 rounded-lg text-slate-400">
            <Coins className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">تكلفة الشراء (من الجملة)</p>
          <p className="text-xl font-bold font-mono text-slate-200 mt-1">{formatCurrency(appState.inventory.purchaseValue)}</p>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
            <span>تحديث آني للمشتريات</span>
          </div>
        </div>

        {/* صندوق القيمة السوقية للمخزن - قيمة ما تملكه بسعر اليوم للبيع */}
        <div className="bg-emerald-950/45 p-4 rounded-2xl border border-emerald-800/40 shadow-sm relative overflow-hidden">
          <div className="absolute left-3 top-3 bg-emerald-900/40 p-1.5 rounded-lg text-emerald-400">
            <Store className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-emerald-400/80 font-semibold mb-1 uppercase tracking-wider">قيمة البيع لليوم (السوق)</p>
          <p className="text-xl font-bold font-mono text-emerald-300 mt-1">{formatCurrency(appState.inventory.marketValue)}</p>
          <div className="flex items-center gap-0.5 mt-2 text-[10px] text-emerald-500 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>هامش ربح إجمالي: {profitPercentage.toFixed(0)}%</span>
          </div>
        </div>

        {/* مؤشر الربح الإجمالي المتوقع */}
        <div className="col-span-2 bg-gradient-to-r from-emerald-900/20 to-teal-900/10 p-3.5 rounded-2xl border border-emerald-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400">مجموع الأرباح المتوقعة إذا بعت كل البضاعة بأسعار اليوم</p>
              <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                +{formatCurrency(expectedProfit)}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* شريط تبويبات التحكم بالعمليات الطارئة للمخزن */}
      <div className="px-4 border-b border-slate-800 flex gap-2">
        <button
          onClick={() => setActiveTab('purchase')}
          className={`pb-3 pt-1 text-sm font-bold relative transition-all ${
            activeTab === 'purchase' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>تسجيل مشتريات</span>
          {activeTab === 'purchase' && (
            <motion.div layoutId="inv-active-bar" className="absolute bottom-0 right-0 left-0 h-0.5 bg-emerald-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('fluctuation')}
          className={`pb-3 pt-1 text-sm font-bold relative transition-all ${
            activeTab === 'fluctuation' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>تقلب الأسعار 🥬</span>
          {activeTab === 'fluctuation' && (
            <motion.div layoutId="inv-active-bar" className="absolute bottom-0 right-0 left-0 h-0.5 bg-emerald-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('waste')}
          className={`pb-3 pt-1 text-sm font-bold relative transition-all ${
            activeTab === 'waste' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>تسجيل التالف 🗑️</span>
          {activeTab === 'waste' && (
            <motion.div layoutId="inv-active-bar" className="absolute bottom-0 right-0 left-0 h-0.5 bg-emerald-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('manual_adjust')}
          className={`pb-3 pt-1 text-sm font-bold relative transition-all ${
            activeTab === 'manual_adjust' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>جرد افتتاحي ⚙️</span>
          {activeTab === 'manual_adjust' && (
            <motion.div layoutId="inv-active-bar" className="absolute bottom-0 right-0 left-0 h-0.5 bg-emerald-400 rounded-full" />
          )}
        </button>
      </div>

      {/* محتوى كل تبويب */}
      <div className="p-4 flex-1">
        <AnimatePresence mode="wait">
          
          {/* تبويب: شراء بضاعة جديدة */}
          {activeTab === 'purchase' && (
            <motion.form 
              key="purchase-form"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              onSubmit={handleAddPurchase} 
              className="space-y-4"
            >
              <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  <span>تعبئة المخزن المالي لبضاعة الخضار الجديدة</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">تكلفة الشراء (جملة) *</label>
                    <input
                      type="number"
                      required
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(e.target.value)}
                      placeholder="كم كلفتك البضاعة؟"
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-slate-400 block">القيمة السوقية (للبيع) *</label>
                      {parseFloat(purchaseCost) > 0 && (
                        <button
                          type="button"
                          onClick={handleAutoCalcMarketValue}
                          className="text-[10px] text-emerald-450 hover:underline font-semibold"
                        >
                          +25% مقترح الربح
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      required
                      value={projectedValue}
                      onChange={(e) => setProjectedValue(e.target.value)}
                      placeholder="كم ستجني لو بعتها؟"
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* مصدر التمويل وشراء المشتريات */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">مصدر التمويل المالي للعملية</label>
                  <select
                    value={fundingSource}
                    onChange={(e) => setFundingSource(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="cash">الخزنة النقذية (كاش بـ {formatCurrency(appState.accounts.cash)})</option>
                    <option value="bankily">حساب بنكيلي (رصيدي: {formatCurrency(appState.accounts.bankily)})</option>
                    <option value="masrify">حساب مصرفي (رصيدي: {formatCurrency(appState.accounts.masrify)})</option>
                    <option value="sadad">حساب سداد (رصيدي: {formatCurrency(appState.accounts.sadad)})</option>
                    <option value="supplier_debt">دين للمورد (شراء آجِل بالدين)</option>
                  </select>
                </div>

                {/* الحقول المحددة في حال تشغيل التمويل بالدين  */}
                {fundingSource === 'supplier_debt' && (
                  <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-amber-400 block font-bold">اختر المورد لترحيل الدين له</label>
                      <button
                        type="button"
                        onClick={() => setShowAddSupplierModal(true)}
                        className="text-[10px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-amber-400 font-bold rounded"
                      >
                        + تسجيل مورّد جديد
                      </button>
                    </div>

                    <select
                      required
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs"
                    >
                      <option value="">-- اضغط للاختيار من قائمة الموردين --</option>
                      {appState.suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (الدين السابق: {formatCurrency(s.debt)})</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 text-sm rounded-xl transition-all shadow-md active:scale-98"
                >
                  ترحيل المشتريات وتخزين البضاعة مالياً
                </button>
              </div>
            </motion.form>
          )}

          {/* تبويب: تقلب الأسعار في السوق */}
          {activeTab === 'fluctuation' && (
            <motion.div 
              key="fluctuate-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200">
                    <p className="font-bold">ما هي حاسبة تقلبات الأسعار؟</p>
                    <p className="mt-1 leading-relaxed">في أسواق الخضار، تهبط الأسعار فجأة (مثلاً وفرة في طماطم). بدلاً من إعادة جرد البضاعة قطعة قطعة، اضغط هنا لخفض "القيمة السوقية للبيع" في مخزنك بنسبة معينة لتتماشى حسابات الكاشير بدقة مع الواقع السعري للسوق.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs text-slate-400 block">اختر نسبة تخفيض أو رفع أسعار السوق:</label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handlePriceAdjustment(-15)}
                      className="p-3 bg-rose-950/40 border border-rose-900/60 hover:bg-rose-950/80 rounded-xl text-rose-350 text-xs font-bold leading-tight"
                    >
                      <p>انخفاض شديد (-15%)</p>
                      <p className="text-[10px] font-mono text-rose-400 mt-1">تصبح: {formatCurrency(appState.inventory.marketValue * 0.85)}</p>
                    </button>

                    <button
                      onClick={() => handlePriceAdjustment(-10)}
                      className="p-3 bg-red-950/30 border border-red-900/40 hover:bg-red-950/60 rounded-xl text-red-300 text-xs font-bold leading-tight"
                    >
                      <p>انخفاض عادي (-10%)</p>
                      <p className="text-[10px] font-mono text-red-400 mt-1">تصبح: {formatCurrency(appState.inventory.marketValue * 0.9)}</p>
                    </button>

                    <button
                      onClick={() => handlePriceAdjustment(-5)}
                      className="p-3 bg-slate-850 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-300 text-xs font-bold leading-tight"
                    >
                      <p>انخفاض بسيط (-5%)</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-1">تصبح: {formatCurrency(appState.inventory.marketValue * 0.95)}</p>
                    </button>

                    <button
                      onClick={() => handlePriceAdjustment(10)}
                      className="p-3 bg-emerald-950/30 border border-emerald-900/40 hover:bg-emerald-950/60 rounded-xl text-emerald-300 text-xs font-bold leading-tight"
                    >
                      <p>ارتفاع البضاعة (+10%)</p>
                      <p className="text-[10px] font-mono text-emerald-400 mt-1">تصبح: {formatCurrency(appState.inventory.marketValue * 1.1)}</p>
                    </button>
                  </div>

                  {/* Custom percentage input */}
                  <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-col gap-2">
                    <label className="text-xs text-slate-400 block">أو أدخل نسبة مخصصة يدوياً (مثال: 12 للرفع، -8 للخفض):</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        value={customFluctuation}
                        onChange={(e) => setCustomFluctuation(e.target.value)}
                        placeholder="النسبة %"
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none"
                      />
                      <button 
                        onClick={() => {
                          const val = parseFloat(customFluctuation);
                          if (!isNaN(val)) handlePriceAdjustment(val);
                          setCustomFluctuation('');
                        }}
                        className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
                      >
                        تطبيق
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          )}

          {/* تبويب: تسجيل بضاعة تالفة */}
          {activeTab === 'manual_adjust' && (
            <motion.form 
              key="manual-form"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              onSubmit={handleManualAdjust} 
              className="space-y-4"
            >
              <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  استخدم هذا القسم لتسجيل بضاعة افتتاحية عند بدء العمل على التطبيق، أو لتصحيح قيم المخزن يدوياً دون أن تؤثر العملية على أرصدة النقدية في حساباتك.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">التكلفة الشرائية الحقيقية</label>
                    <input type="number" required value={manualPurchase} onChange={(e) => setManualPurchase(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">القيمة السوقية اليوم للبيع</label>
                    <input type="number" required value={manualMarket} onChange={(e) => setManualMarket(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white" />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 font-bold text-white text-sm rounded-xl transition-all shadow-md active:scale-98">
                  ضبط وتحديث أصول المخزن
                </button>
              </div>
            </motion.form>
          )}

          {activeTab === 'waste' && (
            <motion.form 
              key="waste-form"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              onSubmit={handleAddDamage} 
              className="space-y-4"
            >
              <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="p-3 bg-rose-950/30 border border-rose-900/30 rounded-xl flex items-center justify-between text-xs text-rose-350">
                  <div className="flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" />
                    <span>تسجيل الهدر والتالف الناتج من الذبول والعطب</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">مبلغ الهدر المالي *</label>
                    <input
                      type="number"
                      required
                      value={damagedAmount}
                      onChange={(e) => setDamagedAmount(e.target.value)}
                      placeholder="تكلفة الخسارة بالعملة"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">نوع تقييم القيمة</label>
                    <select
                      value={damageType}
                      onChange={(e: any) => setDamageType(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                    >
                      <option value="purchase">تقييم بالقيمة الشرائية (التكلفة)</option>
                      <option value="market">تقييم بالقيمة السوقية (البيع)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">ملاحظة أو سبب التلف</label>
                  <input
                    type="text"
                    value={damagedReason}
                    onChange={(e) => setDamagedReason(e.target.value)}
                    placeholder="سبب تلف الخضار"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 font-bold text-white text-sm rounded-xl transition-all shadow-md active:scale-98"
                >
                  ترحيل التالف إلى خسائر وخصمه من المخزون
                </button>
              </div>
            </motion.form>
          )}

        </AnimatePresence>
      </div>

      {/* نافذة تسجيل مورد جديد مستعجل */}
      <AnimatePresence>
        {showAddSupplierModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 bg-slate-800/60 flex items-center justify-between border-b border-slate-800">
                <button type="button" onClick={() => setShowAddSupplierModal(false)} className="text-slate-400 hover:text-white">
                  <span>إلغاء</span>
                </button>
                <h4 className="font-bold text-white text-sm">تسجيل مورد للتطبيقات</h4>
                <div className="w-5"></div>
              </div>

              <form onSubmit={handleQuickAddSupplier} className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">اسم المورّد *</label>
                  <input
                    type="text"
                    required
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder="مثال: مورد الطماطم المركزي كرمسين"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-amber-500 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">رقم الهاتف للاتصال</label>
                  <input
                    type="tel"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    placeholder="مثال: 44558833"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white text-right font-mono focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm transition-all"
                >
                  حفظ المورد وإعداد الفاتورة المباشرة
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
