// ─── Mock data provider ───────────────────────────────────────────────────────
// Replaces Tauri engine calls with realistic dummy data for dev/preview mode.

import { useState, useEffect, useCallback } from "react";
import type { EngineStatus, ForgeLibraryEntry } from "../types";

export function useMockEngine(): {
  status: EngineStatus;
  wsConnected: boolean;
  startEngine: () => void;
  stopEngine: () => void;
  toast: (msg: string) => void;
} {
  const [running, setRunning] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    if (running) {
      const t = setTimeout(() => setWsConnected(true), 800);
      return () => clearTimeout(t);
    }
    setWsConnected(false);
  }, [running]);

  const status: EngineStatus = {
    running,
    game_title: running ? "Hollow Knight" : "",
    process_name: running ? "hollow_knight.exe" : "",
    is_playing: running,
    genre: running ? "METROIDVANIA" : "",
    developer: running ? "Team Cherry" : "",
    publisher: running ? "Team Cherry" : "",
    release_date: running ? "2017" : "",
    cover_url: running
      ? "https://shared.steamstatic.com/store_item_assets/steam/apps/367520/library_600x900.jpg"
      : "",
    widgetToken: running ? "kN2x9mYpQ7vB3wR8" : "",
  };

  const startEngine = useCallback(() => setRunning(true), []);
  const stopEngine = useCallback(() => setRunning(false), []);
  const toast = useCallback((msg: string) => console.log("[StatusForge]", msg), []);

  return { status, wsConnected, startEngine, stopEngine, toast };
}

const DUMMY_LIBRARY: ForgeLibraryEntry[] = [
  {
    title: "Celeste", genre: "PLATFORMER", release_year: "2018",
    developer: "Maddy Makes Games", publisher: "Maddy Makes Games",
    cover_url: "https://shared.steamstatic.com/store_item_assets/steam/apps/504230/library_600x900.jpg",
    steam_id: "504230", igdb_id: "12345", rawg_id: "58175", twitch_id: "493997", kick_id: "12345",
    discord_app_id: "", gog_id: "", itch_id: "", sgdb_id: "", xbox_title_id: "", epic_id: "",
  },
  {
    title: "Hollow Knight", genre: "METROIDVANIA", release_year: "2017",
    developer: "Team Cherry", publisher: "Team Cherry",
    cover_url: "https://shared.steamstatic.com/store_item_assets/steam/apps/367520/library_600x900.jpg",
    steam_id: "367520", igdb_id: "19516", rawg_id: "3272", twitch_id: "493096", kick_id: "",
    discord_app_id: "", gog_id: "", itch_id: "", sgdb_id: "", xbox_title_id: "", epic_id: "",
  },
  {
    title: "Hades", genre: "ROGUE-LIKE", release_year: "2020",
    developer: "Supergiant Games", publisher: "Supergiant Games",
    cover_url: "https://shared.steamstatic.com/store_item_assets/steam/apps/1145360/library_600x900.jpg",
    steam_id: "1145360", igdb_id: "12350", rawg_id: "562634", twitch_id: "512980", kick_id: "",
    discord_app_id: "", gog_id: "", itch_id: "", sgdb_id: "", xbox_title_id: "", epic_id: "",
  },
  {
    title: "Vampire Survivors", genre: "SHOOT 'EM UP", release_year: "2022",
    developer: "Poncle", publisher: "Poncle",
    cover_url: "",
    steam_id: "1794680", igdb_id: "", rawg_id: "768205", twitch_id: "", kick_id: "",
    discord_app_id: "", gog_id: "", itch_id: "", sgdb_id: "", xbox_title_id: "", epic_id: "",
  },
];

export function useMockLibrary() {
  const [library, setLibrary] = useState<ForgeLibraryEntry[]>(DUMMY_LIBRARY);
  const [exiled] = useState<{ process: string }[]>([
    { process: "chrome.exe" },
    { process: "notepad.exe" },
  ]);
  return { library, exiled, reload: () => setLibrary([...DUMMY_LIBRARY]) };
}
