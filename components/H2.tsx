import React, { useEffect, useRef, useState } from 'react';
import {
    Award,
    ArrowRight,
    CalendarDays,
    Camera,
    Map,
    MapPin,
    PlayCircle,
    Sparkles,
    Trophy,
    Waves,
    X
} from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface HomeProps {
    lang: Language;
    theme: 'dark' | 'light';
    onNavigate: (tab: 'map' | 'report') => void;
}

type TeamMember = {
    name: string;
    roleEN: string;
    roleZH: string;
    studyEN: string;
    studyZH: string;
    focusEN: string;
    focusZH: string;
    bioEN: string;
    bioZH: string;
    universityEN: string;
    universityZH: string;
    avatar: string;
    avatarFit?: 'cover' | 'contain';
};

type HonorAward = {
    titleEN: string;
    titleZH: string;
    distinctionEN: string;
    distinctionZH: string;
    dateEN: string;
    dateZH: string;
    locationEN: string;
    locationZH: string;
    image: string;
    imagePosition?: string;
};

const VIDEO_URL = 'https://www.youtube.com/watch?v=fi2EE8bGMZI';
const VIDEO_THUMBNAIL = 'https://img.youtube.com/vi/fi2EE8bGMZI/maxresdefault.jpg';

const HONORS_AND_AWARDS: HonorAward[] = [
    {
        titleEN: 'Global Sustainability Challenge (Pacific Asia + Australasia Regional Final)',
        titleZH: '全球可持續發展挑戰賽（太平洋亞洲及澳大拉西亞區域決賽）',
        distinctionEN: 'First Prize',
        distinctionZH: '一等獎',
        dateEN: 'Jan 2026',
        dateZH: '2026年1月',
        locationEN: 'Hangzhou',
        locationZH: '杭州',
        image: '/achievements/award-01.jpg',
        imagePosition: 'center 58%'
    },
    {
        titleEN: 'HKSTP Future Ecopreneur Programme (Cohort 2)',
        titleZH: 'HKSTP Future Ecopreneur Programme（第二期）',
        distinctionEN: 'Member team & Social Impact Award',
        distinctionZH: '成員團隊及社會影響力獎',
        dateEN: 'Mar 2025 - Jul 2026',
        dateZH: '2025年3月至2026年7月',
        locationEN: 'Hong Kong',
        locationZH: '香港',
        image: '/achievements/award-02.jpg',
        imagePosition: 'center 38%'
    },
    {
        titleEN: 'HKSTP Ideation Programme',
        titleZH: 'HKSTP Ideation Programme',
        distinctionEN: 'Incubation team',
        distinctionZH: '培育團隊',
        dateEN: 'Jun 2025 - May 2026',
        dateZH: '2025年6月至2026年5月',
        locationEN: 'Hong Kong',
        locationZH: '香港',
        image: '/achievements/award-03.jpg',
        imagePosition: 'center 52%'
    },
    {
        titleEN: 'Hong Kong Techathon+ 10A, Sustainability & ESG Track',
        titleZH: 'Hong Kong Techathon+ 10A（可持續發展及 ESG 賽道）',
        distinctionEN: 'Finalist',
        distinctionZH: '決賽入圍者',
        dateEN: 'Jan 2026',
        dateZH: '2026年1月',
        locationEN: 'Hong Kong',
        locationZH: '香港',
        image: '/achievements/award-04.jpg',
        imagePosition: 'center 48%'
    },
    {
        titleEN: 'HKUST Sustainable Smart Campus (SSC) Living Lab Competition',
        titleZH: 'HKUST 可持續智慧校園（SSC）Living Lab 比賽',
        distinctionEN: 'Top 10',
        distinctionZH: '十強',
        dateEN: 'Jan 2026',
        dateZH: '2026年1月',
        locationEN: 'Hong Kong',
        locationZH: '香港',
        image: '/achievements/award-05.jpg',
        imagePosition: 'center 48%'
    },
    {
        titleEN: 'Hong Kong Social Enterprise Challenge (HKSEC)',
        titleZH: '香港社會企業挑戰賽（HKSEC）',
        distinctionEN: 'Semi-Finalist (Top 25)',
        distinctionZH: '準決賽入圍者（25 強）',
        dateEN: 'Feb 2026',
        dateZH: '2026年2月',
        locationEN: 'Hong Kong',
        locationZH: '香港',
        image: '/achievements/award-06.jpg',
        imagePosition: 'center 56%'
    }
];

