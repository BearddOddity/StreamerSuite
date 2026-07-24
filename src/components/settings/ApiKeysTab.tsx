// ─── Connections & Keys ──────────────────────────────────────────────────────
// Centralized port of StatusForge's ApiRoutingSubTab (see
// src/apps/statusforge/SettingsView.tsx's now-pointer-only ApiRoutingSubTab).
// This is the ONE place Twitch/Kick/Joystick.tv and metadata-provider API
// keys get connected/edited/removed — every tool (StatusForge, Alerts Hub,
// Multi-Chat, Stream Manager, Stream Stats) reads from the same AppConfig
// (Config.json + the "statusforge.io" OS keychain service) this tab writes
// to via export_config/import_config/disconnect_platform.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import type { AppConfig, ApiKeys } from "@statusforge/types";
import { saveConfig, tauriApi } from "@statusforge/hooks/useTauriApi";
import OAuthConnectModal from "@statusforge/components/OAuthConnectModal";
import { PlatformIcon } from "../common/PlatformIcon";
import { EditRemoveButtons, Toggle } from "./SettingsComponents";

type ToastType = "success" | "error" | "info";

const defaultConfig: AppConfig = {
  api_keys: {
    steamgrid: "",
    rawg: "",
    igdb_client: "",
    igdb_secret: "",
    igdb_token: "",
    thegamesdb: "",
  },
  broadcaster: {
    routing_mode: "native" as const,
    twitch_client: "",
    twitch_secret: "",
    twitch_token: "",
    twitch_refresh: "",
    twitch_broadcaster_id: "",
    kick_client: "",
    kick_secret: "",
    kick_channel_id: "",
    kick_token: "",
    kick_refresh: "",
    joystick_client: "",
    joystick_secret: "",
    joystick_token: "",
    joystick_refresh: "",
    joystick_username: "",
  },
  engine_settings: {
    idle_category: "Just Chatting",
    sb_port: 8080,
    scan_interval: 15,
    grace_period: 0,
    overlay_poll_rate: 8,
    safe_mode: false,
    auto_push: false,
    platform_push_enabled: true,
    overlay_fade_timer: 15,
    strict_forge_mode: false,
    sb_action_name: "UpdateCategory",
    overlay_token: "",
    blipy_pin: "0000",
    blipy_pairing_key: "",
    blipy_link_active: false,
    emulator_detection: true,
    ram_threshold: 80,
    process_filter_bypass: false,
    confidence_threshold: 0.5,
    trap_chromium: true,
    trap_cmdline: true,
    trap_ui_framework: true,
    trap_geometry: true,
    score_engine_dna: true,
    score_fullscreen: true,
    score_window_title: true,
    score_ram: true,
  },
};

// ─── Key catalog (all available slots) ─────────────────────────────────────
const KEY_CATALOG: {
  key: string;
  label: string;
  desc: string;
  icon: string;
  keyUrl: string;
  group?: { key: string; label: string }[];
}[] = [
  {
    key: "steamgrid",
    label: "SteamGridDB",
    desc: "Custom grid artwork, hero banners, and logo images",
    icon: "🖼️",
    keyUrl: "https://www.steamgriddb.com/profile/preferences/api",
  },
  {
    key: "rawg",
    label: "RAWG",
    desc: "Game metadata — genres, ratings, release dates, screenshots",
    icon: "🎮",
    keyUrl: "https://rawg.io/apidocs",
  },
  {
    key: "igdb",
    label: "IGDB",
    desc: "Twitch-authenticated IGDB API — game data, covers, screenshots, release dates",
    icon: "🎮",
    keyUrl: "https://dev.twitch.tv/console/apps",
    group: [
      { key: "igdb_client", label: "Client ID" },
      { key: "igdb_secret", label: "Client Secret" },
      { key: "igdb_token", label: "Access Token" },
    ],
  },
  {
    key: "thegamesdb",
    label: "TheGamesDB",
    desc: "Community-run game database — strong coverage for older/retro console games",
    icon: "🕹️",
    keyUrl: "https://thegamesdb.net/",
  },
];

