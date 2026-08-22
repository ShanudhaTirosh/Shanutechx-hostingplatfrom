export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 rounded-full border-2 border-white/10 border-t-accent-teal-bright animate-spin" />
        <span className="text-text-muted text-sm">Loading...</span>
      </div>
    </div>
  );
}