const TEAM_MEMBERS: TeamMember[] = [
    {
        name: 'David Wu',
        roleEN: 'Co-Founder',
        roleZH: '聯合創辦人',
        studyEN: 'Physics + AI (HKUST)',
        studyZH: '物理 + 人工智能（HKUST）',
        focusEN: 'Management, business & hardware',
        focusZH: '管理、商業及硬件',
        bioEN: 'Physics + AI (HKUST). Leads management, Business Development and Hardware.',
        bioZH: '修讀物理及人工智能（HKUST），負責管理、商業發展及硬件。',
        universityEN: 'The Hong Kong University of Science and Technology',
        universityZH: '香港科技大學',
        avatar: '/team/david-wu.png'
    },
    {
        name: 'Ryan Szeto',
        roleEN: 'COO',
        roleZH: '營運總監',
        studyEN: 'Data Science (MU)',
        studyZH: '數據科學（MU）',
        focusEN: 'Platform Development & Operation',
        focusZH: '平台開發及營運',
        bioEN: 'Data Science (MU). Leads platform development and operation.',
        bioZH: '修讀數據科學（MU），負責平台開發及營運。',
        universityEN: 'Hong Kong Metropolitan University',
        universityZH: '香港都會大學',
        avatar: '/team/ryan-szeto.png'
    },
    {
        name: 'Richie Tse',
        roleEN: 'AI Engineer',
        roleZH: '人工智能工程師',
        studyEN: 'Computer Science (HKUST)',
        studyZH: '計算機科學（HKUST）',
        focusEN: 'Software & Model Training',
        focusZH: '軟件開發及模型訓練',
        bioEN: 'Computer Science (HKUST). Leads software development and model training.',
        bioZH: '修讀計算機科學（HKUST），負責軟件開發及模型訓練。',
        universityEN: 'The Hong Kong University of Science and Technology',
        universityZH: '香港科技大學',
        avatar: '/team/richie-tse.png'
    },
    {
        name: 'Havoc He',
        roleEN: 'Team Member',
        roleZH: '團隊成員',
        studyEN: 'Data Analysis + AI (HKUST)',
        studyZH: '數據分析 + 人工智能（HKUST）',
        focusEN: 'Hardware & Business',
        focusZH: '硬件及商業',
        bioEN: 'Data Analysis + AI (HKUST). Focused on hardware and business.',
        bioZH: '修讀數據分析及人工智能（HKUST），負責硬件及商業發展。',
        universityEN: 'The Hong Kong University of Science and Technology',
        universityZH: '香港科技大學',
        avatar: '/team/havoc-he.jpg'
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

const Home: React.FC<HomeProps> = ({ lang, theme, onNavigate }) => {
    const t = TRANSLATIONS[lang];
    const isEN = lang === Language.EN;
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [selectedAward, setSelectedAward] = useState<HonorAward | null>(null);
    const selectedAwardNumber = selectedAward ? HONORS_AND_AWARDS.indexOf(selectedAward) + 1 : 0;
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
        <div className={`${theme === 'light' ? 'ecowing-home-light' : ''} relative overflow-hidden bg-[#08111f] text-white`}>
            <div className="home-ambient absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(29,187,132,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(255,207,31,0.10),_transparent_26%),linear-gradient(180deg,_rgba(8,17,31,0.7)_0%,_rgba(8,17,31,1)_72%)]" />
            <div className="home-grid pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:52px_52px]" />

            <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-14 pt-20 sm:px-6 lg:px-8">
                <div className="absolute inset-0">
                    <img
                        ref={heroBackgroundRef}
                        src="https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=2400&q=90"
                        alt={isEN ? 'Earth from space' : '從太空俯瞰地球'}
                        className="home-hero-image h-full w-full object-cover opacity-26 will-change-transform"
                    />
                    <div className="home-hero-overlay absolute inset-0 bg-[linear-gradient(180deg,rgba(8,17,31,0.42),rgba(8,17,31,0.8)_42%,rgba(8,17,31,0.96)_72%,rgba(8,17,31,1)_100%)]" />
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
                        <div className="home-copy-halo absolute -left-8 top-12 -z-10 h-80 w-[min(72vw,780px)] rounded-full bg-[radial-gradient(circle,rgba(8,17,31,0.58),rgba(8,17,31,0.28)_48%,rgba(8,17,31,0)_78%)] blur-2xl" />
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
                                <div key={item.label} className="home-stat-card rounded-[1.5rem] border border-white/10 bg-slate-950/52 px-5 py-5 backdrop-blur-md">
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
                                    className={`on-photo group relative min-h-[520px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d1728] transition-all duration-500 ease-out hover:-translate-y-1 reveal-on-scroll opacity-0 translate-y-8 ${toneClasses.glow}`}
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

            <section id="honors-awards" className="relative px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
                <div className="mx-auto max-w-7xl reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
                    <div className="on-photo relative overflow-hidden rounded-[2rem] border-2 border-white/[0.08] bg-[#0a1424] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32)] sm:p-6 lg:p-7">
                        <img
                            src="/achievements/ecowing-10-page.png"
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover object-center opacity-20 saturate-50"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(5,12,24,0.97),rgba(5,13,27,0.90)_52%,rgba(4,20,27,0.93)),radial-gradient(circle_at_12%_0%,rgba(255,207,31,0.08),transparent_28%)]" />

                        <div className="relative max-w-3xl">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-[#ffcf1f]/25 bg-[#ffcf1f]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#ffcf1f]">
                                    <Award size={15} aria-hidden="true" />
                                    <span>{isEN ? 'Recognition & milestones' : '榮譽與里程碑'}</span>
                                </div>
                                <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                                    {isEN ? 'Team achievements' : '團隊成就'}
                                </h2>
                                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                                    {isEN
                                        ? 'From regional recognition to social-impact milestones — a growing record of the team’s progress.'
                                        : '從區域性肯定到社會影響力里程碑，記錄團隊不斷前進的足跡。'}
                                </p>
                            </div>
                        </div>

                        <div className="relative mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {HONORS_AND_AWARDS.map((award) => {
                                const awardNumber = HONORS_AND_AWARDS.indexOf(award) + 1;

                                return (
                                    <button
                                        key={award.titleEN}
                                        type="button"
                                        onClick={() => setSelectedAward(award)}
                                        aria-label={`${isEN ? 'View award details for' : '查看獎項詳情：'} ${isEN ? award.titleEN : award.titleZH}`}
                                        className="group relative flex min-h-[170px] flex-col overflow-hidden rounded-[1.25rem] border-2 border-white/[0.14] bg-slate-950 p-4 text-left shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-[#ffcf1f]/55 hover:shadow-[0_18px_45px_rgba(0,0,0,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcf1f]/70"
                                    >
                                        <img
                                            src={award.image}
                                            alt=""
                                            aria-hidden="true"
                                            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 saturate-75 transition-all duration-700 ease-out group-hover:scale-105 group-hover:opacity-60 group-hover:saturate-100"
                                            style={{ objectPosition: award.imagePosition }}
                                        />
                                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(2,7,18,0.97),rgba(2,8,20,0.86)_58%,rgba(2,10,18,0.93))]" />
                                        <div className="absolute inset-x-0 top-0 z-20 h-[2px] origin-left scale-x-0 bg-[linear-gradient(90deg,#ffcf1f,#1dbb84)] transition-transform duration-500 group-hover:scale-x-100" />

                                        <div className="relative z-10 flex flex-1 flex-col">
                                            <div className="flex justify-end">
                                                <span className="text-xs font-black tracking-[0.18em] text-white/30">
                                                    {String(awardNumber).padStart(2, '0')}
                                                </span>
                                            </div>
                                            <h3 className="mt-3 text-base font-bold leading-5 text-white drop-shadow-md">
                                                {isEN ? award.titleEN : award.titleZH}
                                            </h3>
                                            <div className={`mt-2 text-xs font-bold leading-5 drop-shadow-md ${awardNumber === 1 ? 'text-[#ffcf1f]' : awardNumber === 2 ? 'text-[#57ddb0]' : 'text-slate-200'}`}>
                                                {isEN ? award.distinctionEN : award.distinctionZH}
                                            </div>
                                            <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                <span>{isEN ? 'View photo & details' : '查看照片及詳情'}</span>
                                                <ArrowRight size={15} className="transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#1dbb84]" aria-hidden="true" />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

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
                        className="on-photo group mt-8 block overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0a1627]"
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

            <section id="team" className="relative px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
                <div
                    ref={developerSectionRef}
                    className="mx-auto max-w-7xl rounded-[1.75rem] border border-white/10 bg-slate-950/45 px-6 py-8 ring-1 ring-[#ffcf1f]/60 backdrop-blur sm:px-8 reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out"
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

                    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {TEAM_MEMBERS.map((member, index) => (
                            <button
                                key={member.name}
                                onClick={() => setSelectedMember(member)}
                                aria-label={`${isEN ? 'View profile for' : '查看個人資料：'} ${member.name}`}
                                className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/65 p-2 text-left shadow-[0_18px_50px_rgba(0,0,0,0.16)] ring-1 ring-[#ffcf1f]/60 transition-all duration-300 hover:-translate-y-1 hover:border-[#1dbb84]/35 hover:bg-slate-950/90 hover:ring-[#ffcf1f]/90 hover:shadow-[0_24px_70px_rgba(29,187,132,0.12)] reveal-on-scroll opacity-0 translate-y-8"
                                style={{ transitionDelay: `${index * 90}ms` }}
                            >
                                <div
                                    className={`relative aspect-[6/5] w-full overflow-hidden rounded-[1.15rem] ${
                                        member.avatarFit === 'contain' ? 'bg-white p-10' : 'bg-slate-900'
                                    }`}
                                >
                                    <img
                                        src={member.avatar}
                                        alt={`${member.name} ${member.avatarFit === 'contain' ? 'temporary avatar' : 'portrait'}`}
                                        className={`h-full w-full transition-transform duration-700 ease-out ${
                                            member.avatarFit === 'contain'
                                                ? 'object-contain group-hover:scale-105'
                                                : 'object-cover group-hover:scale-[1.04]'
                                        }`}
                                    />
                                    {member.avatarFit !== 'contain' && (
                                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/55 to-transparent" />
                                    )}
                                </div>

                                <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
                                    <div className="text-xl font-bold tracking-tight text-white">{member.name}</div>
                                    <div className="mt-1.5 text-sm font-medium text-slate-300">
                                        {isEN ? member.studyEN : member.studyZH}
                                    </div>

                                    <div className="mt-4 border-t border-white/8 pt-4">
                                        <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">
                                            {isEN ? 'Primary focus' : '主要職責'}
                                        </div>
                                        <div className="mt-2 min-h-10 text-sm font-semibold leading-5 text-slate-200">
                                            {isEN ? member.focusEN : member.focusZH}
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                                        <span className="rounded-full border border-[#ffcf1f]/20 bg-[#ffcf1f]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#ffcf1f]">
                                            {isEN ? member.roleEN : member.roleZH}
                                        </span>
                                        <ArrowRight
                                            size={16}
                                            className="text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#1dbb84]"
                                        />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="relative border-t border-white/8 px-4 py-16 sm:px-6 lg:px-8">
                <div className="home-cta mx-auto flex max-w-7xl flex-col gap-6 rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(29,187,132,0.12),rgba(255,207,31,0.08),rgba(2,6,23,0.7))] p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
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

            {selectedAward && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="award-detail-title"
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-[#06131f]/92 p-4 backdrop-blur-md"
                >
                    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-[0_30px_120px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-5 sm:px-8">
                            <div>
                                <div className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-slate-500">
                                    {isEN ? 'Recognition & milestones' : '榮譽與里程碑'}
                                </div>
                                <h3 id="award-detail-title" className="mt-1 text-2xl font-bold tracking-tight text-white">
                                    {isEN ? 'Award details' : '獎項詳情'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedAward(null)}
                                aria-label={isEN ? 'Close award details' : '關閉獎項詳情'}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-5 sm:p-8">
                            <figure className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/45">
                                <img
                                    src={selectedAward.image}
                                    alt={isEN ? `${selectedAward.titleEN} original event photo` : `${selectedAward.titleZH} 活動原圖`}
                                    className="max-h-[58vh] w-full object-contain"
                                />
                                <figcaption className="border-t border-white/10 px-5 py-3 text-xs text-slate-500">
                                    {isEN ? 'Original event photo' : '活動原圖'}
                                </figcaption>
                            </figure>

                            <div className="on-photo relative mt-4 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#07111f] p-6 sm:p-8">
                                <div
                                    aria-hidden="true"
                                    className="absolute inset-0 scale-105 bg-cover bg-center opacity-20 blur-[2px]"
                                    style={{
                                        backgroundImage: `url('${selectedAward.image}')`,
                                        backgroundPosition: selectedAward.imagePosition
                                    }}
                                />
                                <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(3,9,18,0.98)_10%,rgba(5,17,28,0.90)_58%,rgba(7,35,31,0.78)_100%)]" />

                                <div className="relative">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-300">
                                            {selectedAwardNumber === 1 ? <Trophy size={14} className="text-[#ffcf1f]" /> : <Award size={14} className="text-[#1dbb84]" />}
                                            <span>{isEN ? 'Award' : '獎項'} {String(selectedAwardNumber).padStart(2, '0')}</span>
                                        </div>
                                        <span className="text-4xl font-black tracking-[-0.06em] text-white/10">
                                            {String(selectedAwardNumber).padStart(2, '0')}
                                        </span>
                                    </div>

                                    <div className={`mt-8 text-3xl font-black leading-tight tracking-[-0.035em] sm:text-5xl ${selectedAwardNumber === 1 ? 'text-[#ffcf1f]' : selectedAwardNumber === 2 ? 'text-[#57ddb0]' : 'text-white'}`}>
                                        {isEN ? selectedAward.distinctionEN : selectedAward.distinctionZH}
                                    </div>
                                    <h4 className="mt-5 max-w-2xl text-xl font-semibold leading-8 text-slate-100 sm:text-2xl">
                                        {isEN ? selectedAward.titleEN : selectedAward.titleZH}
                                    </h4>

                                    <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">
                                                <CalendarDays size={15} className="text-[#ffcf1f]" aria-hidden="true" />
                                                <span>{isEN ? 'When' : '日期'}</span>
                                            </div>
                                            <div className="mt-3 text-base font-semibold text-white">
                                                {isEN ? selectedAward.dateEN : selectedAward.dateZH}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">
                                                <MapPin size={15} className="text-[#1dbb84]" aria-hidden="true" />
                                                <span>{isEN ? 'Where' : '地點'}</span>
                                            </div>
                                            <div className="mt-3 text-base font-semibold text-white">
                                                {isEN ? selectedAward.locationEN : selectedAward.locationZH}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedMember && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#06131f]/92 p-4 backdrop-blur-md">
                    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
                        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-5 sm:px-8">
                            <h3 className="text-2xl font-bold tracking-tight text-white">
                                <BrandName compact /> {isEN ? 'Profile' : '個人檔案'}
                            </h3>
                            <button
                                onClick={() => setSelectedMember(null)}
                                aria-label={isEN ? 'Close profile' : '關閉個人資料'}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 sm:p-8">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                                    <div
                                        className={`flex aspect-[6/5] w-full shrink-0 items-center justify-center overflow-hidden rounded-[1.5rem] sm:w-40 ${
                                            selectedMember.avatarFit === 'contain' ? 'bg-white p-7' : 'bg-slate-900'
                                        }`}
                                    >
                                        <img
                                            src={selectedMember.avatar}
                                            alt={`${selectedMember.name} ${selectedMember.avatarFit === 'contain' ? 'temporary avatar' : 'portrait'}`}
                                            className={`h-full w-full ${selectedMember.avatarFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-3xl font-bold tracking-tight text-white">{selectedMember.name}</h4>
                                        <p className="mt-2 text-sm font-bold uppercase tracking-[0.24em] text-[#1dbb84]">
                                            {isEN ? selectedMember.roleEN : selectedMember.roleZH}
                                        </p>
                                        <p className="mt-3 text-sm leading-7 text-slate-400">
                                            {isEN ? selectedMember.studyEN : selectedMember.studyZH}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 grid gap-3 border-t border-white/8 pt-6 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                        <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">
                                            {isEN ? 'Primary focus' : '主要職責'}
                                        </div>
                                        <div className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                                            {isEN ? selectedMember.focusEN : selectedMember.focusZH}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                        <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">
                                            {isEN ? 'University' : '大學'}
                                        </div>
                                        <div className="mt-2 text-sm leading-6 text-slate-300">
                                            {isEN ? selectedMember.universityEN : selectedMember.universityZH}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 text-sm leading-7 text-slate-400">
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
