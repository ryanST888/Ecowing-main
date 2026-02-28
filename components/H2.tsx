import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { ArrowRight, X, ShieldCheck, BarChart3, Users } from 'lucide-react';

import cuhkLogo from '../logos/cuhk.png';
import hkustLogo from '../logos/hkust.png';
import cityuLogo from '../logos/cityu.png';
import muLogo from '../logos/mu.png';

interface HomeProps {
    lang: Language;
    onNavigate: (tab: 'map' | 'report') => void;
}

// Added Chinese translations for the team directly into the data object
const FULL_TEAM_LIST = [
    {
        name: "Yanni Chan",
        role: "CO-FOUNDER",
        roleZh: "聯合創始人",
        bio: "Computer Science (CUHK) Inclusive Youth Entrepreneurship Support (UNDP) Passion to Make the World a Better Place:)",
        bioZh: "計算機科學 (CUHK) 包容性青年創業支持 (UNDP) 致力於讓世界變得更美好:)",
        uniLogo: cuhkLogo
    },
    {
        name: "David Wu",
        role: "CO-FOUNDER",
        roleZh: "聯合創始人",
        bio: "Physics + AI (HKUST) Entrepreneur with 10+ tech project experiences",
        bioZh: "物理 + AI (HKUST) 擁有10多個科技項目經驗的創業者",
        uniLogo: hkustLogo
    },
    {
        name: "Shalisa Ho",
        role: "MARKETING & IMPACT",
        roleZh: "市場營銷與影響力",
        bio: "Biological Sciences (CityU) Marketing & Impact Measurement",
        bioZh: "生物科學 (CityU) 市場營銷與影響力評估",
        uniLogo: cityuLogo
    },
    {
        name: "Ryan Szeto",
        role: "TECH DEVELOPMENT",
        roleZh: "技術開發",
        bio: "Data Science (MU) Technology Development",
        bioZh: "數據科學 (MU) 技術開發",
        uniLogo: muLogo
    }
];