// ─── Routing catalog ───────────────────────────────────
const ROUTING_CATALOG: {
  key: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  connectUrl: string;
  keyUrl: string;
  userFields: { key: string; label: string; hint?: string; optional?: boolean }[];
  managedFields?: { key: string; label: string }[];
}[] = [
  {
    key: "twitch",
    label: "Twitch",
    desc: "OAuth2 via Twitch — game category updates, chat, moderation, alerts, and stream info",
    keyUrl: "https://dev.twitch.tv/console/apps",
    icon: (
      <svg width="16" height="16" viewBox="0 0 2400 2800" fill="currentColor">
        <path d="M500,0L0,500v1800h600v500l500-500h400l900-900V0H500z M2200,1300l-400,400h-400l-350,350v-350H600V200h1600 V1300z" />
        <rect x="1700" y="550" width="200" height="600" />
        <rect x="1150" y="550" width="200" height="600" />
      </svg>
    ),
    color: "#9146FF",
    connectUrl: "http://127.0.0.1:53735/twitch/login",
    userFields: [
      { key: "twitch_client", label: "Client ID" },
      { key: "twitch_secret", label: "Client Secret" },
      {
        key: "twitch_token",
        label: "Access Token (Optional)",
        hint: "Alternate to Client Secret — paste a token here if you generate one yourself (your own OAuth tool/callback). Client ID is still required — Twitch's API needs it on every request regardless of how the token was obtained.",
        optional: true,
      },
      {
        key: "twitch_broadcaster_id",
        label: "Broadcaster ID (Optional)",
        hint: 'Only needed alongside a manually-pasted Access Token — "Connect Twitch" fetches this automatically.',
        optional: true,
      },
    ],
    managedFields: [{ key: "twitch_refresh", label: "Refresh Token" }],
  },
  {
    key: "kick",
    label: "Kick",
    desc: "OAuth2 via Kick — channel updates, chat, moderation, and stream metadata",
    keyUrl: "https://kick.com/settings/developer",
    icon: (
      <svg width="16" height="16" viewBox="0 0 453.9 510.6" fill="currentColor">
        <path d="M0,0h170.2v113.5h56.7v-56.7h56.7V0h170.2v170.2h-56.7v56.7h-56.7v56.7h56.7v56.7h56.7v170.2h-170.2v-56.7h-56.7v-56.7h-56.7v113.5H0V0Z" />
      </svg>
    ),
    color: "#00e676",
    connectUrl: "http://127.0.0.1:53735/kick/login",
    userFields: [
      { key: "kick_client", label: "Client ID" },
      { key: "kick_secret", label: "Client Secret" },
      { key: "kick_channel_id", label: "Channel ID" },
      {
        key: "kick_token",
        label: "Access Token (Optional)",
        hint: "Alternate to Client ID and Client Secret — paste a token here if you generate one yourself (your own OAuth tool/callback). Kick's API doesn't need either once you have a token.",
        optional: true,
      },
    ],
    managedFields: [{ key: "kick_refresh", label: "Refresh Token" }],
  },
  {
    key: "joystick",
    label: "Joystick.tv",
    desc: "OAuth2 via Joystick.tv — chat, moderation, and tip alerts",
    keyUrl: "https://developer.joystick.tv/",
    icon: <PlatformIcon platform="joystick" size="sm" variant="light" />,
    color: "#76e1f0",
    // No popup-based connect flow like Twitch/Kick (those go through the
    // always-on local axum server at 53735) — Joystick's OAuth is a
    // browser+loopback flow driven by Multi-Chat's `oauth_login` Tauri
    // command (src-tauri/src/multichat.rs), invoked directly below instead
    // of through OAuthConnectModal. Empty here just means "no connectUrl
    // popup for this platform."
    connectUrl: "",
    userFields: [
      { key: "joystick_client", label: "Client ID" },
      { key: "joystick_secret", label: "Client Secret" },
      {
        key: "joystick_token",
        label: "Access Token (Optional)",
        hint: "Alternate to Client ID and Client Secret — paste a token here if you generate one yourself. No client secret is exposed cross-tool this way.",
        optional: true,
      },
    ],
    managedFields: [
      { key: "joystick_refresh", label: "Refresh Token" },
      { key: "joystick_username", label: "Connected As" },
    ],
  },
];

