import { lazy, Suspense, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Map as MapIcon, Upload, Menu, X, Home as HomeIcon, Mail, Lock, User, Loader2, Moon, Sun } from 'lucide-react';
import { AuthUser, GeminiAnalysisResult, Language, WasteDataPoint, Severity } from './types';
import { TRANSLATIONS } from './constants';
import Home from './components/H2';
import type { SiteDetailsData } from './components/SiteDetailsModal';
import { clearStoredAuth, deleteReport, getCurrentUser, getHistory, getStoredAuth, login, setStoredAuth, signUp } from './services/apiService';

const Dashboard = lazy(() => import('./components/Db2'));
const CoastalMap = lazy(() => import('./components/CM2'));
const ReportForm = lazy(() => import('./components/RF2'));
const SiteDetailsModal = lazy(() => import('./components/SiteDetailsModal'));

type Tab = 'home' | 'dashboard' | 'map' | 'report';
type Theme = 'dark' | 'light';
type NavItemProps = { tab: Tab; icon: LucideIcon; label: string };

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem('ecowing-theme') === 'light' ? 'light' : 'dark';
};

const LoadingPanel = () => (
  <div className="flex min-h-[600px] items-center justify-center text-emerald-700">
    <Loader2 className="animate-spin" aria-label="Loading" />
  </div>
);

