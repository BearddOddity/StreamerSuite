import type { SceneSwitcherSettings } from "./types";
import { Button, Card, Chip } from "../../design-system/components/core";

export function SettingsPanel({
  settings,
  onUpdate,
  onClose,
}: {
  settings: SceneSwitcherSettings;
  onUpdate: (patch: Partial<SceneSwitcherSettings>) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <Card padding={24} className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-white/90">Scene Switcher Settings</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        <section className="mb-5">
          <span className="text-[12px] font-semibold text-white/70 block mb-2">Platform</span>
          <div className="flex gap-2">
            <Chip selected={settings.platform === "meld"} onClick={() => onUpdate({ platform: "meld" })}>
              Meld Studio
            </Chip>
            <Chip selected={settings.platform === "obs"} onClick={() => onUpdate({ platform: "obs" })}>
              OBS Studio
            </Chip>
          </div>
        </section>

        {settings.platform === "obs" && (
          <section className="mb-2">
            <span className="text-[12px] font-semibold text-white/70 block mb-2">OBS WebSocket Connection</span>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="col-span-2">
                <label className="text-[10px] text-white/40 block mb-1">Host</label>
                <input
                  value={settings.obsHost}
                  onChange={(e) => onUpdate({ obsHost: e.target.value })}
                  placeholder="127.0.0.1"
                  className="w-full input-glass text-[12px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Port</label>
                <input
                  type="number"
                  value={settings.obsPort}
                  onChange={(e) => onUpdate({ obsPort: Number(e.target.value) || 0 })}
                  placeholder="4455"
                  className="w-full input-glass text-[12px]"
                />
              </div>
            </div>
            <label className="text-[10px] text-white/40 block mb-1">Password (optional)</label>
            <input
              type="password"
              value={settings.obsPassword}
              onChange={(e) => onUpdate({ obsPassword: e.target.value })}
              placeholder="leave blank if the WebSocket server has no password"
              className="w-full input-glass text-[12px]"
            />
            <p className="text-[10px] text-white/30 mt-2 leading-relaxed">
              Enable OBS's WebSocket server via Tools → WebSocket Server Settings — the default port is 4455, and a password is
              optional.
            </p>
          </section>
        )}
      </Card>
    </div>
  );
}
