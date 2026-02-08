import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { TRANSLATIONS, TEAM_MEMBERS } from '../constants';
import { ArrowRight, Users, X } from 'lucide-react';

interface HomeProps {
  lang: Language;
  onNavigate: (tab: 'map' | 'report') => void;
}

// Helper component for the branded name
export const BrandName = () => (
  <span className="font-bold tracking-tight">
    <span className="text-emerald-500">Eco</span>
    <span className="text-yellow-400">W</span>
    <span className="text-emerald-500">ing</span>
  </span>
);

// Helper to parse text and replace "EcoWing" with the branded component
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

const Home: React.FC<HomeProps> = ({ lang, onNavigate }) => {
  const t = TRANSLATIONS[lang];
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [challengeInView, setChallengeInView] = useState(false);
  const challengeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Trigger when 40% of the element is visible
        if (entry.isIntersecting) {
          setChallengeInView(true);
        }
      },
      { threshold: 0.4 }
    );

    if (challengeRef.current) {
      observer.observe(challengeRef.current);
    }

    return () => {
      if (challengeRef.current) {
        observer.unobserve(challengeRef.current);
      }
    };
  }, []);

  const Section = ({
    title,
    desc,
    bgImage,
    children,
    onClick,
    className
  }: {
    title: string;
    desc: string;
    bgImage: string;
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <div
      className={`relative min-h-[80vh] w-full flex items-center justify-center bg-fixed bg-center bg-cover border-b border-slate-900 overflow-hidden ${onClick ? 'cursor-pointer group' : ''} ${className || ''}`}
      style={{ backgroundImage: `url(${bgImage})` }}
      onClick={onClick}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-slate-950/70 transition-colors duration-500 group-hover:bg-slate-950/50"></div>

      {/* Content Card */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        {children ? children : (
          <div className="max-w-4xl mx-auto text-center bg-slate-900/40 backdrop-blur-md p-8 md:p-12 rounded-2xl border border-white/10 shadow-2xl transform transition-all duration-500 group-hover:scale-105">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tight drop-shadow-lg font-serif">
              {title}
            </h2>
            <p className="text-lg md:text-2xl text-slate-100 font-light leading-relaxed drop-shadow-md">
              {renderWithBrand(desc)}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in pb-16">

      {/* Hero Header */}
      <div className="relative min-h-[90vh] flex flex-col justify-center items-center text-center p-8 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center animate-pulse-slow"></div>

        <div className="relative z-10 max-w-5xl space-y-8">

          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none mb-4">
            <span className="text-emerald-500">Eco</span>
            <span className="text-yellow-400">W</span>
            <span className="text-emerald-500">ing</span>
          </h1>
          <p className="text-xl md:text-3xl text-slate-300 font-light max-w-3xl mx-auto leading-relaxed">
            {renderWithBrand(t.heroSubtitle)}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
            <button
              onClick={() => onNavigate('map')}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white text-lg font-bold rounded-full transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-3"
            >
              {t.navMap} <ArrowRight size={20} />
            </button>
            <button
              onClick={() => onNavigate('report')}
              className="px-8 py-4 bg-transparent border-2 border-slate-500 hover:border-white text-slate-300 hover:text-white text-lg font-bold rounded-full transition-all flex items-center justify-center"
            >
              {t.navReport}
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: The Challenge (Interactive) */}
      <div
        ref={challengeRef}
        className="relative min-h-[90vh] w-full flex items-center bg-fixed bg-center bg-cover border-b border-slate-900 overflow-hidden"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1618477461853-5f8dd68aa395?q=80&w=1920&auto=format&fit=crop')` }}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-slate-950/80"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full h-full flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-12">

          {/* Text Content - Slides Left */}
          <div className={`
            transition-all duration-1000 ease-in-out
            ${challengeInView ? 'lg:w-1/2 lg:translate-x-0' : 'lg:w-full lg:translate-x-[25%] lg:text-center'}
            w-full
          `}>
            <div className="bg-slate-900/60 backdrop-blur-md p-8 md:p-12 rounded-2xl border border-white/10 shadow-2xl">
              <p className="text-lg md:text-2xl text-slate-100 font-light leading-relaxed drop-shadow-md">
                {renderWithBrand(t.homeMissionDesc)}
              </p>
            </div>
          </div>

          {/* Video Content - Updated Iframe */}
          <div className={`
            lg:w-1/2 w-full flex justify-center items-center
            transition-all duration-1000 delay-300 ease-in-out
            ${challengeInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20 pointer-events-none absolute right-0'}
          `}>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-700 bg-black">
              {challengeInView && (
                <iframe
                  width="560"
                  height="315"
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/fi2EE8bGMZI?si=eLDWM7zcyQ_w00zM"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                ></iframe>
              )}
            </div>
          </div>

        </div>
      </div>


      {/* Section 2: Our Solution */}
      <Section
        title={t.homeTechTitle}
        desc={t.homeTechDesc}
        bgImage="https://images.unsplash.com/photo-1579829366248-204fe8413f31?q=80&w=1920&auto=format&fit=crop"
      />

      {/* Section 3: About Us */}
      <Section
        title={t.homeAboutTitle}
        desc={t.homeAboutDesc}
        bgImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1920&auto=format&fit=crop"
        onClick={() => setShowTeamModal(true)}
      >
        <div className="bg-slate-900/40 backdrop-blur-md p-8 md:p-12 rounded-2xl border border-white/10 shadow-2xl transform transition-all duration-500 group-hover:scale-105 text-center max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tight drop-shadow-lg font-serif">
            {t.homeAboutTitle}
          </h2>
          <p className="text-lg md:text-2xl text-slate-100 font-light leading-relaxed drop-shadow-md">
            {renderWithBrand(t.homeAboutDesc)}
          </p>
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold uppercase tracking-widest text-sm animate-bounce mt-8">
            <Users size={20} />
            {lang === Language.EN ? "Click to View Team" : "點擊查看團隊"}
          </div>
        </div>
      </Section>

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <BrandName /> Team
              </h3>
              <button
                onClick={(e) => { e.stopPropagation(); setShowTeamModal(false); }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 md:p-10 space-y-8 bg-gradient-to-b from-slate-900 to-slate-950">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                {TEAM_MEMBERS.map((member, idx) => (
                  <div key={idx} className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-colors group">
                    <div className="w-20 h-20 bg-slate-700 rounded-full mb-4 mx-auto overflow-hidden flex items-center justify-center border-2 border-emerald-500/30 group-hover:border-emerald-500 transition-colors">
                      <span className="text-2xl font-bold text-slate-400 group-hover:text-emerald-400">{member.name.charAt(0)}</span>
                    </div>
                    <h4 className="text-xl font-bold text-white text-center mb-1">{member.name}</h4>
                    <p className="text-emerald-400 text-sm font-medium text-center uppercase tracking-wider mb-4">
                      {t[member.roleKey as keyof typeof t]}
                    </p>
                    <p className="text-slate-400 text-sm text-center leading-relaxed whitespace-pre-line">
                      {lang === Language.EN ? member.bioEN : member.bioZH}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-slate-800 text-center">
                <p className="text-slate-500 text-sm italic">
                  {t.teamModalFooter}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;