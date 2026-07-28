import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { OverlayEntry } from "./types";

const SERVER = "http://127.0.0.1:53735";

export function useOverlays() {
  const [token, setToken] = useState("");
  const [builtin, setBuiltin] = useState<OverlayEntry[]>([]);
  const [custom, setCustom] = useState<OverlayEntry[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [t, b, c] = await Promise.all([
        invoke<string>("get_overlay_token"),
        invoke<OverlayEntry[]>("overlay_list_builtin"),
        invoke<OverlayEntry[]>("overlay_list_custom"),
      ]);
      setToken(t);
      setBuiltin(b);
      setCustom(c);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const builtinUrl = useCallback((file: string) => `${SERVER}/forge-overlay/${encodeURIComponent(token)}/${encodeURIComponent(file)}`, [token]);
  const customUrl = useCallback((file: string) => `${SERVER}/custom-overlay/${encodeURIComponent(token)}/${encodeURIComponent(file)}`, [token]);

  const addCustom = useCallback(async () => {
    const selected = await open({ multiple: false });
    if (!selected || Array.isArray(selected)) return;
    try {
      await invoke("overlay_add_custom", { sourcePath: selected });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [refresh]);

  const removeCustom = useCallback(
    async (file: string) => {
      try {
        await invoke("overlay_remove_custom", { file });
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh]
  );

  const sendTestAlert = useCallback(() => {
    const samples = [
      { platform: "twitch", kind: "follow", user: "TestViewer", message: "just followed!" },
      { platform: "twitch", kind: "sub", user: "TestSub", message: "subscribed (tier 1)!" },
      { platform: "kick", kind: "raid", user: "TestRaider", message: "is raiding with 42 viewers!" },
      { platform: "joystick", kind: "tip", user: "TestTipper", message: "sent a tip!" },
    ];
    const event = { ...samples[Math.floor(Math.random() * samples.length)], id: `test-${Date.now()}`, timestamp: Date.now() };
    invoke("alerts_broadcast_to_overlay", { event }).catch((e) => setError(String(e)));
  }, []);

  return { token, builtin, custom, error, refresh, builtinUrl, customUrl, addCustom, removeCustom, sendTestAlert };
}
