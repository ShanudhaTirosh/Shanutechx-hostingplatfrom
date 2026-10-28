export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg relative overflow-hidden select-none">
      {/* Ambient background glow & subtle grid */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <div className="z-10 flex flex-col items-center text-center space-y-5 max-w-sm w-full">
        {/* Animated Brand Emblem with Rotating Radar Ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-3xl border border-white/15 animate-spin [animation-duration:10s] pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-surface border border-white/15 p-3 flex items-center justify-center shadow-2xl relative z-10">
            <svg width="24" height="24" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Brand Title & Subtitle */}
        <div className="space-y-1">
          <h2 className="text-sm font-bold tracking-tight text-text-primary">
            STX <span className="text-text-muted font-medium">Cloud Platform</span>
          </h2>
          <p className="text-[11px] text-text-muted font-medium tracking-wide">
            Autonomous Compute & Container Orchestration
          </p>
        </div>

        {/* Shimmer Progress Track */}
        <div className="w-56 h-1 bg-white/10 rounded-full overflow-hidden relative">
          <div className="w-24 h-full bg-gradient-to-r from-transparent via-white to-transparent rounded-full animate-pulse" />
        </div>

        {/* Dynamic Status Text */}
        <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Loading workspace...</span>
        </div>
      </div>
    </div>
  );
}
