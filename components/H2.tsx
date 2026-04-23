import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowRight,
    Camera,
    Map,
    PlayCircle,
    Sparkles,
    Waves,
    X
} from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

import cuhkLogo from '../logos/cuhk.png';
import hkustLogo from '../logos/hkust.png';
import cityuLogo from '../logos/cityu.png';
import muLogo from '../logos/mu.png';

interface HomeProps {
    lang: Language;
    onNavigate: (tab: 'map' | 'report') => void;
}

type TeamMember = {
    name: string;
    roleEN: string;
    roleZH: string;
    bioEN: string;
    bioZH: string;
    universityEN: string;
    universityZH: string;
    uniLogo: string;
};

const VIDEO_URL = 'https://www.youtube.com/watch?v=fi2EE8bGMZI';
const VIDEO_THUMBNAIL = 'https://img.youtube.com/vi/fi2EE8bGMZI/maxresdefault.jpg';

const TEAM_MEMBERS: TeamMember[] = [
    {
        name: 'Yanni Chan',
        roleEN: 'Co-Founder',
        roleZH: '聯合創始人',
        bioEN: 'Computer Science (CUHK). Inclusive Youth Entrepreneurship Support (UNDP). Passion to make the world a better place.',
        bioZH: '計算機科學 (CUHK)。包容性青年創業支持 (UNDP)。致力讓世界變得更美好。',
        universityEN: 'The Chinese University of Hong Kong',
        universityZH: '香港中文大學',
        uniLogo: cuhkLogo
    },
    {
        name: 'David Wu',
        roleEN: 'Co-Founder',
        roleZH: '聯合創始人',
        bioEN: 'Physics + AI (HKUST). Entrepreneur with more than 10 technology project experiences.',
        bioZH: '物理 + AI (HKUST)。擁有超過 10 個科技項目經驗的創業者。',
        universityEN: 'Hong Kong University of Science and Technology',
        universityZH: '香港科技大學',
        uniLogo: hkustLogo
    },
    {
        name: 'Shalisa Ho',
        roleEN: 'Marketing & Impact',
        roleZH: '市場營銷與影響力',
        bioEN: 'Biological Sciences (CityU). Focused on marketing strategy and impact measurement.',
        bioZH: '生物科學 (CityU)。專注於市場策略與影響力評估。',
        universityEN: 'City University of Hong Kong',
        universityZH: '香港城市大學',
        uniLogo: cityuLogo
    },
    {
        name: 'Ryan Szeto',
        roleEN: 'Tech Development',
        roleZH: '技術開發',
        bioEN: 'Data Science (MU). Focused on technology development and product execution.',
        bioZH: '數據科學 (MU)。專注於技術開發與產品落地。',
        universityEN: 'Hong Kong Metropolitan University',
        universityZH: '香港都會大學',
        uniLogo: muLogo
    }
];

const BrandName = ({ compact = false }: { compact?: boolean }) => (
    <span className={`inline-flex items-baseline font-black tracking-tight ${compact ? 'gap-0' : 'gap-1'}`}>
        <span className="text-white">Eco</span>
        <span className="text-[#ffcf1f]">W</span>
        <span className="text-[#1dbb84]">ing</span>
    </span>
);

const renderWithBrand = (text: string) => {
    const parts = text.split(/(EcoWing)/g);

    return (
        <>
            {parts.map((part, index) =>
                part === 'EcoWing' ? <BrandName compact key={index} /> : <span key={index}>{part}</span>
            )}
        </>
    );
};

