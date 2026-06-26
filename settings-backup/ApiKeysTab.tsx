import { useState, useRef, useEffect } from "react";
import { useSharedSettings } from "@/settings";
import type { ApiKeys } from "@/settings";

type Key =
  | "twitchClientId" | "twitchClientSecret" | "twitchAccessToken" | "twitchRefreshToken" | "twitchBroadcasterId"
  | "kickClientId" | "kickClientSecret" | "kickChannelId" | "kickToken" | "kickRefreshToken"
  | "joystickApiKey"
  | "steamgridApiKey" | "rawgApiKey"
  | "igdbClientId" | "igdbClientSecret" | "igdbAccessToken";

interface KeyField {
  key: Key;
  label: string;
  placeholder: string;
  secret: boolean;
}

interface PlatformDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  colorRgb: string;
  fields: KeyField[];
}

const allPlatforms: PlatformDef[] = [
  {
    id: "twitch",
    label: "Twitch",
    icon: "🟣",
    color: "#9146ff",
    colorRgb: "145, 70, 255",
    fields: [
      { key: "twitchClientId" as Key, label: "Client ID", placeholder: "Enter Twitch Client ID", secret: false },
      { key: "twitchClientSecret" as Key, label: "Client Secret", placeholder: "Enter Twitch Client Secret", secret: true },
      { key: "twitchAccessToken" as Key, label: "Access Token", placeholder: "Enter Twitch Access Token", secret: true },
      { key: "twitchRefreshToken" as Key, label: "Refresh Token", placeholder: "Enter Twitch Refresh Token", secret: true },
      { key: "twitchBroadcasterId" as Key, label: "Broadcaster ID", placeholder: "Enter Twitch Broadcaster ID", secret: false },
    ],
  },
  {
    id: "kick",
    label: "Kick",
    icon: "🟢",
    color: "#53fc18",
    colorRgb: "83, 252, 24",
    fields: [
      { key: "kickChannelId" as Key, label: "Channel ID", placeholder: "Enter Kick Channel ID", secret: false },
      { key: "kickClientId" as Key, label: "Client ID", placeholder: "Enter Kick Client ID", secret: false },
      { key: "kickClientSecret" as Key, label: "Client Secret", placeholder: "Enter Kick Client Secret", secret: true },
      { key: "kickToken" as Key, label: "Token", placeholder: "Enter Kick Token", secret: true },
      { key: "kickRefreshToken" as Key, label: "Refresh Token", placeholder: "Enter Kick Refresh Token", secret: true },
    ],
  },
  {
    id: "joystick",
    label: "JoystickTV",
    icon: "🟠",
    color: "#ff6b35",
    colorRgb: "255, 107, 53",
    fields: [
      { key: "joystickApiKey" as Key, label: "API Key", placeholder: "Enter JoystickTV API Key", secret: true },
    ],
  },
  {
    id: "steamgrid",
    label: "SteamGridDB",
    icon: "🎮",
    color: "#e74c3c",
    colorRgb: "231, 76, 60",
    fields: [
      { key: "steamgridApiKey" as Key, label: "API Key", placeholder: "Enter SteamGridDB API Key", secret: true },
    ],
  },
  {
    id: "rawg",
    label: "RAWG",
    icon: "🕹️",
    color: "#f5a623",
    colorRgb: "245, 166, 35",
    fields: [
      { key: "rawgApiKey" as Key, label: "API Key", placeholder: "Enter RAWG API Key", secret: true },
    ],
  },
  {
    id: "igdb",
    label: "IGDB",
    icon: "💾",
    color: "#6b5ce7",
    colorRgb: "107, 92, 231",
    fields: [
      { key: "igdbClientId" as Key, label: "Client ID", placeholder: "Enter IGDB Client ID", secret: false },
      { key: "igdbClientSecret" as Key, label: "Client Secret", placeholder: "Enter IGDB Client Secret", secret: true },
      { key: "igdbAccessToken" as Key, label: "Access Token", placeholder: "Enter IGDB Access Token", secret: true },
    ],
  },
];

// ── Floating Card for adding platforms ──────────────────────────────────────

