import { useEffect, useState } from "react";
import type { AppDefinition } from "@/apps/registry";
import { fetchConfig } from "@statusforge/hooks/useTauriApi";

interface CategoryInfo {
  id: string;
  label: string;
  apps: AppDefinition[];
}

interface Props {
  apps: AppDefinition[];
  categories: CategoryInfo[];
  onLaunch: (id: string) => void;
}

// Off by default (General -> Adult Content & Platforms) — a tile's static
// `description` is written once at app-registration time (before any config
// fetch could resolve), so unlike the rest of this app's zero-mention
// gating this can't just be left out of a filter/render call. Instead this
// strips any 18+ platform mention out of whatever text is actually shown,
// generically (covers any future tile that mentions one), rather than
// hand-editing individual apps' registered strings.
function sanitizeDescription(desc: string, adultContentEnabled: boolean): string {
  if (adultContentEnabled) return desc;
  return desc
    .replace(/,?\s*and Joystick\.tv/gi, "")
    .replace(/,?\s*Joystick\.tv,?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function Launcher({ categories, onLaunch }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [adultContentEnabled, setAdultContentEnabled] = useState(false);

  useEffect(() => {
    fetchConfig().then((cfg) => setAdultContentEnabled(!!cfg?.engine_settings.adult_content_enabled));
  }, []);

  const filteredCategories = activeCategory
    ? categories.filter((c) => c.id === activeCategory)
    : categories;

  const filteredApps = searchQuery.trim()
    ? filteredCategories
        .flatMap((c) => c.apps)
        .filter(
          (a) =>
            a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sanitizeDescription(a.description, adultContentEnabled)
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
        )
    : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="mb-4">
          <h1 className="text-[22px] font-bold text-white/90 tracking-tight">
            Ultimate Streaming Companion
          </h1>
          <p className="text-[12px] text-white/30 mt-0.5">
            All the tools a streamer needs, in one place
          </p>
        </div>

        {/* Search toolbar */}
        <div className="toolbar-glass">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search apps..."
              className="w-full pl-10 pr-8 py-2 bg-transparent text-white text-sm outline-none placeholder:text-white/28"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer bg-white/[0.06] border border-white/[0.06] rounded-md w-4 h-4 flex items-center justify-center text-[10px]"
              >✕</button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border cursor-pointer ${
              !activeCategory
                ? "bg-[var(--accent-system)]/12 text-[var(--accent-system)] border-[var(--accent-system)]/25"
                : "bg-white/[0.03] text-white/30 border-white/[0.06] hover:text-white/50 hover:bg-white/[0.05]"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-[var(--accent-system)]/12 text-[var(--accent-system)] border-[var(--accent-system)]/25"
                  : "bg-white/[0.03] text-white/30 border-white/[0.06] hover:text-white/50 hover:bg-white/[0.05]"
              }`}
            >
              {cat.label} ({cat.apps.length})
            </button>
          ))}
        </div>
      </div>

      {/* App grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filteredApps ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredApps.map((app) => (
              <AppCard key={app.id} app={app} onLaunch={onLaunch} adultContentEnabled={adultContentEnabled} />
            ))}
            {filteredApps.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/20 text-sm">
                No apps match "{searchQuery}"
              </div>
            )}
          </div>
        ) : (
          filteredCategories.map((cat) => (
            <div key={cat.id} className="mb-6">
              {cat.apps.length > 0 && (
                <>
                  <h2 className="text-[11px] uppercase tracking-widest text-white/25 font-semibold mb-3">
                    {cat.label}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {cat.apps.map((app) => (
                      <AppCard key={app.id} app={app} onLaunch={onLaunch} adultContentEnabled={adultContentEnabled} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AppCard({
  app,
  onLaunch,
  adultContentEnabled,
}: {
  app: AppDefinition;
  onLaunch: (id: string) => void;
  adultContentEnabled: boolean;
}) {
  return (
    <button
      onClick={() => onLaunch(app.id)}
      className="group text-left card-glass p-4 transition-all hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <div className="section-head-icon group-hover:scale-110 transition-transform">
          {app.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="section-head-title truncate">{app.name}</h3>
            {app.featured && (
              <span className="badge badge-purple shrink-0">Featured</span>
            )}
          </div>
          <p className="text-[11px] text-white/30 mt-1 line-clamp-2 leading-relaxed">
            {sanitizeDescription(app.description, adultContentEnabled)}
          </p>
          <span className="inline-block mt-2 badge badge-ghost">
            {app.category}
          </span>
        </div>
      </div>
    </button>
  );
}
