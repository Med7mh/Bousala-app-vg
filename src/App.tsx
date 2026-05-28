/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Wifi,
  WifiOff,
  User,
  DollarSign,
  CloudUpload,
  LogOut
} from 'lucide-react';
import { AppState, Customer, Supplier, Transaction } from './types';
import { DEFAULT_INITIAL_STATE, formatCurrency } from './utils';

// Firebase Integrations
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// استيراد المكونات الفرعية
import Cashier from './components/Cashier';
import Inventory from './components/Inventory';
import Contacts from './components/Contacts';
import Accounts from './components/Accounts';

const LOCAL_STORAGE_KEY = 'bousala_app_state_v2';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const initialLoadDone = useRef(false);

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

  // 1. Setup Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load data from Firebase
        await loadStateFromFirebase(currentUser.uid);
      } else {
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadStateFromFirebase = async (uid: string) => {
    try {
      setAuthLoading(true);
      const docRef = doc(db, 'bousala_states', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as any;
        // Merge with local state to ensure all fields are present
        setState(prev => ({
          ...DEFAULT_INITIAL_STATE,
          ...data,
          inventory: data.inventory || DEFAULT_INITIAL_STATE.inventory,
          accounts: data.accounts || DEFAULT_INITIAL_STATE.accounts,
          settings: data.settings || DEFAULT_INITIAL_STATE.settings,
          customers: data.customers || [],
          suppliers: data.suppliers || [],
          transactions: data.transactions || []
        }));
      } else {
        // If no remote state, sync the local state to Firebase
        await syncStateToFirebase(uid, state);
      }
    } catch (error) {
      console.error("Firebase Auth/Network error:", error);
      // Fallback is local state
    } finally {
      initialLoadDone.current = true;
      setAuthLoading(false);
    }
  };

  const syncStateToFirebase = async (uid: string, appState: AppState) => {
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'bousala_states', uid);
      const payload = {
        ...appState,
        userId: uid,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bousala_states/${uid}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const loginProvider = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      alert('فشل تسجيل الدخول. تأكد من اتصالك بالإنترنت والمحاولة مجدداً.');
    }
  };

  const logout = async () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟ البيانات ستبقى محفوظة آمنة.')) {
      await signOut(auth);
      // Reset to local initial
      setState(DEFAULT_INITIAL_STATE);
      initialLoadDone.current = false;
    }
  };

  // 2. Local & Remote Sync
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('فشل حفظ البيانات المحدثة محلياً:', e);
    }

    if (initialLoadDone.current && user) {
      const timeout = setTimeout(() => {
        syncStateToFirebase(user.uid, state);
      }, 1500); // Debounce saves to Firebase
      return () => clearTimeout(timeout);
    }
  }, [state, user]);

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
    const isConfirmed = window.confirm('تحذير صارم: هل أنت متأكد تماماً من رغبتك في مسح كافة البيانات المسجلة والديون والحسابات وإعادتها لقيم البداية الافتراضية؟ لا يمكن التراجع عن هذا سيتم استبدال النسخة الاحتياطية أيضاً.');
    if (isConfirmed) {
      setState(DEFAULT_INITIAL_STATE);
      setActiveTab('cashier');
      alert('تمت تهيئة تطبيق "بوصلة" وإعادة تشغيله بنجاح! 🧭');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Compass className="w-12 h-12 text-emerald-500 animate-spin-slow mb-4" />
        <p className="animate-pulse text-sm text-slate-400">جاري الاتصال بقاعدة البيانات...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-right font-sans p-4 relative overflow-hidden">
        {/* الديكورات الخلفية */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px]" />

        <div className="w-full max-w-sm bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 z-10 shadow-2xl relative">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-500/20 p-4 rounded-3xl text-emerald-400 border border-emerald-500/30">
              <Compass className="w-10 h-10 animate-spin-slow" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-center text-white mb-2 tracking-tight">بـوصـلـة السحابية</h2>
          <p className="text-sm text-slate-400 text-center mb-8 leading-relaxed font-light">
            قم بتسجيل الدخول للحفاظ على بيانات متجرك متزامنة بأمان في السحابة ومحمية من الضياع.
          </p>

          <button 
            onClick={loginProvider}
            className="w-full relative py-3 bg-white text-slate-950 hover:bg-slate-200 transition-all rounded-2xl font-bold flex items-center justify-center gap-3 overflow-hidden group shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            تسجيل الدخول بـ Google
          </button>
        </div>
      </div>
    );
  }

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
              <h1 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                بـوصـلـة
                {isSyncing ? (
                  <CloudUpload className="w-3 h-3 text-emerald-500 animate-pulse" />
                ) : (
                  <Wifi className="w-3 h-3 text-sky-400" />
                )}
              </h1>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-400 font-bold truncate max-w-[120px]">{user.email}</span>
              </div>
            </div>
          </div>

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
            <button
              onClick={logout}
              className="p-2 hover:bg-rose-950/20 rounded-xl text-slate-500 hover:text-rose-400 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
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
              setAppState={setState}
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory
              appState={state}
              onAddTransaction={handleAddTransaction}
              onAddSupplier={handleAddSupplier}
              setAppState={setState}
            />
          )}

          {activeTab === 'contacts' && (
            <Contacts
              appState={state}
              onAddTransaction={handleAddTransaction}
              onAddCustomer={handleAddCustomer}
              onAddSupplier={handleAddSupplier}
              setAppState={setState}
            />
          )}

          {activeTab === 'accounts' && (
            <Accounts
              appState={state}
              onAddTransaction={handleAddTransaction}
              setAppState={setState}
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