function AddPlatformCard({
  available,
  onAdd,
  onClose,
  anchorRef,
}: {
  available: PlatformDef[];
  onAdd: (id: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        cardRef.current &&
        !cardRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={cardRef}
      className="fixed left-1/2 -translate-x-1/2 mt-2 w-64 bg-[#0c0c14]/95 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-xl z-50 animate-float-card-in overflow-hidden"
      style={{ top: anchorRef.current ? anchorRef.current.getBoundingClientRect().bottom + 8 : "50%" }}
    >
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-[12px] font-semibold text-white/80">Add Platform</h3>
        <p className="text-[10px] text-white/30 mt-0.5">Select a platform to configure</p>
      </div>
      <div className="px-2 pb-3 max-h-72 overflow-y-auto">
        {available.map((p) => (
          <button
            key={p.id}
            onClick={() => { onAdd(p.id); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
              style={{ backgroundColor: `rgba(${p.colorRgb}, 0.12)`, border: `1px solid rgba(${p.colorRgb}, 0.2)` }}
            >
              {p.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-white/70 group-hover:text-white/90 transition-colors">{p.label}</div>
              <div className="text-[10px] text-white/25">{p.fields.length} credential{p.fields.length !== 1 ? "s" : ""}</div>
            </div>
            <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        ))}
        {available.length === 0 && (
          <div className="px-3 py-6 text-center text-[11px] text-white/20">
            All platforms added
          </div>
        )}
      </div>
    </div>
  );
}

// ── Platform Card ───────────────────────────────────────────────────────────

function PlatformCard({
  platform,
  apiKeys,
  onUpdateKey,
  onRemove,
}: {
  platform: PlatformDef;
  apiKeys: ApiKeys;
  onUpdateKey: (field: Key, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [secretVisible, setSecretVisible] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleSecret = (key: string) => setSecretVisible((v) => ({ ...v, [key]: !v[key] }));

  const filledCount = platform.fields.filter((f) => (apiKeys[f.key] ?? "").trim() !== "").length;
  const totalCount = platform.fields.length;
  const isConfigured = filledCount === totalCount;
  const isPartial = filledCount > 0 && !isConfigured;

  const handleSave = () => {
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFieldUpdate = (field: Key, value: string) => {
    onUpdateKey(field, value);
  };

  return (
    <div
      className="border rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        borderColor: expanded
          ? `rgba(${platform.colorRgb}, 0.25)`
          : `rgba(${platform.colorRgb}, 0.08)`,
        backgroundColor: expanded
          ? `rgba(${platform.colorRgb}, 0.03)`
          : "rgba(255, 255, 255, 0.01)",
      }}
    >
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-all"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{ backgroundColor: `rgba(${platform.colorRgb}, 0.12)`, border: `1px solid rgba(${platform.colorRgb}, 0.15)` }}
        >
          {platform.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-white/85">{platform.label}</span>
            {isConfigured && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider"
                style={{ backgroundColor: `rgba(${platform.colorRgb}, 0.15)`, color: platform.color }}
              >
                Configured
              </span>
            )}
            {isPartial && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400/80">
                Partial
              </span>
            )}
            {filledCount === 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider bg-white/[0.04] text-white/20">
                Not set
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/25">
            {filledCount}/{totalCount} fields
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status dot */}
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: isConfigured
                ? platform.color
                : isPartial
                  ? "#f59e0b"
                  : "rgba(255,255,255,0.1)",
              boxShadow: isConfigured ? `0 0 6px ${platform.color}60` : "none",
            }}
          />
          {/* Edit button */}
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(!editing); setSaved(false); setExpanded(true); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          {/* Delete button */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(platform.id); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-red-400/80 hover:bg-red-500/[0.08] transition-all"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
          <svg
            className={`w-4 h-4 text-white/25 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 animate-float-card-in">
          {/* Action bar */}
          <div className="flex items-center gap-2 mb-4 pt-1">
            {editing && (
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ml-auto"
                style={{
                  borderColor: saved ? "rgba(34,197,94,0.3)" : `rgba(${platform.colorRgb}, 0.3)`,
                  backgroundColor: saved ? "rgba(34,197,94,0.1)" : `rgba(${platform.colorRgb}, 0.12)`,
                  color: saved ? "#22c55e" : platform.color,
                }}
              >
                {saved ? "✓ Saved" : "Save"}
              </button>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-3">
            {platform.fields.map((field) => {
              const hasValue = (apiKeys[field.key] ?? "").trim() !== "";
              return (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-white/40">
                      {field.label}
                    </label>
                    {editing && hasValue && (
                      <span className="text-[9px] text-white/15">●</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={field.secret && !secretVisible[field.key] ? "password" : "text"}
                      value={apiKeys[field.key] ?? ""}
                      onChange={(e) => editing && handleFieldUpdate(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      readOnly={!editing}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none transition-all ${
                        editing
                          ? "bg-black/30 border text-white/80 focus:border-[var(--accent-system)]/40 placeholder:text-white/20"
                          : "bg-white/[0.02] border text-white/50 cursor-default placeholder:text-white/15"
                      }`}
                      style={{
                        borderColor: editing
                          ? `rgba(${platform.colorRgb}, 0.15)`
                          : "rgba(255,255,255,0.04)",
                      }}
                    />
                    {field.secret && (
                      <button
                        onClick={() => toggleSecret(field.key)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-all text-[10px]"
                      >
                        {secretVisible[field.key] ? "🙈" : "👁️"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ApiKeysTab ─────────────────────────────────────────────────────────

export default function ApiKeysTab() {
  const { apiKeys, updateApiKey, setApiKeys } = useSharedSettings();
  const [activePlatforms, setActivePlatforms] = useState<string[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const activePlatformDefs = activePlatforms
    .map((id) => allPlatforms.find((p) => p.id === id)!)
    .filter(Boolean);

  const availablePlatforms = allPlatforms.filter((p) => !activePlatforms.includes(p.id));

  const totalFields = activePlatformDefs.reduce((sum, p) => sum + p.fields.length, 0);
  const filledFields = activePlatformDefs.reduce(
    (sum, p) => sum + p.fields.filter((f) => (apiKeys[f.key] ?? "").trim() !== "").length,
    0
  );

  const handleAddPlatform = (id: string) => {
    setActivePlatforms((prev) => [...prev, id]);
  };

  const handleRemovePlatform = (id: string) => {
    const platform = allPlatforms.find((p) => p.id === id);
    if (!platform) return;
    // Clear the keys for this platform
    const reset: Partial<ApiKeys> = {};
    platform.fields.forEach((f) => { (reset as any)[f.key] = ""; });
    setApiKeys({ ...apiKeys, ...reset });
    setActivePlatforms((prev) => prev.filter((p) => p !== id));
  };

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[18px] font-bold text-white/90 tracking-tight">Platform & Keys</h2>
          <p className="text-[11px] text-white/30 mt-0.5">
            {filledFields}/{totalFields} credentials configured
          </p>
        </div>
        <div className="relative">
          <button
            ref={addButtonRef}
            onClick={() => setAddMenuOpen(!addMenuOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-semibold transition-all border bg-[var(--accent-system)]/10 border-[var(--accent-system)]/25 text-[var(--accent-system)] hover:bg-[var(--accent-system)]/15 shadow-md shadow-[var(--accent-system)]/5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Platform
          </button>
          {addMenuOpen && (
            <AddPlatformCard
              available={availablePlatforms}
              onAdd={handleAddPlatform}
              onClose={() => setAddMenuOpen(false)}
              anchorRef={addButtonRef}
            />
          )}
        </div>
      </div>

      {/* Platform cards */}
      <div className="space-y-2.5">
        {activePlatformDefs.map((p) => (
          <PlatformCard
            key={p.id}
            platform={p}
            apiKeys={apiKeys}
            onUpdateKey={updateApiKey}
            onRemove={handleRemovePlatform}
          />
        ))}
      </div>

      {activePlatformDefs.length === 0 && (
        <div className="text-center py-16">
          <div className="text-3xl mb-3 opacity-15">🔑</div>
          <p className="text-[13px] text-white/25">No platforms configured</p>
          <p className="text-[11px] text-white/15 mt-1">Click "Add Platform" to get started</p>
        </div>
      )}
    </div>
  );
}