const Home: React.FC<HomeProps> = ({ lang, onNavigate }) => {
    const t = TRANSLATIONS[lang];
    const isEN = lang === Language.EN;
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const heroBackgroundRef = useRef<HTMLImageElement>(null);
    const heroContentRef = useRef<HTMLDivElement>(null);
    const developerSectionRef = useRef<HTMLDivElement>(null);
    const heroAccentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let frame = 0;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const updateMotion = () => {
            frame = 0;

            const y = window.scrollY;
            const heroBackgroundShift = reduceMotion ? 0 : Math.min(y * 0.1, 64);
            const heroContentShift = reduceMotion ? 0 : Math.min(y * 0.035, 24);
            const developerShift = reduceMotion ? 0 : Math.min(y * 0.018, 12);
            const accentShift = reduceMotion ? 0 : Math.min(y * 0.08, 40);

            if (heroBackgroundRef.current) {
                heroBackgroundRef.current.style.transform = `translate3d(0, ${heroBackgroundShift}px, 0) scale(1.06)`;
            }

            if (heroContentRef.current) {
                heroContentRef.current.style.transform = `translate3d(0, ${heroContentShift}px, 0)`;
                heroContentRef.current.style.opacity = '1';
            }

            if (developerSectionRef.current) {
                developerSectionRef.current.style.transform = `translate3d(0, -${developerShift}px, 0)`;
            }

            if (heroAccentRef.current) {
                heroAccentRef.current.style.transform = `translate3d(0, ${accentShift}px, 0)`;
            }
        };

        const handleScroll = () => {
            if (!frame) {
                frame = window.requestAnimationFrame(updateMotion);
            }
        };

        updateMotion();
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (frame) {
                window.cancelAnimationFrame(frame);
            }
        };
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('opacity-100', 'translate-y-0');
                        entry.target.classList.remove('opacity-0', 'translate-y-8');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
        );

        document.querySelectorAll('.reveal-on-scroll').forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, []);

    const statCards = [
        {
            value: '130K',
            label: isEN ? 'tons of coastal waste every year' : '每年 13 萬噸海岸垃圾'
        },
        {
            value: '733KM',
            label: isEN ? 'of shoreline to inspect' : '733 公里海岸線待巡查'
        },
        {
            value: '<5 min',
            label: isEN ? 'from upload to triage' : '上傳至分級少於 5 分鐘'
        }
    ];

    const solutionCards = [
        {
            icon: Camera,
            image: 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?q=80&w=1920&auto=format&fit=crop',
            iconTone: 'emerald',
            title: isEN ? 'AI Waste Detection' : 'AI 垃圾檢測',
            description: isEN
                ? 'Fast visual recognition with clear evidence.'
                : '快速辨識垃圾，並保留清晰證據。'
        },
        {
            icon: Map,
            image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1920&auto=format&fit=crop',
            iconTone: 'amber',
            title: isEN ? 'Live Coastal Mapping' : '即時海岸地圖',
            description: isEN
                ? 'A shared surface for hotspots and response.'
                : '以共享地圖快速查看熱點與回應。'
        },
        {
            icon: Waves,
            image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1920&auto=format&fit=crop',
            iconTone: 'emerald',
            title: isEN ? 'Safer Cleanup Planning' : '更安全的清理規劃',
            description: isEN
                ? 'Remote review before people enter risky terrain.'
                : '先遙距檢視，再安排人員進入高風險地帶。'
        }
    ];

    return (
        <div className="relative overflow-hidden bg-[#08111f] text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(29,187,132,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(255,207,31,0.10),_transparent_26%),linear-gradient(180deg,_rgba(8,17,31,0.7)_0%,_rgba(8,17,31,1)_72%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:52px_52px]" />

            <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-14 pt-20 sm:px-6 lg:px-8">
                <div className="absolute inset-0">
                    <img
                        ref={heroBackgroundRef}
                        src="https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=2400&q=90"
                        alt={isEN ? 'Earth from space' : '從太空俯瞰地球'}
                        className="h-full w-full object-cover opacity-26 will-change-transform"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,17,31,0.42),rgba(8,17,31,0.8)_42%,rgba(8,17,31,0.96)_72%,rgba(8,17,31,1)_100%)]" />
                    <div
                        ref={heroAccentRef}
                        className="absolute left-[8%] top-[14%] h-52 w-52 rounded-full bg-[#1dbb84]/10 blur-3xl will-change-transform"
                    />
                    <div className="absolute inset-x-0 top-[18%] h-56 bg-[radial-gradient(circle_at_center,rgba(8,17,31,0.18),rgba(8,17,31,0)_70%)]" />
                </div>

                <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col justify-center">
                    <div
                        ref={heroContentRef}
                        className="relative max-w-6xl will-change-transform reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out"
                    >
                        <div className="absolute -left-8 top-12 -z-10 h-80 w-[min(72vw,780px)] rounded-full bg-[radial-gradient(circle,rgba(8,17,31,0.58),rgba(8,17,31,0.28)_48%,rgba(8,17,31,0)_78%)] blur-2xl" />
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 backdrop-blur">
                            <Sparkles size={14} className="text-[#1dbb84]" />
                            <span>{isEN ? 'Original Team Symbol' : '團隊原始標誌'}</span>
                        </div>

                        <div className="mt-8">
                            <div className="text-7xl font-black leading-[0.85] tracking-tight text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.35)] sm:text-8xl lg:text-[10rem]">
                                <span className="text-white">Eco</span>
                                <span className="text-[#ffcf1f]">W</span>
                                <span className="text-[#1dbb84]">ing</span>
                            </div>
                            <p className="mt-8 max-w-5xl text-lg leading-9 text-slate-100 drop-shadow-[0_8px_24px_rgba(0,0,0,0.28)] sm:text-2xl">
                                {renderWithBrand(t.heroSubtitle)}
                            </p>
                        </div>



                        <div className="mt-12 grid gap-4 sm:grid-cols-3">
                            {statCards.map((item) => (
                                <div key={item.label} className="rounded-[1.5rem] border border-white/10 bg-slate-950/52 px-5 py-5 backdrop-blur-md">
                                    <div className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{item.value}</div>
                                    <div className="mt-2 text-sm leading-6 text-slate-400">{item.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                            <Waves size={14} className="text-[#ffcf1f]" />
                            <span>{isEN ? 'Scroll to reveal motion and details' : '向下滾動以看到動態變化與更多內容'}</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                <div className="mx-auto max-w-7xl reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
                    <div className="max-w-2xl">
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            {isEN ? 'Core capabilities' : '核心能力'}
                        </div>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            {isEN ? 'Innovate, monitor and map' : '創新、監測與繪製地圖'}
                        </h2>
                        <p className="mt-4 max-w-xl text-base leading-8 text-slate-400">
                            {renderWithBrand(t.homeTechDesc)}
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 lg:grid-cols-3">
                        {solutionCards.map((card, index) => {
                            const Icon = card.icon;
                            const toneClasses =
                                card.iconTone === 'amber'
                                    ? {
                                        wrapper: 'bg-[#ffcf1f]/14 border-[#ffcf1f]/30 text-[#ffcf1f]',
                                        glow: 'hover:border-[#ffcf1f]/35 hover:shadow-[0_0_60px_rgba(255,207,31,0.10)]'
                                    }
                                    : {
                                        wrapper: 'bg-[#1dbb84]/14 border-[#1dbb84]/30 text-[#1dbb84]',
                                        glow: 'hover:border-[#1dbb84]/35 hover:shadow-[0_0_60px_rgba(29,187,132,0.12)]'
                                    };

                            return (
                                <div
                                    key={card.title}
                                    className={`group relative min-h-[520px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d1728] transition-all duration-500 ease-out hover:-translate-y-1 reveal-on-scroll opacity-0 translate-y-8 ${toneClasses.glow}`}
                                    style={{ transitionDelay: `${index * 100}ms` }}
                                >
                                    <img
                                        src={card.image}
                                        alt={card.title}
                                        className="absolute inset-0 h-full w-full object-cover opacity-72 transition-transform duration-700 ease-out group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,17,31,0.12),rgba(8,17,31,0.42)_38%,rgba(8,17,31,0.88)_72%,rgba(8,17,31,0.96)_100%)]" />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(8,17,31,0.04),rgba(8,17,31,0.0)_38%,rgba(8,17,31,0.35)_100%)]" />

                                    <div className="relative flex h-full flex-col justify-end p-7">
                                        <div className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border backdrop-blur-md transition-all duration-300 group-hover:scale-105 ${toneClasses.wrapper}`}>
                                            <Icon size={24} />
                                        </div>
                                        <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{card.title}</h3>
                                        <p className="mt-4 max-w-sm text-base leading-8 text-slate-200/90">{card.description}</p>
                                        <div className="mt-6 h-px w-full bg-white/10 transition-colors duration-300 group-hover:bg-white/25" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="relative px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
                <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 sm:p-8 reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                                {isEN ? 'Featured video' : '精選影片'}
                            </div>
                            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                                {isEN ? 'Watch the EcoWing story and see the vision in action.' : '觀看 EcoWing 影片，了解願景如何落地。'}
                            </h2>
                            <p className="mt-4 text-base leading-8 text-slate-400">
                                {isEN
                                    ? 'We added a dedicated video block so readers can move from the homepage straight into your story.'
                                    : '加入獨立影片區塊，讓讀者可以直接從首頁進入你們的故事。'}
                            </p>
                        </div>
                        <a
                            href={VIDEO_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
                        >
                            <PlayCircle size={16} />
                            <span>{isEN ? 'Open YouTube Video' : '打開 YouTube 影片'}</span>
                        </a>
                    </div>

                    <a
                        href={VIDEO_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="group mt-8 block overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0a1627]"
                    >
                        <div className="relative">
                            <img
                                src={VIDEO_THUMBNAIL}
                                alt={isEN ? 'EcoWing video preview' : 'EcoWing 影片預覽'}
                                className="h-[260px] w-full object-cover opacity-75 transition-transform duration-300 group-hover:scale-[1.02] sm:h-[420px]"
                            />
                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.35),rgba(2,6,23,0.55)_40%,rgba(2,6,23,0.85)_100%)]" />

                            <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
                                <div>

                                    <h3 className="mt-5 max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-4xl">
                                        EcoWing: Towards a world-class beach at HKUST
                                    </h3>
                                </div>

                                <div className="flex flex-wrap items-end justify-between gap-4">
                                    <div className="rounded-full border border-white/12 bg-black/30 px-4 py-2 text-sm text-slate-200 backdrop-blur">
                                        {isEN ? 'Click the video block or the button above to watch.' : '點擊影片區塊或上方按鈕即可觀看。'}
                                    </div>

                                </div>
                            </div>
                        </div>
                    </a>
                </div>
            </section>

            <section className="relative px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
                <div
                    ref={developerSectionRef}
                    className="mx-auto max-w-7xl rounded-[1.75rem] border border-white/10 bg-slate-950/45 px-6 py-8 backdrop-blur sm:px-8 reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out"
                >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                                {isEN ? 'Developer backgrounds' : '開發團隊背景'}
                            </div>
                            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                                {isEN ? 'About Us' : '關於我們'}
                            </h2>
                        </div>
                        <div className="text-sm text-slate-500">
                            {isEN ? 'Developer Background' : '開發團隊背景'}
                        </div>
                    </div>

                    <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {TEAM_MEMBERS.map((member, index) => (
                            <button
                                key={member.name}
                                onClick={() => setSelectedMember(member)}
                                className="group rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#1dbb84]/30 hover:bg-white/[0.05] reveal-on-scroll opacity-0 translate-y-8"
                                style={{ transitionDelay: `${index * 90}ms` }}
                            >
                                <div className="flex h-16 items-center justify-center rounded-xl bg-white px-4 py-3">
                                    <img src={member.uniLogo} alt={member.universityEN} className="h-full w-full object-contain" />
                                </div>
                                <div className="mt-4 text-base font-semibold text-white">{member.name}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                    {isEN ? member.universityEN : member.universityZH}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="relative border-t border-white/8 px-4 py-16 sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(29,187,132,0.12),rgba(255,207,31,0.08),rgba(2,6,23,0.7))] p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
                    <div className="max-w-2xl">
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                            {isEN ? 'Ready to operate' : '準備開始'}
                        </div>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            {isEN ? 'Open the live map or submit the next verified report.' : '開啟即時地圖，或提交下一筆已驗證報告。'}
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={() => onNavigate('map')}
                            className="inline-flex items-center gap-3 rounded-full bg-yellow-500 px-6 py-3.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
                        >
                            <Map size={16} />
                            <span>{t.navMap}</span>
                        </button>
                        <button
                            onClick={() => onNavigate('report')}
                            className="inline-flex items-center gap-3 rounded-full border border-green-500/15 bg-transparent px-6 py-3.5 text-sm font-semibold text-green-500 transition-colors hover:bg-white/8"
                        >
                            <Camera size={16} />
                            <span>{t.navReport}</span>
                        </button>
                    </div>
                </div>
            </section>

            {selectedMember && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#06131f]/92 p-4 backdrop-blur-md">
                    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
                        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-5 sm:px-8">
                            <h3 className="text-2xl font-bold tracking-tight text-white">
                                <BrandName compact /> {isEN ? 'Profile' : '個人檔案'}
                            </h3>
                            <button
                                onClick={() => setSelectedMember(null)}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 sm:p-8">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                                    <div className="flex h-24 w-24 items-center justify-center rounded-[1.5rem] bg-white p-4">
                                        <img
                                            src={selectedMember.uniLogo}
                                            alt={selectedMember.universityEN}
                                            className="h-full w-full object-contain"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-3xl font-bold tracking-tight text-white">{selectedMember.name}</h4>
                                        <p className="mt-2 text-sm font-bold uppercase tracking-[0.24em] text-[#1dbb84]">
                                            {isEN ? selectedMember.roleEN : selectedMember.roleZH}
                                        </p>
                                        <p className="mt-3 text-sm leading-7 text-slate-400">
                                            {isEN ? selectedMember.universityEN : selectedMember.universityZH}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 border-t border-white/8 pt-6 text-base leading-8 text-slate-300">
                                    {isEN ? selectedMember.bioEN : selectedMember.bioZH}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
