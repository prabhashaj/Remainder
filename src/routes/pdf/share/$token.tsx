/**
 * Public share route — no auth required.
 * Supports two modes:
 *   1. /pdf/share/<token>   — fetches config from Supabase pdf_exports table
 *   2. /pdf/share?data=...  — decodes base64-encoded config from URL (fallback)
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileOutput, Loader2 } from "lucide-react";

import { type PdfConfig, renderTemplate } from "@/components/pdf-templates";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import remiLogo from "@/assets/remi.png";

// ─── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/pdf/share/$token")({
  head: () => ({
    meta: [
      { title: "Shared PDF — Remispace" },
      { name: "description", content: "View and download a beautifully formatted PDF shared via Remispace." },
      { property: "og:title", content: "Shared PDF — Remispace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedPdfPage,
});

// ─── Page ──────────────────────────────────────────────────────────────────────

function SharedPdfPage() {
  const { token } = Route.useParams();
  const [config, setConfig] = useState<PdfConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Mode 1: token-based — fetch from Supabase
        if (token && token !== "fallback") {
          const { data, error: sbErr } = await supabase
            .from("pdf_exports" as never)
            .select("config")
            .eq("token", token)
            .maybeSingle();

          if (sbErr) throw sbErr;
          if (data) {
            setConfig((data as { config: PdfConfig }).config);
            return;
          }
        }

        // Mode 2: URL data param fallback
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get("data");
        if (encoded) {
          const json = decodeURIComponent(escape(atob(encoded)));
          setConfig(JSON.parse(json) as PdfConfig);
          return;
        }

        setError("This share link is invalid or has expired.");
      } catch (e) {
        console.error(e);
        setError("Failed to load the shared PDF. The link may be invalid or expired.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  function handlePrint() {
    const el = document.getElementById("pdf-preview-root");
    if (!el) return;
    const printWindow = window.open("", "_blank", "width=900,height=650");
    if (!printWindow) return;
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Shared PDF</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Georgia&display=swap">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    @page { size: A4; margin: 0; }
    @media print {
      .pdf-watermark { position: fixed !important; bottom: 14px !important; right: 18px !important; opacity: 0.18 !important; }
    }
  </style>
</head>
<body>${el.innerHTML}</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/90 px-5 py-3 backdrop-blur-sm">
        <a href="/" className="flex items-center gap-2">
          <img src={remiLogo} alt="" className="size-7" />
          <span className="font-bold text-sm text-foreground">Remispace</span>
        </a>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Shared document</span>
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={handlePrint}
            disabled={!config}
          >
            <Download className="size-3.5" />
            Download PDF
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-col items-center px-4 py-8">
        {loading && (
          <div className="flex flex-col items-center gap-3 pt-20 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm">Loading shared PDF…</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-4 pt-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <FileOutput className="size-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Link unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">{error}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <a href="/pdf-converter">Create your own PDF →</a>
            </Button>
          </div>
        )}

        {!loading && config && (
          <>
            <p className="mb-4 text-xs text-muted-foreground">
              Created with <span className="font-semibold text-foreground">Remispace PDF Converter</span>
            </p>
            <div
              id="pdf-preview-root"
              className="w-full max-w-[794px] overflow-hidden rounded-xl bg-white shadow-2xl shadow-black/10 ring-1 ring-black/5"
              style={{ minHeight: 1123 }}
            >
              {renderTemplate(config)}
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              <Button onClick={handlePrint} className="gap-2 rounded-xl px-6">
                <Download className="size-4" />
                Download as PDF
              </Button>
              <a href="/pdf-converter" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Create your own beautiful PDF →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
