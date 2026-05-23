/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, 
  Keyboard, 
  Store, 
  Users, 
  Wallet, 
  RotateCcw, 
  HelpCircle, 
  Info,
  X,
  WifiOff,
  User,
  DollarSign
} from 'lucide-react';
import { AppState, Customer, Supplier, Transaction } from './types';
import { DEFAULT_INITIAL_STATE, formatCurrency } from './utils';

// استيراد المكونات الفرعية
import Cashier from './components/Cashier';
import Inventory from './components/Inventory';
import Contacts from './components/Contacts';
import Accounts from './components/Accounts';

const LOCAL_STORAGE_KEY = 'bousala_app_state_v2';

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('فشل تحميل التخزين المحلي لبوصلة:', e);
    }
    return DEFAULT_INITIAL_STATE;
  });

  const [activeTab, setActiveTab] = useState<'cashier' | 'inventory' | 'contacts' | 'accounts'>('cashier');
  const [showHelperModal, setShowHelperModal] = useState<boolean>(false);

  // تحديث التخزين المحلي تلقائياً عند تغيير أي قيمة في حالة التطبيق لضمان الحفاظ على البيانات بالكامل
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('فشل حفظ البيانات المحدثة محلياً:', e);
    }
  }, [state]);

  // دالة موحدة لتسجيل أي معاملة مالية وتحديث حالتين المخزون والحسابات المتأثرة
  const handleAddTransaction = (
    tx: Transaction, 
    updatedInventory?: typeof state.inventory,
    updatedAccounts?: typeof state.accounts,
    updatedCustomers?: typeof state.customers,
    updatedSuppliers?: typeof state.suppliers
  ) => {
    setState(prev => {
      return {
        ...prev,
        transactions: [...prev.transactions, tx],
        inventory: updatedInventory || prev.inventory,
        accounts: updatedAccounts || prev.accounts,
        customers: updatedCustomers || prev.customers,
        suppliers: updatedSuppliers || prev.suppliers
      };
    });
  };

  // إضافة عميل جديد
  const handleAddCustomer = (cust: Customer) => {
    setState(prev => ({
      ...prev,
      customers: [cust, ...prev.customers]
    }));
  };

  // إضافة مورد جديد
  const handleAddSupplier = (supp: Supplier) => {
    setState(prev => ({
      ...prev,
      suppliers: [supp, ...prev.suppliers]
    }));
  };

  // إعادة المحل لوضع المصنع والمحو الكامل للبيانات (مع طلب تأكيد)
  const handleResetToDefaults = () => {
    const isConfirmed = window.confirm('تحذير صارم: هل أنت متأكد تماماً من رغبتك في مسح كافة البيانات المسجلة والديون والحسابات وإعادتها لقيم البداية الافتراضية؟ لا يمكن التراجع عن هذا.');
    if (isConfirmed) {
      setState(DEFAULT_INITIAL_STATE);
      setActiveTab('cashier');
      alert('تمت تهيئة تطبيق "بوصلة" وإعادة تشغيله بنجاح! 🧭');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center text-right font-sans antialiased selection:bg-emerald-500/30">
      
      {/* غلاف التطبيق المصمم بعناية ليناسب الأبعاد الكلاسيكية لواجهة الهواتف الذكية والأجهزة اللوحية */}
      <div className="w-full max-w-md bg-slate-900 border-x border-slate-800/80 min-h-screen flex flex-col justify-between shadow-2xl relative">
        
        {/* البار العلوي (Header) للعلامة التجارية وحالة الاتصال والخدمات السريعة */}
        <header className="bg-slate-905 px-4 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 z-40 bg-slate-900/95 backdrop-blur">
          
          <div className="flex items-center gap-2">
            {/* اللوجو الجذاب */}
            <div className="bg-emerald-500 p-1.5 rounded-xl text-slate-950 shadow-md shadow-emerald-900/10">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-wide">بـوصـلـة</h1>
              <div className="flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] text-emerald-400 font-bold">مستقل ومحلي 100%</span>
              </div>
            </div>
          </div>

          {/* أيقونات المساعدة والاشتعال */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHelperModal(true)}
              className="p-2 hover:bg-slate-850 rounded-xl text-slate-400 hover:text-white transition-colors"
              title="دليل المفاهيم (المال بدل الوزن)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              onClick={handleResetToDefaults}
              className="p-2 hover:bg-rose-950/20 rounded-xl text-slate-500 hover:text-rose-400 transition-colors"
              title="إعادة تهيئة الحسابات بالكامل"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </header>

        {/* جسم الشاشات الرئيسي (Main Body Screen Renderer) */}
        <main className="flex-1 overflow-hidden">
          {activeTab === 'cashier' && (
            <Cashier 
              appState={state}
              onAddTransaction={handleAddTransaction}
              onAddCustomer={handleAddCustomer}
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory
              appState={state}
              onAddTransaction={handleAddTransaction}
              onAddSupplier={handleAddSupplier}
            />
          )}

          {activeTab === 'contacts' && (
            <Contacts
              appState={state}
              onAddTransaction={handleAddTransaction}
              onAddCustomer={handleAddCustomer}
              onAddSupplier={handleAddSupplier}
            />
          )}

          {activeTab === 'accounts' && (
            <Accounts
              appState={state}
              onAddTransaction={handleAddTransaction}
            />
          )}
        </main>

        {/* شريط التنقل السفلي الاحترافي للهواتف الذكية (Bottom Navigation Tab Bar) */}
        <nav className="bg-slate-950 border-t border-slate-805/90 sticky bottom-0 z-40 pb-safe">
          <div className="grid grid-cols-4 h-16">
            
            {/* زر: الكاشير */}
            <button
              id="nav-btn-cashier"
              onClick={() => setActiveTab('cashier')}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                activeTab === 'cashier' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Keyboard className="w-5 h-5" />
              <span className="text-[10px] font-bold">الكاشير الذكي</span>
              {activeTab === 'cashier' && (
                <motion.div layoutId="nav-active-dot" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              )}
            </button>

            {/* زر: المخزن */}
            <button
              id="nav-btn-inventory"
              onClick={() => setActiveTab('inventory')}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                activeTab === 'inventory' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Store className="w-5 h-5" />
              <span className="text-[10px] font-bold">المخزن المالي</span>
              {activeTab === 'inventory' && (
                <motion.div layoutId="nav-active-dot" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              )}
            </button>

            {/* زر: جهات الإتصال والديون */}
            <button
              id="nav-btn-contacts"
              onClick={() => setActiveTab('contacts')}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                activeTab === 'contacts' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-bold">الديون والجهات</span>
              {activeTab === 'contacts' && (
                <motion.div layoutId="nav-active-dot" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              )}
            </button>

            {/* زر: الحسابات والملخص */}
            <button
              id="nav-btn-accounts"
              onClick={() => setActiveTab('accounts')}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                activeTab === 'accounts' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="text-[10px] font-bold">الحسابات والبنك</span>
              {activeTab === 'accounts' && (
                <motion.div layoutId="nav-active-dot" className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              )}
            </button>

          </div>
        </nav>

      </div>

      {/* مودال شرح فلسفة "بوصلة المالية" لخدمة التاجر (أيقونة المساعدة) */}
      <AnimatePresence>
        {showHelperModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden text-right text-xs"
            >
              <div className="p-4 bg-slate-800/80 flex items-center justify-between border-b border-slate-805">
                <button onClick={() => setShowHelperModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-405" />
                  <h4 className="font-bold text-white text-sm">فلسفة "بوصلة": المال بدل الوزن</h4>
                </div>
                <div className="w-5"></div>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                
                <section className="space-y-1.5">
                  <h5 className="font-bold text-emerald-400 text-xs text-emerald-350">١. لماذا المال بدلاً من الوزن؟</h5>
                  <p className="text-slate-350 leading-relaxed font-light">
                    في سوق الخضار الشعبي، الأوزان والجرامات معقدة (النعناع يذبل ويفقد الماء فتتغير الأوزان، الأسعار في الصالح تتقلب فجأة، الزبائن يزدحمون أمام المنضدة).
                    تطبيق <strong>بوصلة</strong> يحل هذا عبر جرد بضاعة المحل بقيمتها المالية الإجمالية بالأوقية (الشراء والبيع المستهدف) وتحديث الكاشير لتسجيل البيع بلمسة زر فورية بلمح البصر دون الاكتراث للوزن.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h5 className="font-bold text-emerald-400 text-xs text-emerald-350">٢. الربط التلقائي والذكي</h5>
                  <p className="text-slate-350 leading-relaxed font-light">
                    عندما تنتهي من بيع بضاعة كاش بـ <span className="font-mono text-white">100 أوقية</span>، يقوم التطبيق تلقائياً وعبر نموذج رياضي دقيق باحتساب التكلفة الشرائية المقابلة لها (مثلاً <span className="font-mono text-white">70 أوقية</span>) استناداً إلى نسب شراء المخزون، فيخصم التكلفة من أصل المخزن ويرفد الخزنة بـ <span className="font-mono text-white">100</span> ويثبّت لك <span className="font-mono text-white">30 أوقية</span> كصافي ربح فوري في نفس اللحظة!
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h5 className="font-bold text-emerald-400 text-xs text-emerald-350">٣. معالجة طوارئ السوق والتالف</h5>
                  <p className="text-slate-350 leading-relaxed font-light">
                    يحتوي التطبيق على حاسبة تقلبات لتخفيض القيمة السوقية الإجمالية للمخزن بنسب مختلفة (-10%比如) مجاراة لهبوط الأسعار بالسوق العام، وقسم مدمج قاطع لإتلاف الهدر لتخصم قيمته من الأرباح الصيفية تلقائياً حتى تكون حسابات الخزونة والربحية سليمة 100%.
                  </p>
                </section>

                <div className="pt-2">
                  <button
                    onClick={() => setShowHelperModal(false)}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-bold rounded-xl text-center transition-all"
                  >
                    مفهوم! ابدأ ترحيل الأرباح
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
