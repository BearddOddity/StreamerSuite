import { useOverlays } from "./useOverlays";
import "../../design-system/styles.css";
import { Button, Card, SectionHead, Badge } from "../../design-system/components/core";

function OverlayPreview({ url }: { url: string }) {
  return (
    <div className="w-24 h-14 shrink-0 rounded-lg overflow-hidden border border-white/[0.06] bg-[repeating-conic-gradient(#111_0%_25%,#0a0a0a_0%_50%)] bg-[length:12px_12px]">
      <iframe title={url} src={url} className="w-[400%] h-[400%] scale-[0.25] origin-top-left pointer-events-none" />
    </div>
  );
}

export default function OverlayLibraryApp() {
  const { builtin, custom, error, copied, builtinUrl, customUrl, copyUrl, addCustom, removeCustom, sendTestAlert } = useOverlays();

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <SectionHead
            icon="🖼️"
            title="Overlay Library"
            desc="Copy a URL below and paste it into an OBS/Meld Browser Source"
          />
        </div>

        {error && (
          <Card padding={12} className="mb-4">
            <p className="text-[11px]" style={{ color: "var(--bd-red-text)" }}>
              {error}
            </p>
          </Card>
        )}

        <Card padding={20} className="mb-4">
          <h3 className="text-[13px] font-semibold text-white/80 mb-3">Built-in</h3>
          {builtin.length === 0 ? (
            <p className="text-[11px] text-white/25">No built-in overlays found.</p>
          ) : (
            <div className="space-y-2">
              {builtin.map((o) => (
                <div key={o.file} className="flex items-center gap-3 bg-white/[0.02] rounded-xl px-3 py-2">
                  <OverlayPreview url={builtinUrl(o.file)} />
                  <span className="text-[12px] text-white/70 flex-1 capitalize">{o.name}</span>
                  {o.file === "alerts-overlay.html" && (
                    <Button variant="ghost" size="sm" onClick={sendTestAlert}>
                      Send Test Alert
                    </Button>
                  )}
                  <Button variant={copied === o.file ? "success" : "primary"} size="sm" onClick={() => copyUrl(builtinUrl(o.file), o.file)}>
                    {copied === o.file ? "Copied ✓" : "Copy URL"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding={20}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-white/80">Custom</h3>
            <Button variant="ghost" size="sm" onClick={addCustom}>
              + Add Overlay
            </Button>
          </div>
          {custom.length === 0 ? (
            <p className="text-[11px] text-white/25">
              Add your own HTML/image/text file, or build one with the editor app (🧩).
            </p>
          ) : (
            <div className="space-y-2">
              {custom.map((o) => (
                <div key={o.file} className="flex items-center gap-3 bg-white/[0.02] rounded-xl px-3 py-2">
                  <OverlayPreview url={customUrl(o.file)} />
                  <span className="text-[12px] text-white/70 flex-1 capitalize">{o.name}</span>
                  {o.editable && (
                    <Badge variant="purple">{o.kind === "canvas" ? "Canvas" : "Widget"} — edit in the editor app</Badge>
                  )}
                  <Button variant={copied === o.file ? "success" : "primary"} size="sm" onClick={() => copyUrl(customUrl(o.file), o.file)}>
                    {copied === o.file ? "Copied ✓" : "Copy URL"}
                  </Button>
                  <button onClick={() => removeCustom(o.file)} className="text-[11px] text-white/25 hover:text-red-400 px-2">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
