import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Map as MapIcon, Upload, Menu, X, Home as HomeIcon, Mail, Lock, User, Loader2 } from 'lucide-react';
import { AuthUser, Language, WasteDataPoint, Severity } from './types';
import { TRANSLATIONS } from './constants';
//import Dashboard from './components/Dashboard';
import Dashboard from './components/Db2';
//import CoastalMap from './components/CoastalMap';
import CoastalMap from './components/CM2';

//import ReportForm from './components/ReportForm';
//Added report
import ReportForm from './components/RF2';
import SiteDetailsModal from './components/SiteDetailsModal';
//import Home from './components/Home';
import Home from './components/H2';
import { clearStoredAuth, deleteReport, getCurrentUser, getHistory, getStoredAuth, login, setStoredAuth, signUp } from './services/apiService';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(Language.EN);
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'map' | 'report'>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [reports, setReports] = useState<WasteDataPoint[]>([]);

  // ADD THIS STATE for site modal
  const [selectedSite, setSelectedSite] = useState<{
    isOpen: boolean;
    locationName: string;
    reports: WasteDataPoint[];
    data: any;
  }>({
    isOpen: false,
    locationName: '',
    reports: [],
    data: null
  });

  // [Added] Login state
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

  // Load reports from Backend on mount
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

  const handleNewReport = (analysis: any, mediaData: { type: 'image' | 'video', url: string }, location: { lat: number, lng: number }, locationName: string, id?: string) => {
    const newReport: WasteDataPoint = {
      id: id || Date.now().toString(),
      user_id: authUser?.id || null,
      username: authUser?.username || 'Anonymous',
      lat: location.lat,
      lng: location.lng,
      type: analysis.wasteType[0] || 'Unknown',
      subType: analysis.subCategory, // Capture subCategory for drill-down
      severity: analysis.severity as Severity,
      waste_distribution: analysis.waste_distribution,
      unique_item_count: analysis.unique_item_count,
      timestamp: new Date().toISOString(),
      verified: true,
      locationName: locationName || (lang === Language.EN ? "User Report" : "用戶舉報"),
      mediaType: mediaData.type,
      mediaUrl: mediaData.url,
      boundingBoxes: analysis.boundingBoxes // Save detected boxes
    };

    setReports(prev => {
      // If ID exists, replace. Else prepend.
      if (id && prev.some(r => r.id === id)) {
        return prev.map(r => r.id === id ? newReport : r);
      }
      return [newReport, ...prev];
    });

    setVerifyingReport(null); // Clear verification state after submission
    alert(lang === Language.EN ? "Report Saved Permanently!" : "報告已永久保存！");
    setActiveTab('map'); // Auto navigate to map to see result
  };

  // New Function for Site Details Modal
  const handleSiteClick = (locationName: string) => {
    const siteReports = reports.filter(r => r.locationName === locationName);

    // Calculate waste distribution
    const wasteDistribution = siteReports.reduce((acc, report) => {
      if (report.waste_distribution) {
        Object.entries(report.waste_distribution).forEach(([type, count]) => {
          acc[type] = (acc[type] || 0) + (count as number);
        });
      }
      return acc;
    }, {} as Record<string, number>);

    // Calculate total items
    const totalItems = Object.values(wasteDistribution).reduce((a: number, b: number) => a + b, 0);

    // Get highest severity
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
    setVerifyingReport(report);
    setActiveTab('report');
  };

  const removeReport = async (id: string) => {
    await deleteReport(id);
    setReports(prev => prev.filter(r => r.id !== id));
    // Also clear verify state if we deleted the one being edited
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

  // [Added] For Subscribed User Logout
  const handleLogout = () => {
    clearStoredAuth();
    setAuthUser(null);
    setActiveTab('home');
    alert(lang === Language.EN ? 'Logged out' : '已登出');
  };

  const NavItem = ({ tab, icon: Icon, label }: any) => (
    <button
      onClick={() => {
        // [Added] Login Check
        if ((tab === 'dashboard' || tab === 'report') && !isLoggedIn) {
          setAuthMode('login');
          setLoginError('');
          setAuthMessage(lang === Language.EN ? 'Please log in or create an account to continue.' : '請先登入或建立帳戶再繼續。');
          setShowLogin(true);
          return;
        }
        // Login Check End
        setActiveTab(tab);
        setMobileMenuOpen(false);
        if (tab !== 'report') setVerifyingReport(null);
      }}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === tab
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  // [Added] Login Component
  const LoginModal = () => (
    <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-sm w-full p-6">
        <h2 className="text-xl font-bold text-white mb-2">
          {authMode === 'login'
            ? (lang === Language.EN ? 'Log in' : '登入')
            : (lang === Language.EN ? 'Create account' : '建立帳戶')}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {lang === Language.EN
            ? 'Use your email account to upload and manage reports.'
            : '使用電郵帳戶上傳和管理報告。'}
        </p>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-900/60 p-1 border border-slate-700 mb-5">
          <button
            onClick={() => {
              setAuthMode('login');
              setLoginError('');
            }}
            className={`py-2 rounded-md text-sm font-bold transition-colors ${authMode === 'login' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {lang === Language.EN ? 'Login' : '登入'}
          </button>
          <button
            onClick={() => {
              setAuthMode('signup');
              setLoginError('');
            }}
            className={`py-2 rounded-md text-sm font-bold transition-colors ${authMode === 'signup' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {lang === Language.EN ? 'Sign up' : '註冊'}
          </button>
        </div>

        <div className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                {lang === Language.EN ? 'Username' : '用戶名稱'}
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-9 py-2 text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              {lang === Language.EN ? 'Email' : '電郵'}
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-9 py-2 text-white focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              {lang === Language.EN ? 'Password' : '密碼'}
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAuthSubmit();
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-9 py-2 text-white focus:border-emerald-500 outline-none"
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
              className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-white transition-colors"
            >
              {lang === Language.EN ? 'Cancel' : '取消'}
            </button>
            <button
              onClick={handleAuthSubmit}
              disabled={authLoading}
              className="flex-1 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-bold flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {authLoading && <Loader2 size={16} className="animate-spin" />}
              {authMode === 'login'
                ? (lang === Language.EN ? 'Login' : '登入')
                : (lang === Language.EN ? 'Sign up' : '註冊')}
            </button>
          </div>

          {/* <div className="text-xs text-slate-500 text-center mt-4">
            {lang === Language.EN
              ? 'Demo: username: ecowing, password: 123456'
              : '演示：用戶名：ecowing，密碼：123456'}
          </div> */}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-emerald-500/30">

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur border-b border-slate-800">
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
              {/* ADD LOGIN STATUS BADGE */}
              {/* {isLoggedIn && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  {lang === Language.EN ? 'Admin' : '管理員'}
                </span>
              )} */}
            </button>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-2">
              <NavItem tab="home" icon={HomeIcon} label={t.navHome} />
              <NavItem tab="dashboard" icon={LayoutDashboard} label={t.navDashboard} />
              <NavItem tab="map" icon={MapIcon} label={t.navMap} />
              <NavItem tab="report" icon={Upload} label={t.navReport} />

              <div className="h-6 w-px bg-slate-700 mx-2"></div>

              {!isLoggedIn && (
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setShowLogin(true);
                  }}
                  className="text-xs font-semibold px-3 py-1 bg-emerald-900/30 border border-emerald-700/50 text-emerald-300 rounded hover:bg-emerald-800/30 transition-colors"
                >
                  {lang === Language.EN ? 'Login' : '登入'}
                </button>
              )}

              {/* LOGOUT BUTTON - show when logged in */}
              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="text-xs font-semibold px-3 py-1 bg-red-900/30 border border-red-700/50 text-red-400 rounded hover:bg-red-800/30 transition-colors"
                >
                  {lang === Language.EN ? 'Logout' : '登出'}
                </button>
              )}

              <button
                onClick={() => setLang(l => l === Language.EN ? Language.ZH : Language.EN)}
                className="text-xs font-semibold px-3 py-1 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 transition-colors"
              >
                {lang === Language.EN ? '中文' : 'EN'}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-400">
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-2">
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
                className="w-full text-left px-4 py-2 text-emerald-300 hover:text-white"
              >
                {lang === Language.EN ? 'Login' : '登入'}
              </button>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-300 hover:text-white"
              >
                {lang === Language.EN ? 'Logout' : '登出'}
              </button>
            )}
            <button
              onClick={() => setLang(l => l === Language.EN ? Language.ZH : Language.EN)}
              className="w-full text-left px-4 py-2 text-slate-400 hover:text-white"
            >
              Switch Language: {lang === Language.EN ? '中文' : 'English'}
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={isHomePage ? 'pt-16' : 'pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto'}>

        {/* Dynamic Content */}
        <div className="min-h-[600px]">
          {activeTab === 'home' && <Home lang={lang} onNavigate={setActiveTab} />}
          {activeTab === 'dashboard' && <Dashboard lang={lang} currentUserId={authUser?.id} onDeleteReport={removeReport} />}
          {activeTab === 'map' && <CoastalMap data={reports} lang={lang} onVerify={handleVerifyReport} onDelete={handleDeleteReport} onSiteClick={handleSiteClick} />}
          {activeTab === 'report' && <ReportForm lang={lang} onReportSubmit={handleNewReport} initialData={verifyingReport} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-8 text-center text-slate-500 text-sm">
        <p>&copy; {t.footerText}</p>
      </footer>

      {showLogin && LoginModal()}

      {/* Site Details Modal */}
      <SiteDetailsModal
        isOpen={selectedSite.isOpen}
        onClose={() => setSelectedSite(prev => ({ ...prev, isOpen: false }))}
        siteData={selectedSite.data}
        reports={selectedSite.reports}
        lang={lang}
      />
    </div>
  );
};   

export default App;