const App = () => {
  const [lang, setLang] = useState<Language>(Language.EN);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const [reports, setReports] = useState<WasteDataPoint[]>([]);

  const [selectedSite, setSelectedSite] = useState<{
    isOpen: boolean;
    locationName: string;
    reports: WasteDataPoint[];
    data: SiteDetailsData | null;
  }>({
    isOpen: false,
    locationName: '',
    reports: [],
    data: null
  });

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const isLoggedIn = Boolean(authUser);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('ecowing-theme', theme);
  }, [theme]);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const history = await getHistory();
        setReports(history);
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    loadReports();
  }, []);

  useEffect(() => {
    const storedAuth = getStoredAuth();
    if (!storedAuth) return;

    setAuthUser(storedAuth.user);
    getCurrentUser()
      .then(user => {
        setAuthUser(user);
        setStoredAuth({ user, session: storedAuth.session });
      })
      .catch(() => {
        clearStoredAuth();
        setAuthUser(null);
      });
  }, []);

  const [verifyingReport, setVerifyingReport] = useState<WasteDataPoint | null>(null);
  const isHomePage = activeTab === 'home';

  const t = TRANSLATIONS[lang];

  const handleNewReport = (analysis: GeminiAnalysisResult, mediaData: { type: 'image' | 'video', url: string }, location: { lat: number, lng: number }, locationName: string, id?: string) => {
    const newReport: WasteDataPoint = {
      id: id || Date.now().toString(),
      user_id: authUser?.id || null,
      username: authUser?.username || 'Anonymous',
      lat: location.lat,
      lng: location.lng,
      type: analysis.wasteType[0] || 'Unknown',
      subType: analysis.subCategory,
      description: analysis.description,
      severity: analysis.severity as Severity,
      waste_distribution: analysis.waste_distribution,
      unique_item_count: analysis.unique_item_count,
      timestamp: new Date().toISOString(),
      verified: true,
      status: 'pending',
      locationName: locationName || (lang === Language.EN ? "User Report" : "用戶舉報"),
      mediaType: mediaData.type,
      mediaUrl: mediaData.url,
      boundingBoxes: analysis.boundingBoxes
    };

    setReports(prev => {
      if (id && prev.some(r => r.id === id)) {
        return prev.map(r => r.id === id ? newReport : r);
      }
      return [newReport, ...prev];
    });

    setVerifyingReport(null);
    alert(lang === Language.EN ? "Report Saved Permanently!" : "報告已永久保存！");
    setActiveTab('map');
  };

  const handleSiteClick = (locationName: string) => {
    const siteReports = reports.filter(r => r.locationName === locationName);

    const wasteDistribution = siteReports.reduce((acc, report) => {
      if (report.waste_distribution) {
        Object.entries(report.waste_distribution).forEach(([type, count]) => {
          acc[type] = (acc[type] || 0) + (count as number);
        });
      }
      return acc;
    }, {} as Record<string, number>);

    const totalItems = Object.values(wasteDistribution).reduce((a: number, b: number) => a + b, 0);

    const severities = siteReports.map(r => r.severity);
    const severityOrder: Record<Severity, number> = {
      [Severity.CRITICAL]: 4,
      [Severity.HIGH]: 3,
      [Severity.MEDIUM]: 2,
      [Severity.LOW]: 1
    };
    const severity = severities.reduce((a: Severity, b: Severity) =>
      severityOrder[a] > severityOrder[b] ? a : b, Severity.LOW);

    setSelectedSite({
      isOpen: true,
      locationName,
      reports: siteReports,
      data: {
        locationName,
        totalItems,
        reports: siteReports.length,
        severity,
        wasteDistribution
      }
    });
  };

  const handleVerifyReport = (report: WasteDataPoint) => {
    if (!authUser) {
      setAuthMode('login');
      setLoginError('');
      setAuthMessage(lang === Language.EN ? 'Please log in to verify or update a report.' : '請先登入以驗證或更新報告。');
      setShowLogin(true);
      return;
    }
    setVerifyingReport(report);
    setActiveTab('report');
  };

  const removeReport = async (id: string) => {
    await deleteReport(id);
    setReports(prev => prev.filter(r => r.id !== id));
    if (verifyingReport?.id === id) {
      setVerifyingReport(null);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (confirm(lang === Language.EN ? "Are you sure you want to delete this report?" : "確定要刪除此報告嗎？")) {
      try {
        await removeReport(id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        alert(lang === Language.EN ? `Could not delete this report: ${message}` : `無法刪除此報告：${message}`);
      }
    }
  };

  const handleAuthSubmit = async () => {
    setLoginError('');
    setAuthMessage('');

    if (!authEmail.trim() || !authPassword.trim()) {
      setLoginError(lang === Language.EN ? 'Email and password are required.' : '請輸入電郵和密碼。');
      return;
    }

    if (authMode === 'signup' && !authUsername.trim()) {
      setLoginError(lang === Language.EN ? 'Username is required.' : '請輸入用戶名稱。');
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const auth = await signUp(authEmail.trim(), authPassword, authUsername.trim());
        if (!auth) {
          setAuthMessage(lang === Language.EN ? 'Account created. Please check your email to confirm before logging in.' : '帳戶已建立，請先到電郵確認後再登入。');
          setAuthMode('login');
          return;
        }
        setAuthUser(auth.user);
      } else {
        const auth = await login(authEmail.trim(), authPassword);
        setAuthUser(auth.user);
      }

      setShowLogin(false);
      setLoginError('');
      setAuthMessage('');
      setAuthPassword('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : (lang === Language.EN ? 'Authentication failed.' : '登入失敗。'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuthUser(null);
    setActiveTab('home');
    alert(lang === Language.EN ? 'Logged out' : '已登出');
  };

  const NavItem = ({ tab, icon: Icon, label }: NavItemProps) => (
    <button
      onClick={() => {
        setMobileMenuOpen(false);
        if ((tab === 'dashboard' || tab === 'report') && !isLoggedIn) {
          setAuthMode('login');
          setLoginError('');
          setAuthMessage(lang === Language.EN ? 'Please log in or create an account to continue.' : '請先登入或建立帳戶再繼續。');
          setShowLogin(true);
          return;
        }
        setActiveTab(tab);
        if (tab !== 'report') setVerifyingReport(null);
      }}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === tab
        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-sm'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  const ThemeToggle = ({ compact = false }: { compact?: boolean }) => {
    const isLight = theme === 'light';
    const label = isLight
      ? (lang === Language.EN ? 'Switch to dark mode' : '切換至深色模式')
      : (lang === Language.EN ? 'Switch to light mode' : '切換至淺色模式');

    return (
      <button
        type="button"
        onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
        aria-label={label}
        title={label}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 shadow-sm transition-colors hover:border-emerald-500/40 hover:bg-slate-800 hover:text-white ${compact ? 'min-w-10 px-2.5' : 'px-3'}`}
      >
        {isLight ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
        {!compact && (
          <span className="text-xs font-semibold">
            {isLight
              ? (lang === Language.EN ? 'Dark' : '深色')
              : (lang === Language.EN ? 'Light' : '淺色')}
          </span>
        )}
      </button>
    );
  };

  const LoginModal = () => (
    <div className="modal-scrim fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        className="bg-slate-950 rounded-2xl border border-slate-700 shadow-2xl max-w-sm w-full p-6"
      >
        <h2 id="auth-dialog-title" className="text-xl font-bold text-white mb-2">
          {authMode === 'login'
            ? (lang === Language.EN ? 'Log in' : '登入')
            : (lang === Language.EN ? 'Create account' : '建立帳戶')}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {lang === Language.EN
            ? 'Use your email account to upload and manage reports.'
            : '使用電郵帳戶上傳和管理報告。'}
        </p>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-1 border border-slate-700 mb-5">
          <button
            onClick={() => {
              setAuthMode('login');
              setLoginError('');
            }}
            className={`py-2 rounded-lg text-sm font-bold transition-colors ${authMode === 'login' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            {lang === Language.EN ? 'Login' : '登入'}
          </button>
          <button
            onClick={() => {
              setAuthMode('signup');
              setLoginError('');
            }}
            className={`py-2 rounded-lg text-sm font-bold transition-colors ${authMode === 'signup' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            {lang === Language.EN ? 'Sign up' : '註冊'}
          </button>
        </div>

        <div className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {lang === Language.EN ? 'Username' : '用戶名稱'}
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-9 py-2 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              {lang === Language.EN ? 'Email' : '電郵'}
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-9 py-2 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              {lang === Language.EN ? 'Password' : '密碼'}
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAuthSubmit();
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-9 py-2 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          {authMessage && (
            <div className="text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">{authMessage}</div>
          )}

          {loginError && (
            <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">{loginError}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowLogin(false)}
              className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              {lang === Language.EN ? 'Cancel' : '取消'}
            </button>
            <button
              onClick={handleAuthSubmit}
              disabled={authLoading}
              className="flex-1 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
            >
              {authLoading && <Loader2 size={16} className="animate-spin" />}
              {authMode === 'login'
                ? (lang === Language.EN ? 'Login' : '登入')
                : (lang === Language.EN ? 'Sign up' : '註冊')}
            </button>
          </div>

        </div>
      </div>
    </div>
  );

  return (
    <div data-theme={theme} className="min-h-screen bg-[#08111f] text-slate-200 font-sans selection:bg-emerald-500/30">

      {/* Header */}
      <header className="app-header fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 shadow-[0_1px_18px_rgba(0,0,0,0.28)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center space-x-2 select-none cursor-pointer focus:outline-none"
            >
              <span className="text-2xl font-bold tracking-tight">
                <span className="text-emerald-500">Eco</span>
                <span className="text-yellow-400">W</span>
                <span className="text-emerald-500">ing</span>
              </span>
              {authUser && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  {authUser.username}
                </span>
              )}
            </button>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-2">
              <NavItem tab="home" icon={HomeIcon} label={t.navHome} />
              <NavItem tab="dashboard" icon={LayoutDashboard} label={t.navDashboard} />
              <NavItem tab="map" icon={MapIcon} label={t.navMap} />
              <NavItem tab="report" icon={Upload} label={t.navReport} />

              <div className="h-6 w-px bg-slate-800 mx-2"></div>

              {!isLoggedIn && (
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setShowLogin(true);
                  }}
                  className="text-xs font-semibold px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg hover:bg-emerald-500/20 transition-colors"
                >
                  {lang === Language.EN ? 'Login' : '登入'}
                </button>
              )}

              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="text-xs font-semibold px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  {lang === Language.EN ? 'Logout' : '登出'}
                </button>
              )}

              <button
                onClick={() => setLang(l => l === Language.EN ? Language.ZH : Language.EN)}
                className="min-h-10 text-xs font-semibold px-3 bg-slate-900 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
              >
                {lang === Language.EN ? '中文' : 'EN'}
              </button>

              <ThemeToggle />
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-1">
              <ThemeToggle compact />
              <button
                type="button"
                aria-label={mobileMenuOpen
                  ? (lang === Language.EN ? 'Close navigation menu' : '關閉導覽選單')
                  : (lang === Language.EN ? 'Open navigation menu' : '開啟導覽選單')}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="min-h-10 min-w-10 p-2 text-slate-400 hover:text-white"
              >
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div id="mobile-navigation" className="md:hidden bg-slate-950 border-b border-slate-800 px-4 pt-2 pb-4 space-y-2 shadow-lg">
            <NavItem tab="home" icon={HomeIcon} label={t.navHome} />
            <NavItem tab="dashboard" icon={LayoutDashboard} label={t.navDashboard} />
            <NavItem tab="map" icon={MapIcon} label={t.navMap} />
            <NavItem tab="report" icon={Upload} label={t.navReport} />
            {!isLoggedIn ? (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setShowLogin(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-emerald-300 hover:bg-slate-800 rounded-lg"
              >
                {lang === Language.EN ? 'Login' : '登入'}
              </button>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-300 hover:bg-slate-800 rounded-lg"
              >
                {lang === Language.EN ? 'Logout' : '登出'}
              </button>
            )}
            <button
              onClick={() => setLang(l => l === Language.EN ? Language.ZH : Language.EN)}
              className="w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg"
            >
              Switch Language: {lang === Language.EN ? '中文' : 'English'}
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={isHomePage ? 'pt-16' : 'pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto'}>

        <div className="min-h-[600px]">
          {activeTab === 'home' && <Home lang={lang} theme={theme} onNavigate={setActiveTab} />}
          <Suspense fallback={<LoadingPanel />}>
            {activeTab === 'dashboard' && <Dashboard lang={lang} reports={reports} currentUserId={authUser?.id} onDeleteReport={removeReport} />}
            {activeTab === 'map' && <CoastalMap data={reports} lang={lang} theme={theme} onVerify={handleVerifyReport} onDelete={isLoggedIn ? handleDeleteReport : undefined} onSiteClick={handleSiteClick} />}
            {activeTab === 'report' && <ReportForm lang={lang} onReportSubmit={handleNewReport} initialData={verifyingReport} />}
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 text-center text-slate-400 text-sm">
        <p>&copy; {t.footerText}</p>
      </footer>

      {showLogin && LoginModal()}

      {selectedSite.data && (
        <Suspense fallback={null}>
          <SiteDetailsModal
            isOpen={selectedSite.isOpen}
            onClose={() => setSelectedSite(prev => ({ ...prev, isOpen: false }))}
            siteData={selectedSite.data}
            reports={selectedSite.reports}
            lang={lang}
          />
        </Suspense>
      )}
    </div>
  );
};   

export default App;