export default function ApiKeysTab() {
  const [section, setSection] = useState<"keys" | "routing">("keys");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [floatingClosing, setFloatingClosing] = useState(false);
  const [floatingType, setFloatingType] = useState<"keys" | "routing">("keys");
  const [search, setSearch] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [oauthModal, setOauthModal] = useState<{ platform: "twitch" | "kick"; url: string } | null>(
    null
  );
  const [validatingPlatform, setValidatingPlatform] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: ToastType } | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const skipSave = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, type: ToastType = "info") => {
    setToastMsg({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const loadConfig = useCallback(async () => {
    skipSave.current = true;
    const res = await tauriApi("export_config");
    // A fresh install (no Config.json yet) returns {} — fall back to defaults
    // so section accesses (engine_settings, api_keys, …) never crash.
    if (res && typeof res === "object" && !("error" in res) && "engine_settings" in res) {
      setConfig(res as AppConfig);
    } else {
      setConfig(defaultConfig);
    }
    setTimeout(() => {
      skipSave.current = false;
    }, 500);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!config || skipSave.current) return;
    const timer = setTimeout(async () => {
      try {
        const res = await saveConfig(config);
        toast(res, res.includes("success") ? "success" : "error");
      } catch {
        toast("Dev mode: config saved to memory (Tauri not connected)", "info");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [config, toast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && floatingOpen) closeFloating();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatingOpen]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type === "oauth-callback") {
        loadConfig();
        if (e.data.status === "success") {
          toast(
            e.data.platform.charAt(0).toUpperCase() + e.data.platform.slice(1) + " connected!",
            "success"
          );
        } else {
          toast(
            e.data.platform.charAt(0).toUpperCase() +
              e.data.platform.slice(1) +
              " connection failed",
            "error"
          );
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [loadConfig, toast]);

  const openFloating = (type: "keys" | "routing") => {
    setSearch("");
    setFloatingClosing(false);
    setFloatingType(type);
    setFloatingOpen(true);
  };

  const closeFloating = () => {
    setFloatingClosing(true);
    setTimeout(() => {
      setFloatingOpen(false);
      setFloatingClosing(false);
    }, 200);
  };

  // ── API Keys helpers ─────────────────────────────────
  const setKey = (key: string, value: string) => {
    setConfig((prev) => ({
      ...prev!,
      api_keys: { ...prev!.api_keys, [key]: value },
    }));
  };

  const isKeyEntryActive = (entry: (typeof KEY_CATALOG)[number]) => {
    if (entry.group) return entry.group.some((g) => activeApiKeys.includes(g.key as keyof ApiKeys));
    return activeApiKeys.includes(entry.key as keyof ApiKeys);
  };

  const activeApiKeys = config ? (Object.keys(config.api_keys) as Array<keyof ApiKeys>) : [];

  const availableKeys = KEY_CATALOG.filter((k) => !isKeyEntryActive(k));
  const filteredAvailableKeys = search
    ? availableKeys.filter(
        (k) =>
          k.label.toLowerCase().includes(search.toLowerCase()) ||
          k.desc.toLowerCase().includes(search.toLowerCase())
      )
    : availableKeys;

  const addKeyFromCatalog = (entry: (typeof KEY_CATALOG)[number]) => {
    setConfig((prev) => {
      const next = { ...prev!.api_keys };
      if (entry.group) {
        for (const g of entry.group)
          next[g.key as keyof ApiKeys] = next[g.key as keyof ApiKeys] || "";
        return { ...prev!, api_keys: next };
      }
      next[entry.key as keyof ApiKeys] = "";
      return { ...prev!, api_keys: next };
    });
    setEditingKey(entry.key);
    closeFloating();
  };

  const removeKeyEntry = (entry: (typeof KEY_CATALOG)[number]) => {
    setConfig((prev) => {
      const next = { ...prev!.api_keys };
      if (entry.group) {
        for (const g of entry.group) delete next[g.key as keyof ApiKeys];
      } else {
        delete next[entry.key as keyof ApiKeys];
      }
      return { ...prev!, api_keys: next };
    });
    if (editingKey === entry.key) setEditingKey(null);
    toast("Key removed — save to confirm", "info");
  };

  const truncate = (v: string) => (v.length > 8 ? v.slice(0, 4) + "…" + v.slice(-4) : "—");

  // ── Routing helpers ────────────────────────────────
  const setField = (key: string, value: string) => {
    setConfig((prev) => ({
      ...prev!,
      broadcaster: { ...prev!.broadcaster, [key]: value },
    }));
  };

  const isRouteEntryActive = (entry: (typeof ROUTING_CATALOG)[number]) => {
    if (!config) return false;
    const allKeys = [
      ...entry.userFields.map((f) => f.key),
      ...(entry.managedFields?.map((f) => f.key) ?? []),
    ];
    // Presence, not truthiness: addRouteFromCatalog sets a field to "" to
    // activate its card (so the user can type into it), and removeRouteEntry
    // deletes the key entirely to deactivate it. A truthy check meant a
    // freshly-added, still-empty platform never satisfied its own
    // activation check, so clicking "+ Add" silently did nothing.
    return allKeys.some((k) => k in config.broadcaster);
  };

  const availableRoutes = ROUTING_CATALOG.filter((e) => !isRouteEntryActive(e));
  const filteredAvailableRoutes = search
    ? availableRoutes.filter(
        (e) =>
          e.label.toLowerCase().includes(search.toLowerCase()) ||
          e.desc.toLowerCase().includes(search.toLowerCase())
      )
    : availableRoutes;

  const addRouteFromCatalog = (entry: (typeof ROUTING_CATALOG)[number]) => {
    setConfig((prev) => {
      const next = { ...prev!.broadcaster };
      for (const f of entry.userFields)
        next[f.key as keyof typeof next] = (next[f.key as keyof typeof next] || "") as any;
      return { ...prev!, broadcaster: next };
    });
    setEditingKey(entry.key);
    closeFloating();
  };

  const removeRouteEntry = (entry: (typeof ROUTING_CATALOG)[number]) => {
    setConfig((prev) => {
      const next = { ...prev!.broadcaster };
      const allKeys = [
        ...entry.userFields.map((f) => f.key),
        ...(entry.managedFields?.map((f) => f.key) ?? []),
      ];
      for (const k of allKeys) delete next[k as keyof typeof next];
      return { ...prev!, broadcaster: next };
    });
    if (editingKey === entry.key) setEditingKey(null);
    toast("Integration removed — save to confirm", "info");
  };

  // OAuth-backed entries (Twitch/Kick/Joystick) route through
  // disconnect_platform, which deletes the keychain entry too — clearing
  // fields alone leaves it in place and the next config load just backfills
  // it. Persists right away, unlike removeRouteEntry's "save to confirm".
  const disconnectRoute = async (entry: (typeof ROUTING_CATALOG)[number]) => {
    try {
      await tauriApi("disconnect_platform", { platform: entry.key });
    } catch (e) {
      toast(`Failed to disconnect ${entry.label}: ${e}`, "error");
      return;
    }
    if (editingKey === entry.key) setEditingKey(null);
    // disconnect_platform already persisted the change to disk — reload
    // rather than locally clearing fields, so state matches what's saved.
    const res = await tauriApi("export_config").catch(() => null);
    if (res) setConfig(res as AppConfig);
    toast(`${entry.label} disconnected. Reconnect any time in Connections & Keys.`, "success");
  };

  // If a manually-pasted access token is already present, validate it
  // directly instead of launching the OAuth popup — that's the whole point
  // of the "Access Token (Optional)" field as an alternate connection path.
  const connectOrValidate = async (entry: (typeof ROUTING_CATALOG)[number]) => {
    const tokenKey = `${entry.key}_token`;
    const hasManualToken = !!bc[tokenKey as keyof typeof bc];
    if (!hasManualToken) {
      setOauthModal({ platform: entry.key as "twitch" | "kick", url: entry.connectUrl });
      return;
    }

    setValidatingPlatform(entry.key);
    const cmd = entry.key === "kick" ? "kick_validate_token" : "twitch_validate_token";
    const res = await tauriApi(cmd);
    setValidatingPlatform(null);

    if (res && typeof res === "object" && "error" in res) {
      toast(`${entry.label} token invalid: ${(res as { error: string }).error}`, "error");
      return;
    }
    toast(`Connected to ${entry.label} as ${res}`, "success");
    loadConfig();
  };

  // Joystick's OAuth flow isn't the popup-based connectUrl pattern Twitch/
  // Kick use — it's Multi-Chat's own browser+loopback `oauth_login` command
  // (src-tauri/src/multichat.rs), which now writes into this same shared
  // AppConfig instead of Multi-Chat's private keychain. Calling it here
  // means there's exactly one Joystick OAuth implementation, reachable both
  // from this tab and from Multi-Chat's own Settings.
  const connectJoystick = async () => {
    if (!bc.joystick_client || !bc.joystick_secret) {
      toast("Enter a Joystick Client ID and Client Secret first", "error");
      return;
    }
    setValidatingPlatform("joystick");
    const res = await tauriApi("oauth_login", {
      platform: "joystick",
      clientId: bc.joystick_client,
      clientSecret: bc.joystick_secret,
    });
    setValidatingPlatform(null);
    if (res && typeof res === "object" && "error" in res) {
      toast(`Joystick.tv connect failed: ${(res as { error: string }).error}`, "error");
      return;
    }
    toast("Joystick.tv connected!", "success");
    loadConfig();
  };

  // ── Floating card ─────────────────────────────────
  const renderFloatingCard = () => {
    if (!floatingOpen) return null;
    const isKeys = floatingType === "keys";
    const items = isKeys ? filteredAvailableKeys : filteredAvailableRoutes;
    const title = isKeys ? "Add API Key" : "Add Integration";
    const placeholder = isKeys ? "Search keys…" : "Search integrations…";
    const emptyMain = isKeys
      ? search
        ? "No matches"
        : "All keys added"
      : search
        ? "No matches"
        : "All integrations active";
    const emptySub = isKeys
      ? search
        ? "Try a different search term"
        : "You can manage keys in the list"
      : search
        ? "Try a different search term"
        : "You can manage integrations in the list";

    return (
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-end bg-black/50 ${
          floatingClosing ? "" : "animate-float-backdrop"
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeFloating();
        }}
      >
        <div
          ref={floatingRef}
          className={`relative w-[380px] h-full max-h-[600px] m-4 flex flex-col bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-[color-mix(in_srgb,var(--user-accent,#9146ff)_20%,transparent)] ${
            floatingClosing ? "animate-float-card-out" : "animate-float-card-in"
          }`}
        >
          <div className="p-5 pb-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">{title}</h3>
              <button
                onClick={closeFloating}
                className="w-7 h-7 rounded-lg surface-1 hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/80 transition-colors cursor-pointer"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="input-glass"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-5 pt-3 flex flex-col gap-2 min-h-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-white/30">
                <p className="text-sm mb-1">{emptyMain}</p>
                <p className="text-[10px]">{emptySub}</p>
              </div>
            ) : isKeys ? (
              (items as (typeof KEY_CATALOG)[number][]).map((k) => (
                <button
                  key={k.key}
                  onClick={() => addKeyFromCatalog(k)}
                  className="flex items-center gap-3 p-3 rounded-xl surface-1 hover:bg-white/[0.07] hover:border-white/15 transition-all cursor-pointer text-left group"
                >
                  <span className="section-head-icon text-sm !w-8 !h-8 !rounded-lg">{k.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white/80 font-medium block">{k.label}</span>
                    <span className="text-[10px] text-white/30 block truncate">{k.desc}</span>
                  </div>
                  <span className="badge badge-purple opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    + Add
                  </span>
                </button>
              ))
            ) : (
              (items as (typeof ROUTING_CATALOG)[number][]).map((e) => (
                <button
                  key={e.key}
                  onClick={() => addRouteFromCatalog(e)}
                  className="flex items-center gap-3 p-3 rounded-xl surface-1 hover:bg-white/[0.07] hover:border-white/15 transition-all cursor-pointer text-left group"
                >
                  <span
                    className="section-head-icon text-sm !w-8 !h-8 !rounded-lg"
                    style={{ backgroundColor: `${e.color}15`, color: e.color }}
                  >
                    {e.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white/80 font-medium block">{e.label}</span>
                    <span className="text-[10px] text-white/30 block truncate">{e.desc}</span>
                  </div>
                  <span className="badge badge-purple opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    + Add
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!config) return <p className="text-white/40 p-6">Loading…</p>;

  // ── API Keys display data ──────────────────────────
  const apiKeys = config.api_keys || ({} as AppConfig["api_keys"]);

  const displayKeyEntries = KEY_CATALOG.filter((entry) => isKeyEntryActive(entry));
  const catalogKeys = new Set(
    KEY_CATALOG.flatMap((e) => (e.group ? e.group.map((g) => g.key) : [e.key]))
  );
  const orphanApiKeys = activeApiKeys.filter((k) => !catalogKeys.has(k));
  const orphanKeyEntries: typeof displayKeyEntries = orphanApiKeys.map((k) => ({
    key: k,
    label: k,
    desc: "",
    icon: "🔑",
    keyUrl: "",
  }));
  const allKeyDisplay = [...displayKeyEntries, ...orphanKeyEntries];
  const keyCount = allKeyDisplay.length;

  // ── Routing display data ───────────────────────────
  const bc = config.broadcaster || ({} as AppConfig["broadcaster"]);

  const displayRouteEntries = ROUTING_CATALOG.filter((entry) => isRouteEntryActive(entry));
  const routeCatalogKeys = new Set(
    ROUTING_CATALOG.flatMap((e) => [
      ...e.userFields.map((f) => f.key),
      ...(e.managedFields?.map((f) => f.key) ?? []),
    ])
  );
  const activeBroadcasterKeys = Object.keys(bc).filter(
    (k) => !!bc[k as keyof typeof bc] && k !== "routing_mode"
  );
  const orphanRouteKeys = activeBroadcasterKeys.filter((k) => !routeCatalogKeys.has(k));
  const orphanRouteEntries = orphanRouteKeys.map((k) => ({
    key: k,
    label: k,
    desc: "",
    icon: "🔗",
    color: "#fff",
    connectUrl: "",
    keyUrl: "",
    userFields: [{ key: k, label: k }],
  })) as typeof displayRouteEntries;
  const allRouteDisplay = [...displayRouteEntries, ...orphanRouteEntries];
  const routeCount = allRouteDisplay.length;

  return (
    <div>
      {renderFloatingCard()}

      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-[200] px-4 py-2.5 rounded-xl text-xs font-medium shadow-2xl border ${
            toastMsg.type === "success"
              ? "bg-green-500/15 border-green-500/25 text-green-300"
              : toastMsg.type === "error"
                ? "bg-red-500/15 border-red-500/25 text-red-300"
                : "bg-white/[0.06] border-white/15 text-white/70"
          }`}
        >
          {toastMsg.msg}
        </div>
      )}

      {/* Section toggle */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setSection("keys")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer ${
            section === "keys"
              ? "bg-[color-mix(in_srgb,var(--user-accent,#9146ff)_15%,transparent)] text-[color-mix(in_srgb,var(--user-accent,#9146ff)_100%,white_30%)] border-[color-mix(in_srgb,var(--user-accent,#9146ff)_25%,transparent)] shadow-md shadow-[color-mix(in_srgb,var(--user-accent,#9146ff)_5%,transparent)]"
              : "bg-transparent text-white/40 border-transparent hover:text-white/80 hover:bg-white/[0.04]"
          }`}
        >
          <span className="text-sm">🗝️</span>
          API Keys
          {keyCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/50">
              {keyCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setSection("routing")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer ${
            section === "routing"
              ? "bg-[color-mix(in_srgb,var(--user-accent,#9146ff)_15%,transparent)] text-[color-mix(in_srgb,var(--user-accent,#9146ff)_100%,white_30%)] border-[color-mix(in_srgb,var(--user-accent,#9146ff)_25%,transparent)] shadow-md shadow-[color-mix(in_srgb,var(--user-accent,#9146ff)_5%,transparent)]"
              : "bg-transparent text-white/40 border-transparent hover:text-white/80 hover:bg-white/[0.04]"
          }`}
        >
          <span className="text-sm">♾️</span>
          Routing
          {routeCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/50">
              {routeCount}
            </span>
          )}
        </button>
      </div>

      {/* API Keys section */}
      {section === "keys" && (
        <div className="surface-card rounded-2xl p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold">API Keys</h3>
            <button
              onClick={() => openFloating("keys")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[color-mix(in_srgb,var(--user-accent,#9146ff)_15%,transparent)] text-[color-mix(in_srgb,var(--user-accent,#9146ff)_100%,white_30%)] border border-[color-mix(in_srgb,var(--user-accent,#9146ff)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--user-accent,#9146ff)_25%,transparent)] hover:border-[color-mix(in_srgb,var(--user-accent,#9146ff)_40%,transparent)] transition-all cursor-pointer"
            >
              <span className="text-sm leading-none">+</span>
              Add Key
            </button>
          </div>

          {allKeyDisplay.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-white/20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              <p className="text-sm mb-1">No API keys configured</p>
              <p className="text-[10px] text-white/20">Click "Add Key" to get started</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {allKeyDisplay.map((entry) => {
                const isGroup = "group" in entry && !!(entry as any).group;
                const isEditing = editingKey === entry.key;
                const filledCount = isGroup
                  ? (entry as any).group.filter(
                      (g: { key: string }) => !!apiKeys[g.key as keyof ApiKeys]
                    ).length
                  : apiKeys[entry.key as keyof ApiKeys]
                    ? 1
                    : 0;
                const totalCount = isGroup ? (entry as any).group.length : 1;
                const hasValue = filledCount > 0;
                const allFilled = filledCount === totalCount;
                const subFilled = isGroup
                  ? `${filledCount}/${totalCount} fields filled`
                  : hasValue
                    ? truncate(apiKeys[entry.key as keyof ApiKeys] as string)
                    : "Not configured";

                return (
                  <div
                    key={entry.key}
                    className={`rounded-xl border transition-all duration-200 ${
                      isEditing
                        ? "bg-white/[0.04] border-[color-mix(in_srgb,var(--user-accent,#9146ff)_30%,transparent)]"
                        : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          hasValue ? (allFilled ? "bg-green-400" : "bg-yellow-400") : "bg-white/15"
                        }`}
                      />
                      <span className="text-lg shrink-0 w-7 h-7 rounded-md bg-white/[0.05] flex items-center justify-center">
                        {entry.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-white/80 font-medium block">
                          {entry.label}
                        </span>
                        <span className="text-[10px] text-white/30 block truncate font-mono">
                          {subFilled}
                        </span>
                      </div>

                      <EditRemoveButtons
                        isEditing={isEditing}
                        onToggleEdit={() => setEditingKey(isEditing ? null : entry.key)}
                        onOpenLink={entry.keyUrl ? () => openUrl(entry.keyUrl).catch(() => {}) : undefined}
                        onRemove={() => removeKeyEntry(entry as (typeof KEY_CATALOG)[number])}
                      />
                    </div>

                    {isEditing && (
                      <div className="px-4 pb-3 pt-0">
                        <div className="ml-9 flex flex-col gap-2.5">
                          {isGroup ? (
                            entry.group!.map((g) => (
                              <div key={g.key}>
                                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
                                  {g.label}
                                </label>
                                <input
                                  type="password"
                                  value={apiKeys[g.key as keyof ApiKeys] || ""}
                                  onChange={(e) => setKey(g.key, e.target.value)}
                                  placeholder={`Enter ${g.label}`}
                                  className="input-glass"
                                />
                              </div>
                            ))
                          ) : (
                            <>
                              <label className="block text-[10px] uppercase tracking-wider text-white/40">
                                {entry.label}
                              </label>
                              <input
                                type="password"
                                value={apiKeys[entry.key as keyof ApiKeys] || ""}
                                onChange={(e) => setKey(entry.key, e.target.value)}
                                placeholder={`Enter ${entry.label}`}
                                className="input-glass"
                                autoFocus
                              />
                              <p className="text-[10px] text-white/20">{entry.desc}</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <span className="text-[10px] text-white/25">{keyCount} keys configured</span>
          </div>
        </div>
      )}

      {/* Routing section */}
      {section === "routing" && (
        <div className="surface-card rounded-2xl p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold">Broadcaster Routing</h3>
            <button
              onClick={() => openFloating("routing")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[color-mix(in_srgb,var(--user-accent,#9146ff)_15%,transparent)] text-[color-mix(in_srgb,var(--user-accent,#9146ff)_100%,white_30%)] border border-[color-mix(in_srgb,var(--user-accent,#9146ff)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--user-accent,#9146ff)_25%,transparent)] hover:border-[color-mix(in_srgb,var(--user-accent,#9146ff)_40%,transparent)] transition-all cursor-pointer"
            >
              <span className="text-sm leading-none">+</span>
              Add Integration
            </button>
          </div>

          <div className="flex items-center justify-between py-3 mb-2 border-b border-white/[0.05]">
            <div>
              <span className="text-xs text-white/80 font-medium">Platform Detection</span>
              <p className="text-[10px] text-white/30 mt-0.5">
                Send detected game state to Twitch / Kick. Turn off to keep detection local-only.
              </p>
            </div>
            <Toggle
              on={config.engine_settings.platform_push_enabled}
              onToggle={() => {
                const next = !config.engine_settings.platform_push_enabled;
                setConfig((prev) =>
                  prev
                    ? {
                        ...prev,
                        engine_settings: { ...prev.engine_settings, platform_push_enabled: next },
                      }
                    : prev
                );
                // Off leaves the last-pushed category as-is; on picks up an
                // in-progress session immediately instead of waiting for the
                // next game switch.
                if (next) tauriApi("refresh_platform_push");
              }}
            />
          </div>

          {allRouteDisplay.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-white/20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <p className="text-sm mb-1">No broadcaster channels routed</p>
              <p className="text-[10px] text-white/20">
                Click "Add Integration" to connect Twitch, Kick, or Joystick.tv
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {allRouteDisplay.map((entry) => {
                const isEditing = editingKey === entry.key;
                const requiredFields = entry.userFields.filter((f) => !f.optional);
                const userFilled = requiredFields.filter(
                  (f) => !!bc[f.key as keyof typeof bc]
                ).length;
                const userTotal = requiredFields.length;
                const managedFields =
                  "managedFields" in entry
                    ? ((entry as any).managedFields as { key: string; label: string }[] | undefined)
                    : undefined;
                const hasOauth =
                  managedFields?.some((f: { key: string }) => !!bc[f.key as keyof typeof bc]) ??
                  false;
                const hasValue = userFilled > 0 || hasOauth;
                const allFilled = userFilled === userTotal;
                const subFilled = hasOauth
                  ? "Connected via OAuth"
                  : `${userFilled}/${userTotal} configuration fields filled`;

                return (
                  <div
                    key={entry.key}
                    className={`rounded-xl border transition-all duration-200 ${
                      isEditing
                        ? "bg-white/[0.04] border-[color-mix(in_srgb,var(--user-accent,#9146ff)_30%,transparent)]"
                        : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          hasValue
                            ? allFilled || hasOauth
                              ? "bg-green-400"
                              : "bg-yellow-400"
                            : "bg-white/15"
                        }`}
                      />
                      <span
                        className="text-lg shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: `${entry.color}15`, color: entry.color }}
                      >
                        {entry.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-white/80 font-medium block font-sans">
                          {entry.label}
                        </span>
                        <span className="text-[10px] text-white/30 block truncate font-mono">
                          {subFilled}
                        </span>
                      </div>

                      <EditRemoveButtons
                        isEditing={isEditing}
                        onToggleEdit={() => setEditingKey(isEditing ? null : entry.key)}
                        onOpenLink={entry.keyUrl ? () => openUrl(entry.keyUrl).catch(() => {}) : undefined}
                        onRemove={() =>
                          managedFields && managedFields.length > 0
                            ? disconnectRoute(entry as (typeof ROUTING_CATALOG)[number])
                            : removeRouteEntry(entry as (typeof ROUTING_CATALOG)[number])
                        }
                        removeLabel={
                          managedFields && managedFields.length > 0 ? "Disconnect" : "Remove"
                        }
                      />
                    </div>

                    {isEditing && (
                      <div className="px-4 pb-3 pt-0">
                        <div className="ml-9 flex flex-col gap-3">
                          <div className="flex flex-col gap-2.5">
                            {entry.userFields.map((f) => {
                              return (
                                <div key={f.key}>
                                  <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
                                    {f.label}
                                  </label>
                                  <input
                                    type={f.key.includes("secret") ? "password" : "text"}
                                    value={(bc[f.key as keyof typeof bc] as string) || ""}
                                    onChange={(e) => setField(f.key, e.target.value)}
                                    placeholder={`Enter ${f.label}`}
                                    className="input-glass"
                                  />
                                  {f.hint && (
                                    <p className="text-[10px] text-white/20 mt-1 leading-snug">
                                      {f.hint}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {entry.connectUrl &&
                            (() => {
                              const hasManualToken = !!bc[`${entry.key}_token` as keyof typeof bc];
                              const isValidating = validatingPlatform === entry.key;
                              return (
                                <button
                                  onClick={() => connectOrValidate(entry)}
                                  disabled={isValidating}
                                  className="btn-cta"
                                >
                                  {isValidating
                                    ? "Verifying…"
                                    : hasManualToken
                                      ? `✓ Verify ${entry.label} Token`
                                      : `🔗 Connect ${entry.label}`}
                                </button>
                              );
                            })()}

                          {/* Joystick has no connectUrl popup — its own
                              browser+loopback OAuth command instead. */}
                          {entry.key === "joystick" && !entry.connectUrl && (
                            <button
                              onClick={connectJoystick}
                              disabled={validatingPlatform === "joystick"}
                              className="btn-cta"
                            >
                              {validatingPlatform === "joystick"
                                ? "Connecting…"
                                : `🔗 Connect ${entry.label}`}
                            </button>
                          )}

                          {managedFields && managedFields.length > 0 && (
                            <div className="flex flex-col gap-2.5 mt-1 pt-2.5 border-t border-white/[0.06]">
                              <span className="text-[10px] uppercase tracking-wider text-white/25 font-semibold">
                                Managed (from OAuth)
                              </span>
                              {managedFields.map((f: { key: string; label: string }) => {
                                const val = bc[f.key as keyof typeof bc] as string;
                                return (
                                  <div key={f.key} className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[10px] text-white/40 block">
                                        {f.label}
                                      </span>
                                      <span className="text-[10px] text-white/20 font-mono block truncate">
                                        {val
                                          ? val.length > 12
                                            ? val.slice(0, 6) + "…" + val.slice(-4)
                                            : val
                                          : "—"}
                                      </span>
                                    </div>
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded ${
                                        val
                                          ? "bg-green-500/10 text-green-400/70"
                                          : "bg-white/[0.04] text-white/20"
                                      }`}
                                    >
                                      {val ? "Active" : "Pending"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <span className="text-[10px] text-white/25">{routeCount} integrations configured</span>
          </div>
        </div>
      )}

      {oauthModal && (
        <OAuthConnectModal
          open={!!oauthModal}
          onClose={() => setOauthModal(null)}
          platform={oauthModal.platform}
          connectUrl={oauthModal.url}
          onSuccess={() => {
            loadConfig();
            setOauthModal(null);
            toast(
              oauthModal.platform.charAt(0).toUpperCase() +
                oauthModal.platform.slice(1) +
                " connected!",
              "success"
            );
          }}
        />
      )}
    </div>
  );
}
