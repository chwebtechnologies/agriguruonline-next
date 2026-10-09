export default function Loading() {
  return (
    <div className="w-full max-w-7xl mx-auto pt-3 pb-5 px-4 min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i>
        <p className="text-xs text-muted-foreground font-medium animate-pulse">Loading profile...</p>
      </div>
    </div>
  );
}
