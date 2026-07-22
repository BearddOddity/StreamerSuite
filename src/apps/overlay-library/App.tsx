import { useOverlays } from "./useOverlays";

export default function OverlayLibraryApp() {
  const { builtin, custom, error, copied, builtinUrl, customUrl, copyUrl, addCustom, removeCustom, sendTestAlert } = useOverlays();

  return (
    <div className="h-full flex flex-col p-6 bg-[#050505] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-[18px] font-bold text-white/90">Overlay Library</h2>
          <p className="text-[11px] text-white/30 mt-0.5">
            Copy a URL below and paste it into an OBS/Meld Browser Source
          </p>
        </div>

        {error && (
          <div className="surface-glass p-3 mb-4">
            <p className="text-[11px] text-red-400/70">{error}</p>
          </div>
        )}

        <section className="card-glass p-5 mb-4">
          <h3 className="text-[13px] font-semibold text-white/80 mb-3">Built-in</h3>
          {builtin.length === 0 ? (
            <p className="text-[11px] text-white/25">No built-in overlays found.</p>
          ) : (
            <div className="space-y-2">
              {builtin.map((o) => (
                <div key={o.file} className="flex items-center gap-2 bg-white/[0.02] rounded-xl px-3 py-2">
                  <span className="text-[12px] text-white/70 flex-1 capitalize">{o.name}</span>
                  {o.file === "alerts-overlay.html" && (
                    <button onClick={sendTestAlert} className="text-[10px] text-amber-300/80 hover:text-amber-200 px-2 py-1 rounded-lg border border-amber-500/20">
                      Send Test Alert
                    </button>
                  )}
                  <button
                    onClick={() => copyUrl(builtinUrl(o.file), o.file)}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/25 hover:bg-purple-500/25 transition-all"
                  >
                    {copied === o.file ? "Copied ✓" : "Copy URL"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card-glass p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-white/80">Custom</h3>
            <button onClick={addCustom} className="text-[11px] px-3 py-1.5 rounded-lg btn-ghost">
              + Add Overlay
            </button>
          </div>
          {custom.length === 0 ? (
            <p className="text-[11px] text-white/25">
              Add your own HTML, image, or text file to serve it as a browser-source overlay.
            </p>
          ) : (
            <div className="space-y-2">
              {custom.map((o) => (
                <div key={o.file} className="flex items-center gap-2 bg-white/[0.02] rounded-xl px-3 py-2">
                  <span className="text-[12px] text-white/70 flex-1 capitalize">{o.name}</span>
                  <button
                    onClick={() => copyUrl(customUrl(o.file), o.file)}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-green-500/15 text-green-300 border border-green-500/25 hover:bg-green-500/25 transition-all"
                  >
                    {copied === o.file ? "Copied ✓" : "Copy URL"}
                  </button>
                  <button onClick={() => removeCustom(o.file)} className="text-[11px] text-white/25 hover:text-red-400 px-2">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
