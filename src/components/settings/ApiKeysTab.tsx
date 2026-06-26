import { useState, useRef, useEffect } from "react";
import { useSharedSettings } from "@/settings";
import type { ApiKeys, RoutingMode } from "@/settings";
import {
  CollapsibleSection,
  EditRemoveButtons,
  SettingsInput,
  GlassSelect,
} from "./SettingsComponents";

const routingModeOptions = [
  { value: "streamer_bot", label: "Streamer.bot" },
  { value: "native", label: "Native (Direct API)" },
];

// ─── API Key types & catalog ────────────────────────────────────────────────

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
  connectionModes?: { mode: "api" | "ws"; label: string; description: string }[];
  routingKey?: "preferredTwitchMode" | "preferredKickMode" | "preferredJoystickMode";
  connectUrl?: string;
}

const allPlatforms: PlatformDef[] = [
  {
    id: "twitch",
    label: "Twitch",
    icon: "🟣",
    color: "#9146ff",
    colorRgb: "145, 70, 255",
    connectionModes: [
      { mode: "api", label: "API Mode", description: "REST API calls" },
      { mode: "ws", label: "WebSocket", description: "IRC WebSocket" },
    ],
    routingKey: "preferredTwitchMode",
    connectUrl: "http://127.0.0.1:53735/twitch/login",
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
    connectionModes: [
      { mode: "api", label: "API Mode", description: "REST API calls" },
      { mode: "ws", label: "WebSocket", description: "Pusher WebSocket" },
    ],
    routingKey: "preferredKickMode",
    connectUrl: "http://127.0.0.1:53735/kick/login",
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
    connectionModes: [
      { mode: "api", label: "API Mode", description: "REST API calls" },
      { mode: "ws", label: "WebSocket", description: "Direct WebSocket" },
    ],
    routingKey: "preferredJoystickMode",
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
      className="fixed left-1/2 -translate-x-1/2 mt-2 w-64 surface-glass rounded-2xl shadow-2xl shadow-black/60 z-50 animate-float-card-in overflow-hidden"
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group border-none bg-transparent cursor-pointer"
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
  routing,
  onUpdateRouting,
}: {
  platform: PlatformDef;
  apiKeys: ApiKeys;
  onUpdateKey: (field: Key, value: string) => void;
  onRemove: (id: string) => void;
  routing: any;
  onUpdateRouting: (key: any, value: any) => void;
}) {
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

  const statusBadge = isConfigured ? (
    <span className="badge badge-green">Configured</span>
  ) : isPartial ? (
    <span className="badge badge-amber">Partial</span>
  ) : (
    <span className="badge badge-ghost">Not set</span>
  );

  return (
    <CollapsibleSection
      title={platform.label}
      icon={platform.icon}
      badge={
        <div className="flex items-center gap-2">
          <span className={`status-dot ${isConfigured ? "on" : isPartial ? "warn" : "off"}`} />
          {statusBadge}
        </div>
      }
    >
      <div className="flex items-center justify-between mb-4 pt-1">
        <EditRemoveButtons
          isEditing={editing}
          onToggleEdit={() => { setEditing(!editing); setSaved(false); }}
          onRemove={() => onRemove(platform.id)}
        />
        {editing && (
          <button
            onClick={handleSave}
            className={`btn-icon-sm edit ${saved ? "active" : ""}`}
            style={{
              borderColor: saved ? "rgba(34,197,94,0.3)" : undefined,
              backgroundColor: saved ? "rgba(34,197,94,0.1)" : undefined,
              color: saved ? "#22c55e" : undefined,
            }}
          >
            {saved ? "✓ Saved" : "Save"}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {platform.fields.map((field) => {
          const hasValue = (apiKeys[field.key] ?? "").trim() !== "";
          return (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                  {field.label}
                </label>
                {editing && hasValue && (
                  <span className="text-[9px] text-white/15">●</span>
                )}
              </div>
              <div className="relative">
                <SettingsInput
                  type={field.secret && !secretVisible[field.key] ? "password" : "text"}
                  value={apiKeys[field.key] ?? ""}
                  onChange={(e) => editing && onUpdateKey(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  readOnly={!editing}
                  style={{
                    borderColor: editing
                      ? `rgba(${platform.colorRgb}, 0.15)`
                      : "rgba(255,255,255,0.04)",
                    backgroundColor: editing ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.02)",
                    color: editing ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)",
                  }}
                />
                {field.secret && (
                  <button
                    onClick={() => toggleSecret(field.key)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-all text-[10px] cursor-pointer border-none bg-transparent"
                  >
                    {secretVisible[field.key] ? "🙈" : "👁️"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Connection Mode (streaming platforms only) */}
        {platform.connectionModes && platform.routingKey && (
          <div className="mt-4 pt-3 border-t border-white/[0.04]">
            <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-2">Connection Mode</label>
            <div className="flex gap-2">
              {platform.connectionModes.map((cm) => {
                const isActive = routing[platform.routingKey!] === cm.mode;
                const isJoystickWs = platform.id === "joystick" && cm.mode === "ws";
                return (
                  <button
                    key={cm.mode}
                    onClick={() => !isJoystickWs && onUpdateRouting(platform.routingKey!, cm.mode)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] font-medium border transition-all ${
                      isActive
                        ? `border-[${platform.color}]/40 text-[${platform.color}] bg-[${platform.color}]/10`
                        : isJoystickWs
                          ? "border-white/[0.04] text-white/15 cursor-default"
                          : "border-white/[0.06] text-white/25 hover:border-white/[0.1] hover:bg-white/[0.03]"
                    }`}
                    style={isActive ? { borderColor: `rgba(${platform.colorRgb}, 0.4)`, color: platform.color, backgroundColor: `rgba(${platform.colorRgb}, 0.1)` } : undefined}
                  >
                    <span className="block font-semibold">{cm.label}</span>
                    <span className="block text-[9px] mt-0.5 opacity-50">
                      {platform.id === "joystick" && cm.mode === "ws" ? "Only option available" : cm.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {platform.id === "joystick" && (
              <p className="text-[10px] text-white/15 mt-2 italic">ℹ️ JoystickTV has no public API — WebSocket only.</p>
            )}
            {platform.connectUrl && (
              <button
                onClick={() => window?.open?.(platform.connectUrl, "_blank")}
                className="btn-ghost mt-2"
              >
                🔗 Connect {platform.label}
              </button>
            )}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

// ── Main Tab: Connections & Keys (merged routing + api keys) ────────────────

export default function ApiKeysTab() {
  const { apiKeys, updateApiKey, setApiKeys, routing, updateRouting, setRouting } = useSharedSettings();
  const [activePlatforms, setActivePlatforms] = useState<string[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
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
    const reset: Partial<ApiKeys> = {};
    platform.fields.forEach((f) => { (reset as any)[f.key] = ""; });
    setApiKeys({ ...apiKeys, ...reset });
    setActivePlatforms((prev) => prev.filter((p) => p !== id));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setRouting({
      ...routing,
      routingMode: "streamer_bot",
      sbPort: 8080,
      sbActionName: "UpdateCategory",
      preferredTwitchMode: "ws",
      preferredKickMode: "api",
      preferredJoystickMode: "ws",
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Routing Section ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-[18px] font-bold text-white/90 tracking-tight mb-4">Routing</h2>

        {/* Mode */}
        <div className="surface-card rounded-2xl p-5 mb-3">
          <h3 className="text-white font-semibold text-[13px] mb-4">Mode</h3>
          <div className="mb-4">
            <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Routing Mode</label>
            <GlassSelect value={routing.routingMode} options={routingModeOptions} onChange={(v) => updateRouting("routingMode", v as RoutingMode)} className="w-full" />
          </div>
          {routing.routingMode === "streamer_bot" && (
            <>
              <div className="mb-4">
                <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Streamer.bot Port</label>
                <input
                  type="number"
                  value={routing.sbPort ?? 8080}
                  onChange={(e) => updateRouting("sbPort", parseInt(e.target.value) || 8080)}
                  className="input-glass w-full font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Action Name</label>
                <input
                  value={routing.sbActionName ?? ""}
                  onChange={(e) => updateRouting("sbActionName", e.target.value)}
                  className="input-glass w-full"
                />
              </div>
            </>
          )}
        </div>

        {/* Routing Actions */}
        <div className="flex gap-3">
          <button onClick={handleSave} className="btn-ghost">
            {saved ? "✓ Saved" : "Save Routing"}
          </button>
          <button onClick={handleReset} className="btn-ghost">
            Reset
          </button>
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── API Keys Section ─────────────────────────────────────────────── */}
      <div>
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
              className="btn-cta"
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
              routing={routing}
              onUpdateRouting={updateRouting}
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
    </div>
  );
}