const STAKEHOLDERS = [
    { name: "Hilton", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Hilton_Worldwide_logo.svg/2560px-Hilton_Worldwide_logo.svg.png" },
    { name: "Coca-Cola", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Coca-Cola_logo.svg/2560px-Coca-Cola_logo.svg.png" },
    { name: "WWF", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/2/24/WWF_logo.svg/1200px-WWF_logo.svg.png" },
    { name: "Greenpeace", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Greenpeace_logo.svg/2560px-Greenpeace_logo.svg.png" },
    { name: "The Ocean Cleanup", logo: "https://upload.wikimedia.org/wikipedia/commons/4/4c/The_Ocean_Cleanup_logo.svg" },
    { name: "Sino Group", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e6/Sino_Group_logo.svg/1200px-Sino_Group_logo.svg.png" },
    { name: "Waste Management", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Waste_Management_Inc._Logo.svg/2560px-Waste_Management_Inc._Logo.svg.png" }
];

export const BrandName = () => (
    <span className="font-extrabold tracking-tight inline-flex items-baseline">
        <span className="text-white">Eco</span>
        <span className="text-yellow-400">W</span>
        <span className="text-emerald-500">ing</span>
    </span>
);

const renderWithBrand = (text: string) => {
    const parts = text.split(/(EcoWing)/g);
    return (
        <>
            {parts.map((part, index) =>
                part === 'EcoWing' ? <BrandName key={index} /> : <span key={index}>{part}</span>
            )}
        </>
    );
};

const ElegantLink = ({ label, onClick, className }: { label: string; onClick?: () => void; className?: string }) => (
    <button
        onClick={onClick}
        className={`group flex items-center gap-4 text-sm font-bold uppercase tracking-widest text-slate-300 hover:text-white transition-colors ${className}`}
    >
        <span>{label}</span>
        <div className="relative w-10 h-10 rounded-full border border-slate-600 group-hover:border-white group-hover:bg-white/10 flex items-center justify-center overflow-hidden transition-all">
            <ArrowRight size={16} className="absolute transition-all duration-300 group-hover:translate-x-10 group-hover:opacity-0" />
            <ArrowRight size={16} className="absolute -translate-x-10 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 text-emerald-400" />
        </div>
    </button>
);

const Marquee = () => {
    return (
        <div className="w-full bg-[#0f172a] border-y border-slate-800 py-16 overflow-hidden relative z-20">
            <div className="absolute top-0 left-0 bottom-0 w-32 bg-gradient-to-r from-[#0f172a] to-transparent z-10 pointer-events-none"></div>
            <div className="absolute top-0 right-0 bottom-0 w-32 bg-gradient-to-l from-[#0f172a] to-transparent z-10 pointer-events-none"></div>

            <div className="flex w-max">
                <div className="flex shrink-0 gap-12 animate-marquee items-center px-6">
                    {STAKEHOLDERS.map((stakeholder, idx) => (
                        <LogoCard key={`t1-${idx}`} stakeholder={stakeholder} />
                    ))}
                </div>
                <div className="flex shrink-0 gap-12 animate-marquee items-center px-6">
                    {STAKEHOLDERS.map((stakeholder, idx) => (
                        <LogoCard key={`t2-${idx}`} stakeholder={stakeholder} />
                    ))}
                </div>
            </div>

            <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 15s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
        </div>
    );
};

const LogoCard = ({ stakeholder }: { stakeholder: { name: string, logo: string } }) => (
    <div className="relative flex-shrink-0 w-64 h-36 bg-white rounded-xl flex items-center justify-center px-8 py-4 shadow-lg hover:scale-105 transition-transform duration-300 overflow-hidden">
        <img
            src={stakeholder.logo}
            alt={stakeholder.name}
            className="w-full h-full object-contain p-2"
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.querySelector('.fallback-text')?.classList.remove('hidden');
            }}
        />
        <div className="fallback-text hidden text-slate-900 font-black text-xl text-center uppercase tracking-tight leading-tight">
            {stakeholder.name}
        </div>
    </div>
);

const Home: React.FC<HomeProps> = ({ lang, onNavigate }) => {
    const t = TRANSLATIONS[lang];
    const [showTeamModal, setShowTeamModal] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('opacity-100', 'translate-y-0');
                    entry.target.classList.remove('opacity-0', 'translate-y-10');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.reveal-on-scroll').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-screen bg-[#0b1121] text-white font-sans selection:bg-emerald-500 selection:text-white overflow-x-hidden">

            <div className="relative h-screen flex flex-col justify-center items-center px-6 md:px-16 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop"
                        alt="Hero Background"
                        className="w-full h-full object-cover opacity-50 scale-105 animate-pulse-slow grayscale-[30%]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0b1121]/80 via-[#0b1121]/60 to-[#0b1121]/80"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1121] via-transparent to-transparent"></div>
                </div>

                <div className="relative z-10 w-full flex flex-col items-center text-center space-y-12 reveal-on-scroll opacity-0 translate-y-10 transition-all duration-1000">
                    <h1 className="text-8xl md:text-9xl lg:text-[12rem] font-black tracking-tighter leading-none flex justify-center items-baseline drop-shadow-2xl">
                        <span className="text-white">Eco</span>
                        <span className="text-yellow-400 relative top-2 md:top-4">W</span>
                        <span className="text-emerald-500">ing</span>
                    </h1>
                    <p className="text-lg md:text-2xl text-slate-300 max-w-3xl text-center leading-relaxed font-light">
                        {renderWithBrand(t.heroSubtitle)}
                    </p>
                    <div className="pt-6 flex flex-wrap justify-center gap-8">
                        <button
                            onClick={() => onNavigate('map')}
                            className="px-10 py-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] hover:-translate-y-1"
                        >
                            {t.navMap}
                        </button>
                        <ElegantLink label={t.navReport} onClick={() => onNavigate('report')} className="text-white hover:text-emerald-400" />
                    </div>
                </div>
            </div>

            <Marquee />

            <div className="py-32 px-6 md:px-16 bg-[#0b1121] relative">
                <div className="max-w-[1400px] mx-auto">
                    <div className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8 reveal-on-scroll opacity-0 translate-y-10 transition-all duration-700">
                        <div>
                            <h2 className="text-emerald-500 font-bold uppercase tracking-widest text-sm mb-4">
                                {lang === Language.EN ? 'Our Solutions' : '我們的解決方案'}
                            </h2>
                            <h3 className="text-4xl md:text-6xl font-bold leading-none tracking-tight text-white">
                                {lang === Language.EN ? (
                                    <>Innovate, monitor <br /> and map.</>
                                ) : (
                                    <>創新、監測<br />與測繪。</>
                                )}
                            </h3>
                        </div>
                        <p className="text-slate-400 max-w-md text-base leading-relaxed text-right md:text-left">
                            {t.homeTechDesc}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="group relative h-[600px] rounded-3xl overflow-hidden cursor-pointer reveal-on-scroll opacity-0 translate-y-10 transition-all duration-700 delay-100 border border-slate-800 hover:border-emerald-500/50">
                            <img src="https://images.unsplash.com/photo-1579829366248-204fe8413f31?q=80&w=1920&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="AI" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-8 w-full">
                                <div className="mb-6 w-14 h-14 bg-emerald-500/20 backdrop-blur-md rounded-2xl border border-emerald-500/30 flex items-center justify-center">
                                    <ShieldCheck className="text-emerald-400" size={28} />
                                </div>
                                <h4 className="text-3xl font-bold mb-3 text-white leading-none">
                                    {lang === Language.EN ? 'AI Detection' : 'AI 檢測'}
                                </h4>
                                <p className="text-slate-300 text-sm leading-relaxed opacity-80 transform transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                                    {lang === Language.EN ? 'Using advanced computer vision to identify plastic waste types from drone imagery.' : '使用先進的計算機視覺技術從無人機圖像中識別塑料垃圾類型。'}
                                </p>
                                <div className="mt-6 w-full h-[1px] bg-slate-700 group-hover:bg-emerald-500 transition-colors"></div>
                            </div>
                        </div>

                        <div className="group relative h-[600px] rounded-3xl overflow-hidden cursor-pointer reveal-on-scroll opacity-0 translate-y-10 transition-all duration-700 delay-200 border border-slate-800 hover:border-blue-500/50">
                            <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1920&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Data" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-8 w-full">
                                <div className="mb-6 w-14 h-14 bg-blue-500/20 backdrop-blur-md rounded-2xl border border-blue-500/30 flex items-center justify-center">
                                    <BarChart3 className="text-blue-400" size={28} />
                                </div>
                                <h4 className="text-3xl font-bold mb-3 text-white leading-none">
                                    {lang === Language.EN ? 'Precise Mapping' : '精確測繪'}
                                </h4>
                                <p className="text-slate-300 text-sm leading-relaxed opacity-80">
                                    {lang === Language.EN ? 'Real-time heatmaps and severity scoring to prioritize cleanup efforts efficiently.' : '實時熱力圖和嚴重程度評分，有效優先處理清理工作。'}
                                </p>
                                <div className="mt-6 w-full h-[1px] bg-slate-700 group-hover:bg-blue-500 transition-colors"></div>
                            </div>
                        </div>

                        <div className="group relative h-[600px] rounded-3xl overflow-hidden cursor-pointer reveal-on-scroll opacity-0 translate-y-10 transition-all duration-700 delay-300 border border-slate-800 hover:border-yellow-500/50">
                            <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1920&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Community" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-8 w-full">
                                <div className="mb-6 w-14 h-14 bg-yellow-500/20 backdrop-blur-md rounded-2xl border border-yellow-500/30 flex items-center justify-center">
                                    <Users className="text-yellow-400" size={28} />
                                </div>
                                <h4 className="text-3xl font-bold mb-3 text-white leading-none">
                                    {lang === Language.EN ? 'Community' : '社區參與'}
                                </h4>
                                <p className="text-slate-300 text-sm leading-relaxed opacity-80">
                                    {lang === Language.EN ? 'Empowering citizens to report waste locations and verify data.' : '賦權公民報告垃圾位置並驗證數據。'}
                                </p>
                                <div className="mt-6 w-full h-[1px] bg-slate-700 group-hover:bg-yellow-500 transition-colors"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="py-32 px-6 md:px-16 bg-[#0f172a] border-y border-slate-800/50">
                <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-24 items-center">
                    <div className="lg:w-1/2 reveal-on-scroll opacity-0 translate-x-[-20px] transition-all duration-700">
                        <h2 className="text-emerald-500 font-bold uppercase tracking-widest text-sm mb-6">
                            {lang === Language.EN ? 'The Challenge' : '面臨的挑戰'}
                        </h2>
                        <h3 className="text-5xl md:text-7xl font-black mb-8 leading-none tracking-tight text-white">
                            {lang === Language.EN ? (
                                <>Protecting terrains where <span className="text-slate-500">labor is risky.</span></>
                            ) : (
                                <>保護人力工作<span className="text-slate-500">風險較高</span>的地形。</>
                            )}
                        </h3>
                        <div className="text-lg text-slate-400 leading-relaxed mb-10 pl-6 border-l border-slate-700">
                            {renderWithBrand(t.homeMissionDesc)}
                        </div>
                        <ElegantLink label={lang === Language.EN ? "Meet our Team" : "認識我們的團隊"} onClick={() => setShowTeamModal(true)} className="text-slate-300 hover:text-white" />
                    </div>
                    <div className="lg:w-1/2 w-full reveal-on-scroll opacity-0 translate-x-[20px] transition-all duration-700">
                        <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-700 shadow-2xl group">
                            <iframe className="w-full h-full" src="https://www.youtube.com/embed/fi2EE8bGMZI?si=eLDWM7zcyQ_w00zM" title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                        </div>
                    </div>
                </div>
            </div>

            {showTeamModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0b1121]/90 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0f172a] border border-slate-700 w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-8 border-b border-slate-800 bg-[#0b1121]">
                            <h3 className="text-3xl font-bold text-white tracking-tight"><BrandName /> {lang === Language.EN ? 'Team' : '團隊'}</h3>
                            <button onClick={() => setShowTeamModal(false)} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-600 transition-all"><X size={24} /></button>
                        </div>

                        <div className="overflow-y-auto p-8 md:p-12 bg-[#0f172a] custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {FULL_TEAM_LIST.map((member, idx) => (
                                    <div key={idx} className="bg-[#1e293b]/50 p-8 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-2 group">
                                        <div className="flex items-center gap-5 mb-6">
                                            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center p-3 shadow-inner group-hover:scale-105 transition-all overflow-hidden">
                                                <img
                                                    src={member.uniLogo}
                                                    alt={member.name}
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        e.currentTarget.parentElement!.innerText = member.name.charAt(0);
                                                        e.currentTarget.parentElement!.className += " font-black text-slate-900 text-3xl";
                                                    }}
                                                />
                                            </div>

                                            <div>
                                                <h4 className="text-2xl font-bold text-white">{member.name}</h4>
                                                <p className="text-emerald-500 text-sm font-bold uppercase tracking-widest mt-1">
                                                    {lang === Language.EN ? member.role : member.roleZh}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-700/50 pt-4">
                                            {lang === Language.EN ? member.bio : member.bioZh}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;