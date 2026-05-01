import { useEffect, useState, useRef, type SVGProps } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import logoLight from './assets/logo_light.svg';
import logoDark from './assets/logo_dark.svg';

type IconProps = SVGProps<SVGSVGElement>;

function useInView(options = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.1, ...options });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

const Icons = {
  music: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  heart: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  spark: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3v18M5.5 9.5l13 5M5.5 14.5l13-5" />
    </svg>
  ),
  check: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  quote: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  ),
  moon: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  sun: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  menu: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  x: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  arrow: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  spotify: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  ),
  wifi: (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" />
    </svg>
  ),
};

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] ${className}`}>
      {children}
    </p>
  );
}

const WAITLIST_STORAGE_KEY = 'bwend_waitlist_email';

export type WaitlistSignup = {
  email: string;
  setEmail: (v: string) => void;
  submitted: boolean;
  loading: boolean;
  error: string | null;
  submit: (e?: React.FormEvent) => Promise<void>;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function useWaitlistSignup(): WaitlistSignup {
  const joinWaitlist = useMutation(api.waitlist.join);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WAITLIST_STORAGE_KEY);
      if (saved) {
        setSubmitted(true);
        setEmail(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Please enter your email.');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await joinWaitlist({ email: trimmed });
      localStorage.setItem(WAITLIST_STORAGE_KEY, trimmed);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return { email, setEmail, submitted, loading, error, submit };
}

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [lightOnHero, setLightOnHero] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      setScrolled(isScrolled);
      setLightOnHero(window.scrollY < window.innerHeight * 0.8);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', darkMode ? '#121118' : '#fdfbf7');
    }
  }, [darkMode]);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-transparent transition-all duration-700 ${
      scrolled ? 'py-4' : 'py-8'
    }`}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
        <div className="flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 group">
            <img
              src={darkMode || (lightOnHero && !scrolled) ? logoLight : logoDark}
              alt="Bwend"
              className="h-6 md:h-7 transition-all duration-500"
            />
          </a>

          <div className={`hidden md:flex items-center gap-12 text-[0.6875rem] font-bold uppercase tracking-[0.25em] ${
            lightOnHero && !scrolled ? 'text-white' : 'text-[var(--color-text-primary)]'
          }`}>
            <a href="#how" className="hover:opacity-50 transition-opacity">How it works</a>
            <a href="#philosophy" className="hover:opacity-50 transition-opacity">Philosophy</a>
            <a href="#stories" className="hover:opacity-50 transition-opacity">Stories</a>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 -mr-2 hover:opacity-50 transition-opacity"
            >
              {darkMode ? <Icons.sun className="w-4 h-4" /> : <Icons.moon className="w-4 h-4" />}
            </button>
            <a 
              href="#waitlist" 
              className={`px-6 py-3 rounded-full transition-all duration-500 ${
                lightOnHero && !scrolled 
                  ? 'bg-white text-black hover:bg-white/90' 
                  : 'bg-[var(--color-ink)] text-[var(--color-bg-primary)] hover:opacity-90'
              }`}
            >
              Join the list
            </a>
          </div>

          <button className={`md:hidden p-2 ${lightOnHero && !scrolled ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>
            <Icons.menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ waitlist }: { waitlist: WaitlistSignup }) {
  const heroErrorId = 'hero-waitlist-error';

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-black pt-24 pb-16 md:pb-24">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=2400&q=100"
          alt="Concert vibe"
          className="w-full h-full object-cover opacity-60 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-24 w-full">
        <div className="translate-y-4 animate-fade-in">
          <SectionLabel className="text-white/60 mb-8">Pre-launch. Gathering interest.</SectionLabel>
          <h1 className="font-display text-[clamp(3.5rem,10vw,8rem)] text-white font-semibold leading-[0.85] tracking-[-0.06em]">
            The dating app <br />
            <span className="italic font-serif">designed</span> to <br />
            be heard.
          </h1>
          <p className="mt-12 text-white/70 text-lg md:text-xl lg:text-2xl max-w-xl font-normal leading-relaxed tracking-normal">
            We&apos;re building a way to connect through the music you actually love, <br className="hidden md:block" />
            before you ever match on looks. Join the list to get early access.
          </p>

          <div className="mt-10 max-w-xl">
            {waitlist.submitted ? (
              <div className="inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/10 px-6 py-3.5 text-white backdrop-blur-md">
                <Icons.check className="h-5 w-5 shrink-0 text-emerald-400" />
                <span className="text-sm font-medium tracking-wide">You&apos;re on the list. We&apos;ll be in touch.</span>
              </div>
            ) : (
              <form
                onSubmit={waitlist.submit}
                className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
                aria-label="Join the waitlist"
              >
                <input
                  type="email"
                  name="email"
                  placeholder="Email for early access"
                  value={waitlist.email}
                  onChange={(e) => waitlist.setEmail(e.target.value)}
                  required
                  disabled={waitlist.loading}
                  autoComplete="email"
                  aria-invalid={waitlist.error ? true : undefined}
                  aria-describedby={waitlist.error ? heroErrorId : undefined}
                  className={`min-w-0 flex-1 rounded-full border bg-white/10 px-5 py-3.5 text-sm text-white placeholder:text-white/45 backdrop-blur-md transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60 ${
                    waitlist.error ? 'border-red-400/80' : 'border-white/25 focus:border-white/45'
                  }`}
                />
                <button
                  type="submit"
                  disabled={waitlist.loading}
                  className="shrink-0 rounded-full border-0 bg-[var(--color-accent-cta)] px-8 py-3.5 text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[#14120f] shadow-xl transition-all hover:brightness-105 disabled:opacity-60"
                >
                  {waitlist.loading ? 'Joining…' : 'Sign up'}
                </button>
              </form>
            )}
            {waitlist.error && !waitlist.submitted ? (
              <p id={heroErrorId} className="mt-3 text-sm text-red-300" role="alert">
                {waitlist.error}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-white/45">No spam. One line to get on the list.</p>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <a
              href="#waitlist"
              className="inline-flex w-fit items-center justify-center rounded-full border border-white/25 bg-white/10 px-8 py-3.5 text-[0.75rem] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all hover:bg-white/15"
            >
              More about the waitlist
            </a>
            <a
              href="#how"
              className="inline-flex w-fit items-center justify-center text-[0.75rem] font-bold uppercase tracking-[0.2em] text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              See how it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function AppShowcaseSection() {
  const ref = useInView();
  return (
    <section
      ref={ref.ref}
      className={`py-32 md:py-48 px-6 border-b border-[var(--color-border)] transition-all duration-1000 ${
        ref.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-10 grid lg:grid-cols-2 gap-20 items-center">
        <div>
          <SectionLabel className="mb-6">The Experience</SectionLabel>
          <h2 className="font-display text-4xl md:text-5xl lg:text-[4.5rem] font-semibold text-[var(--color-text-primary)] leading-[0.95] tracking-tight">
            Hear the vibe. <br />
            Before you see the face.
          </h2>
          <p className="mt-10 text-[var(--color-text-secondary)] text-xl leading-relaxed max-w-md font-normal">
            Your top tracks, moods, and late-night repeats become the conversation. It feels closer to meeting through friends, with better playlists.
          </p>
          <div className="mt-12 flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center shrink-0">
                <Icons.music className="w-5 h-5 text-[var(--color-accent-coral)]" />
              </div>
              <div>
                <h4 className="font-bold text-sm uppercase tracking-widest text-[var(--color-text-primary)]">Ritual-based matching</h4>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">No endless catalog. The idea: one intentional blend at a time, not another night of swiping.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center shrink-0">
                <Icons.spark className="w-5 h-5 text-[var(--color-accent-coral)]" />
              </div>
              <div>
                <h4 className="font-bold text-sm uppercase tracking-widest text-[var(--color-text-primary)]">Spotify Native</h4>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Your real listening habits, not a curated list of "cool" bands.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative">
          <div className="relative z-10 w-full max-w-[400px] mx-auto aspect-[9/19] rounded-[3rem] border-[12px] border-[var(--color-ink)] bg-[var(--color-bg-card)] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] p-6 flex flex-col">
                <div className="mt-12 h-40 rounded-2xl bg-gradient-to-br from-[var(--color-accent-peach)] to-[var(--color-accent-lavender)] flex items-center justify-center">
                  <Icons.music className="w-16 h-16 text-white/50" />
                </div>
                <div className="mt-8 space-y-4">
                  <div className="h-6 w-3/4 bg-[var(--color-border)] rounded-full animate-pulse" />
                  <div className="h-4 w-1/2 bg-[var(--color-border)] opacity-60 rounded-full" />
                  <div className="pt-8 h-40 rounded-2xl border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center gap-2">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Your Blend is ready</span>
                     <div className="flex -space-x-4">
                        <div className="w-12 h-12 rounded-full bg-[var(--color-accent-coral)] border-4 border-[var(--color-bg-secondary)]" />
                        <div className="w-12 h-12 rounded-full bg-[var(--color-accent-lavender)] border-4 border-[var(--color-bg-secondary)]" />
                     </div>
                  </div>
                </div>
             </div>
          </div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-[var(--color-accent-warm-yellow)]/20 blur-3xl rounded-full" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[var(--color-accent-lavender)]/20 blur-3xl rounded-full" />
        </div>
      </div>
    </section>
  );
}

function LogoBar() {
  const pillars = ['Music-first matching', 'One blend at a time', 'Spotify-connected'];
  return (
    <section className="py-12 md:py-14 px-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
      <p className="text-center text-xs uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-8">
        What we&apos;re building
      </p>
      <div className="max-w-5xl mx-auto flex flex-wrap justify-center items-center gap-x-10 gap-y-4">
        {pillars.map((name) => (
          <span key={name} className="font-display text-base md:text-lg font-semibold text-[var(--color-text-primary)] opacity-80">
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

function PhilosophySection() {
  const ref = useInView();

  return (
    <section id="philosophy" ref={ref.ref} className="section-spread bg-[var(--color-bg-primary)] overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <div className={`transition-all duration-1000 ${ref.inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
            <SectionLabel className="mb-8">Our Ethos</SectionLabel>
            <h2 className="font-display text-5xl md:text-7xl lg:text-[5rem] font-semibold text-[var(--color-text-primary)] leading-[0.9] tracking-tighter">
              Go on your <br />
              <span className="hand-drawn-circle italic font-serif">last</span> <br />
              first date.
            </h2>
            <div className="mt-14 space-y-8 text-[var(--color-text-secondary)] text-xl leading-relaxed font-normal max-w-md">
              <p>
                People spend hours curating the perfect "face," but 30 seconds of their most-played track says more than a bio ever could.
              </p>
              <p>
                Bwend is for the people who let the music speak first. No more checkbox overlap. Just shared energy, track by track.
              </p>
            </div>
            <div className="mt-12">
              <a href="#waitlist" className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] group">
                Join the ritual
                <Icons.arrow className="w-4 h-4 transition-transform group-hover:translate-x-2" />
              </a>
            </div>
          </div>
          <div className={`relative transition-all duration-1000 delay-300 ${ref.inView ? 'opacity-100' : 'opacity-0 scale-95'}`}>
            <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=100" 
                alt="People connecting" 
                className="absolute inset-0 w-full h-full object-cover grayscale-[30%] hover:grayscale-0 transition-all duration-700" 
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LabsSection() {
  const ref = useInView();

  return (
    <section id="labs" ref={ref.ref} className="section-spread bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <div className={`order-2 lg:order-1 relative transition-all duration-1000 ${ref.inView ? 'opacity-100' : 'opacity-0 scale-95'}`}>
            <div className="relative aspect-[16/10] lg:aspect-[16/11] rounded-[2.5rem] overflow-hidden shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1600&q=100" 
                alt="Music production" 
                className="absolute inset-0 w-full h-full object-cover" 
              />
            </div>
          </div>
          <div className={`order-1 lg:order-2 transition-all duration-1000 delay-300 ${ref.inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
            <SectionLabel className="mb-8">Bwend Labs</SectionLabel>
            <h2 className="font-display text-5xl md:text-6xl font-semibold text-[var(--color-text-primary)] leading-[0.9] tracking-tighter">
              We're vibe <br />
              <span className="italic font-serif">scientists.</span>
            </h2>
            <p className="mt-12 text-[var(--color-text-secondary)] text-xl leading-relaxed font-normal max-w-md">
              The matching layer we&apos;re building won&apos;t start from who you say you are. It starts from what you actually listen to.
            </p>
            <p className="mt-8 text-[var(--color-text-muted)] text-base leading-relaxed max-w-md">
              Decibels, BPM, acoustic range: signals that point to someone on your wavelength, whether that&apos;s lo-fi mornings or techno nights.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const ref = useInView();
  const steps = [
    {
      id: '01',
      title: 'Sync your taste',
      body: 'Connect your Spotify. We analyze your library to find the patterns in your replay history.',
      color: 'var(--color-accent-peach)',
    },
    {
      id: '02',
      title: 'Join a Ritual',
      body: 'Designed so each day you get one "Blend": a person whose playlist mirrors your taste.',
      color: 'var(--color-accent-lavender)',
    },
    {
      id: '03',
      title: 'Match & Melt',
      body: 'Skip the "Hello" and start by reacting to their tracks. The conversation starts where the music ends.',
      color: 'var(--color-accent-coral)',
    },
  ];

  return (
    <section id="how" ref={ref.ref} className="section-spread bg-[var(--color-bg-primary)]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <SectionLabel className="mb-6">The Ritual</SectionLabel>
          <h2 className="font-display text-5xl md:text-7xl font-semibold text-[var(--color-text-primary)] tracking-tight">
            Three steps. <br />One shared wavelength.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {steps.map((step, i) => (
            <div 
              key={step.id} 
              className={`p-12 rounded-[2.5rem] bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:shadow-xl transition-all duration-700 ${
                ref.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: `${i * 200}ms` }}
            >
              <span className="text-[0.75rem] font-bold uppercase tracking-[0.3em] opacity-40 mb-10 block">{step.id}</span>
              <h3 className="font-display text-3xl font-semibold text-[var(--color-text-primary)] mb-6 whitespace-pre-line tracking-tight">{step.title}</h3>
              <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed font-normal">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-24 text-center">
            <div className={`inline-flex items-center gap-1.5 p-1 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] transition-all duration-1000 ${ref.inView ? 'opacity-100' : 'opacity-0'}`}>
                <span className="px-6 py-2.5 text-[0.625rem] font-bold uppercase tracking-[0.2em] text-[var(--color-text-primary)]">Want early access?</span>
                <a href="#waitlist" className="px-6 py-2.5 rounded-full bg-[var(--color-ink)] text-white text-[0.625rem] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-opacity">
                    Join the waitlist
                </a>
            </div>
        </div>
      </div>
    </section>
  );
}

function MidCTASection() {
  return (
    <section className="py-16 md:py-20 px-6">
      <div className="mid-cta-surface max-w-4xl mx-auto rounded-[999px] px-8 py-12 md:py-16 text-center border border-[var(--color-border)] shadow-sm">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)]">
          Be first when we open the list for real matches.
        </h2>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="#waitlist" className="w-full sm:w-auto inline-flex justify-center px-8 py-3.5 rounded-full bg-[var(--color-accent-cta)] text-[#14120f] font-semibold text-sm hover:brightness-105 transition-all">
            Join waitlist
          </a>
          <a
            href="#philosophy"
            className="w-full sm:w-auto inline-flex justify-center px-8 py-3.5 rounded-full bg-[var(--color-bg-card)]/85 border border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-sm hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            Our philosophy
          </a>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const ref = useInView();
  const rows = [
    {
      title: 'Your Blend',
      body: 'A playlist that belongs to both of you, not a list of mutual likes, but a living mix that grows with your relationship.',
      img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
      align: 'left' as const,
    },
    {
      title: 'Vibe Score',
      body: 'Compatibility based on how you listen: energy, era, and emotional range. We find the person who hears what you hear.',
      img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
      align: 'right' as const,
    },
    {
      title: 'Music-first chat',
      body: 'React to tracks, swap songs, and skip the hollow opener. The conversation starts with something you both actually care about.',
      img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
      align: 'left' as const,
    },
  ];

  return (
    <section
      id="features"
      ref={ref.ref}
      className={`py-32 md:py-48 px-6 transition-all duration-1000 ${
        ref.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-10">
        <div className="mb-24">
          <SectionLabel className="mb-6">The Rituals</SectionLabel>
          <h2 className="font-display text-4xl md:text-5xl lg:text-[4rem] font-semibold text-[var(--color-text-primary)] leading-[1.0] tracking-tight max-w-2xl">
            Built for connection. <br />Not just for swiping.
          </h2>
        </div>

        <div className="space-y-32 md:space-y-48">
          {rows.map((row) => (
            <div
              key={row.title}
              className={`grid md:grid-cols-2 gap-16 md:gap-24 items-center ${
                row.align === 'right' ? 'md:[&>div:first-child]:order-2' : ''
              }`}
            >
              <div className={`${row.align === 'right' ? 'md:order-2' : ''}`}>
                <div className="relative aspect-[4/3] rounded-[2.5rem] overflow-hidden shadow-2xl">
                   <img 
                      src={row.img} 
                      alt={row.title} 
                      className="absolute inset-0 w-full h-full object-cover grayscale-[30%] hover:grayscale-0 transition-all duration-700" 
                   />
                </div>
              </div>
              <div>
                <h3 className="font-display text-3xl md:text-4xl font-semibold text-[var(--color-text-primary)] tracking-tight">{row.title}</h3>
                <p className="mt-8 text-[var(--color-text-secondary)] text-xl leading-relaxed font-normal">{row.body}</p>
                <div className="mt-10 h-px w-20 bg-[var(--color-border)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const ref = useInView();
  const stats = [
    { value: 'Soon', label: 'First cities TBA', icon: Icons.spark },
    { value: 'Open', label: 'Waitlist', icon: Icons.wifi },
    { value: 'You', label: 'Help shape the launch', icon: Icons.heart },
  ];

  return (
    <section
      ref={ref.ref}
      className={`py-32 md:py-48 px-6 bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)] transition-all duration-1000 ${
        ref.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-10 grid grid-cols-1 sm:grid-cols-3 gap-20 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="font-display text-6xl md:text-7xl lg:text-8xl font-semibold text-[var(--color-text-primary)] tracking-tighter opacity-80">{s.value}</p>
            <p className="mt-4 text-[0.75rem] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MoodsSection() {
  const ref = useInView();
  const moods = [
    { label: 'Late-night drives', variant: 'peach' },
    { label: 'Sunday reset', variant: 'lavender' },
    { label: 'Gym energy', variant: 'coral' },
    { label: 'Wine and slow songs', variant: 'warm-yellow' },
    { label: 'Festival people', variant: 'blush' },
    { label: 'Soft life playlists', variant: 'peach' },
    { label: 'Whatever shuffle brings', variant: 'lavender' },
    { label: 'Sad songs, honest talks', variant: 'coral' },
  ];

  return (
    <section
      ref={ref.ref}
      className={`py-32 md:py-48 px-6 transition-all duration-1000 ${
        ref.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-10">
        <div className="text-center mb-24">
          <SectionLabel className="mb-6">The Prompts</SectionLabel>
          <h2 className="font-display text-4xl md:text-5xl lg:text-[4rem] font-semibold text-[var(--color-text-primary)] tracking-tight">
            What moves you?
          </h2>
          <p className="mt-8 text-[var(--color-text-secondary)] text-xl max-w-xl mx-auto">
            These are the moods we&apos;re tuning for. Tell us what matters on the waitlist.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
          {moods.map((mood) => (
            <button
              key={mood.label}
              type="button"
              className="group relative px-8 py-4 rounded-full border border-[var(--color-border)] overflow-hidden transition-all duration-500 hover:border-transparent"
            >
              <span className="relative z-10 text-xs font-bold uppercase tracking-widest text-[var(--color-text-primary)] transition-colors group-hover:text-white">
                {mood.label}
              </span>
              <div className="absolute inset-0 bg-[var(--color-ink)] translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  const ref = useInView();
  
  return (
    <section className="section-spread bg-[var(--color-bg-primary)]">
      <div className="max-w-7xl mx-auto" ref={ref.ref}>
        <div className="text-center mb-24">
          <SectionLabel className="mb-6">The Difference</SectionLabel>
          <h2 className="font-display text-5xl md:text-7xl font-semibold text-[var(--color-text-primary)] tracking-tight">
            A better way to start.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
          <div className={`p-12 md:p-16 rounded-[3rem] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] transition-all duration-1000 ${ref.inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
            <h3 className="text-[0.625rem] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-12">The Status Quo</h3>
            <ul className="space-y-10">
              <li className="flex gap-6 items-start">
                <Icons.x className="w-5 h-5 text-red-400 mt-1" />
                <div>
                  <p className="text-xl font-medium text-[var(--color-text-primary)]">The Endless Scroll</p>
                  <p className="mt-3 text-[var(--color-text-secondary)] font-normal leading-relaxed">Swiping on thumbnails of faces until they all start to look the same.</p>
                </div>
              </li>
              <li className="flex gap-6 items-start">
                <Icons.x className="w-5 h-5 text-red-400 mt-1" />
                <div>
                  <p className="text-xl font-medium text-[var(--color-text-primary)]">Small Talk Fatigue</p>
                  <p className="mt-3 text-[var(--color-text-secondary)] font-normal leading-relaxed">Starting ten conversations with "Hey, how's your week?" and ending ten.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className={`p-12 md:p-16 rounded-[3rem] bg-[var(--color-ink)] text-[var(--color-bg-primary)] shadow-2xl transition-all duration-1000 delay-300 ${ref.inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
            <h3 className="text-[0.625rem] font-bold uppercase tracking-[0.3em] text-[var(--color-bg-primary)] opacity-40 mb-12">The Bwend Way</h3>
            <ul className="space-y-10">
              <li className="flex gap-6 items-start">
                <Icons.check className="w-5 h-5 text-[var(--color-accent-peach)] mt-1" />
                <div>
                  <p className="text-xl font-medium text-[var(--color-bg-primary)]">The Daily Blend</p>
                  <p className="mt-3 text-[var(--color-bg-primary)] opacity-70 font-normal leading-relaxed">One high-intent connection a day. Focus on the person, not the catalog.</p>
                </div>
              </li>
              <li className="flex gap-6 items-start">
                <Icons.check className="w-5 h-5 text-[var(--color-accent-peach)] mt-1" />
                <div>
                  <p className="text-xl font-medium text-[var(--color-bg-primary)]">Music-first Momentum</p>
                  <p className="mt-3 text-[var(--color-bg-primary)] opacity-70 font-normal leading-relaxed">Start with a shared favorite track. The small talk is bypassed by default.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const ref = useInView();
  
  return (
    <section
      id="stories"
      ref={ref.ref}
      className={`section-spread bg-[var(--color-ink)] text-[var(--color-bg-primary)] overflow-hidden transition-all duration-1000 ${
        ref.inView ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-32">
          <SectionLabel className="text-white/40 mb-10">Before we launch</SectionLabel>
          <h2 className="font-display text-5xl md:text-7xl lg:text-[6rem] font-semibold tracking-tighter leading-[0.85]">
            The moments <br />we&apos;re designing for.
          </h2>
          <p className="mt-8 text-white/50 text-lg max-w-2xl mx-auto font-normal">
            No reviews yet. Here&apos;s the kind of connection we&apos;re building toward.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-20 lg:gap-32 items-start">
          <div className="relative">
             <Icons.quote className="w-12 h-12 text-white/10 absolute -top-16 -left-4" />
             <p className="text-2xl md:text-3xl font-medium leading-[1.1] tracking-tight italic opacity-95">
               &ldquo;I want the opener to be a song, not a pickup line.&rdquo;
             </p>
             <p className="mt-12 text-[0.625rem] font-bold uppercase tracking-[0.3em] text-white/40">Product north star</p>
          </div>
          <div className="relative">
             <p className="text-2xl md:text-3xl font-medium leading-[1.1] tracking-tight italic opacity-95">
               &ldquo;I&apos;m tired of swiping on faces. I want to know if we hear the same world.&rdquo;
             </p>
             <p className="mt-12 text-[0.625rem] font-bold uppercase tracking-[0.3em] text-white/40">Why taste first</p>
          </div>
          <div className="relative">
             <p className="text-2xl md:text-3xl font-medium leading-[1.1] tracking-tight italic opacity-95">
               &ldquo;If our playlists overlap in a weird way, that&apos;s a better first signal than small talk.&rdquo;
             </p>
             <p className="mt-12 text-[0.625rem] font-bold uppercase tracking-[0.3em] text-white/40">Shared energy</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTASection({ waitlist }: { waitlist: WaitlistSignup }) {
  return (
    <section id="waitlist" className="section-spread bg-[var(--color-bg-primary)]">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-32 items-center">
          <div className="order-2 lg:order-1">
            <SectionLabel className="mb-10">The Waitlist</SectionLabel>
            <h2 className="font-display text-6xl md:text-7xl lg:text-[7rem] font-semibold text-[var(--color-text-primary)] leading-[0.8] tracking-tighter">
              The <br />
              last app <br />
              you'll <br />
              <span className="italic font-serif">ever</span> <br />
              need.
            </h2>
            <p className="mt-14 text-[var(--color-text-secondary)] text-xl leading-relaxed max-w-sm font-normal">
              We&apos;re not live yet. Join the waitlist and we&apos;ll email you when the app opens. One match a day, no noise, music first.
            </p>

            {waitlist.submitted ? (
              <div className="mt-12 inline-flex items-center gap-4 px-8 py-5 rounded-full bg-[var(--color-accent-coral)]/10 border border-[var(--color-accent-coral)]/20 shadow-sm animate-fade-in">
                <Icons.check className="w-5 h-5 text-[var(--color-accent-coral)]" />
                <span className="text-[0.625rem] font-bold uppercase tracking-[0.2em]">on the list.</span>
              </div>
            ) : (
              <div className="mt-14 max-w-xl">
                <form onSubmit={waitlist.submit} className="flex flex-col sm:flex-row gap-4">
                  <input
                    type="email"
                    placeholder="Email"
                    value={waitlist.email}
                    onChange={(e) => waitlist.setEmail(e.target.value)}
                    required
                    disabled={waitlist.loading}
                    autoComplete="email"
                    className={`ds-input flex-1 font-medium ${waitlist.error ? 'ds-input-error' : ''}`}
                    aria-invalid={waitlist.error ? true : undefined}
                    aria-describedby={waitlist.error ? 'waitlist-error' : undefined}
                  />
                  <button
                    type="submit"
                    disabled={waitlist.loading}
                    className={`ds-btn ds-btn-primary whitespace-nowrap text-[0.625rem] font-bold uppercase tracking-[0.2em] px-12 shadow-xl ${waitlist.loading ? 'ds-btn-loading' : ''}`}
                  >
                    {waitlist.loading ? 'Joining…' : 'Join Waitlist'}
                  </button>
                </form>
                {waitlist.error ? (
                  <p id="waitlist-error" className="ds-field-error mt-4" role="alert">
                    {waitlist.error}
                  </p>
                ) : null}
              </div>
            )}
            <p className="mt-10 text-[0.625rem] font-bold uppercase tracking-[0.4em] text-[var(--color-text-muted)]">
              Designed for intention.
            </p>
          </div>
          <div className="order-1 lg:order-2 relative aspect-[square] lg:aspect-[10/12] rounded-[3.5rem] overflow-hidden shadow-2xl">
            <img 
               src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=100" 
               alt="Happy couple" 
               className="absolute inset-0 w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-1000" 
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-24 md:py-32 px-6 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 md:px-10">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-16 md:gap-10">
          <div className="col-span-2 md:col-span-2">
            <img src={logoDark} alt="Bwend" className="h-8 mb-8 dark:opacity-90" />
            <p className="text-lg md:text-xl text-[var(--color-text-secondary)] max-w-xs leading-relaxed font-normal">
              The dating app <br />designed for the playlist you actually replay.
            </p>
          </div>
          <div>
            <h3 className="text-[0.625rem] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-8">Navigation</h3>
            <ul className="space-y-6 text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">
              <li><a href="#how" className="hover:opacity-50 transition-opacity">How it works</a></li>
              <li><a href="#philosophy" className="hover:opacity-50 transition-opacity">Philosophy</a></li>
              <li><a href="#stories" className="hover:opacity-50 transition-opacity">Stories</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-[0.625rem] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-8">Social</h3>
            <ul className="space-y-6 text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">
              <li><a href="#" className="hover:opacity-50 transition-opacity">Instagram</a></li>
              <li><a href="#" className="hover:opacity-50 transition-opacity">TikTok</a></li>
              <li><a href="#" className="hover:opacity-50 transition-opacity">Twitter</a></li>
            </ul>
          </div>
          <div className="col-span-2 md:col-span-2">
            <h3 className="text-[0.625rem] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-8">Newsletter</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">Stay updated on our city launches.</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Email"
                required
                pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                title="Please enter a valid email address"
                className="ds-input flex-1 py-3 text-xs font-bold"
              />
              <button
                type="button"
                className="ds-btn ds-btn-primary shrink-0 px-6 py-3 text-[10px] font-bold uppercase tracking-widest"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div className="mt-32 pt-10 border-t border-[var(--color-border)] flex flex-col sm:flex-row justify-between items-center gap-8 opacity-50">
          <div className="flex items-center gap-8 text-[0.625rem] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            <span>© {new Date().getFullYear()} Bwend</span>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[0.625rem] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">A product of</span>
            <span className="text-xs font-serif italic text-[var(--color-text-primary)] font-bold">madamore.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function BwendLandingPage() {
  const waitlist = useWaitlistSignup();

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] theme-transition">
      <Navigation />
      <main>
        <HeroSection waitlist={waitlist} />
        <AppShowcaseSection />
        <LogoBar />
        <PhilosophySection />
        <LabsSection />
        <HowItWorksSection />
        <MidCTASection />
        <FeaturesSection />
        <StatsSection />
        <MoodsSection />
        <ComparisonSection />
        <TestimonialsSection />
        <FinalCTASection waitlist={waitlist} />
      </main>
      <Footer />
    </div>
  );
}
