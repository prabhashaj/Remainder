import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileOutput,
  Link2,
  Loader2,
  Palette,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  DOCUMENT_TEMPLATES,
  RESUME_TEMPLATES,
  type DocumentData,
  type DocumentTemplate,
  type PdfConfig,
  type ResumeData,
  type ResumeTemplate,
  renderTemplate,
} from "@/components/pdf-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

// ─── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/pdf-converter")({
  head: () => ({
    meta: [
      { title: "PDF Converter — Remispace" },
      { name: "description", content: "Convert text into beautiful, shareable PDFs with multiple themes and templates." },
      { property: "og:title", content: "PDF Converter — Remispace" },
    ],
  }),
  component: PdfConverterPage,
});

// ─── Default data ───────────────────────────────────────────────────────────────

const defaultResumeData: ResumeData = {
  name: "",
  title: "",
  email: "",
  phone: "",
  location: "",
  website: "",
  summary: "",
  experience: [],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
};

const defaultDocumentData: DocumentData = {
  title: "",
  subtitle: "",
  author: "",
  date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  sections: [{ heading: "", content: "" }],
};

// ─── Main page ─────────────────────────────────────────────────────────────────

function PdfConverterPage() {
  const [docType, setDocType] = useState<"resume" | "document">("resume");
  const [resumeTemplate, setResumeTemplate] = useState<ResumeTemplate>("modern");
  const [documentTemplate, setDocumentTemplate] = useState<DocumentTemplate>("executive");
  const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);
  const [documentData, setDocumentData] = useState<DocumentData>(defaultDocumentData);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [rawText, setRawText] = useState("");
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<"form" | "raw">("form");
  const previewRef = useRef<HTMLDivElement>(null);

  // Build current PdfConfig
  const config: PdfConfig =
    docType === "resume"
      ? { type: "resume", template: resumeTemplate, data: resumeData }
      : { type: "document", template: documentTemplate, data: documentData };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function handlePrint() {
    const previewEl = previewRef.current;
    if (!previewEl) return;

    const printWindow = window.open("", "_blank", "width=900,height=650");
    if (!printWindow) {
      toast.error("Pop-up blocked. Please allow pop-ups for this site.");
      return;
    }
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${docType === "resume" ? resumeData.name || "Resume" : documentData.title || "Document"}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Georgia&display=swap">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    @page { size: A4; margin: 0; }
    @media print {
      html, body { width: 210mm; }
      .pdf-watermark {
        position: fixed !important;
        bottom: 14px !important;
        right: 18px !important;
        opacity: 0.18 !important;
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
      }
    }
  </style>
</head>
<body>${previewEl.innerHTML}</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 600);
  }

  async function handleShare() {
    setSharing(true);
    try {
      const { data, error } = await supabase
        .from("pdf_exports" as never)
        .insert({ config: config as never, template: config.template })
        .select("token")
        .single();

      if (error) throw error;
      const token = (data as { token: string }).token;
      const link = `${window.location.origin}/pdf/share/${token}`;
      setShareLink(link);
      setShareOpen(true);
    } catch {
      // Fallback: encode config in URL
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
      const link = `${window.location.origin}/pdf/share?data=${encoded}`;
      setShareLink(link);
      setShareOpen(true);
    } finally {
      setSharing(false);
    }
  }

  function copyLink() {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success("Link copied to clipboard!");
    }
  }

  // ── AI enhance ───────────────────────────────────────────────────────────────

  async function enhanceWithAI() {
    if (!rawText.trim()) {
      toast.error("Please paste some text first.");
      return;
    }
    setAiEnhancing(true);
    try {
      const systemPrompt =
        docType === "resume"
          ? `You are a professional resume writer. Parse the following raw text and return a valid JSON object matching this TypeScript type:
{
  name: string; title: string; email: string; phone: string; location: string; website: string;
  summary: string;
  experience: Array<{ company: string; role: string; duration: string; bullets: string[] }>;
  education: Array<{ institution: string; degree: string; year: string; notes?: string }>;
  skills: string[];
  certifications?: string[];
}
Infer and beautify wherever possible. Return ONLY valid JSON, no markdown.`
          : `You are a professional document writer. Parse the following raw text and return a valid JSON object matching this TypeScript type:
{
  title: string; subtitle?: string; author?: string; date?: string;
  sections: Array<{ heading: string; content: string }>;
}
Organize into logical sections. Return ONLY valid JSON, no markdown.`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: rawText },
          ],
          threadId: "pdf-enhance",
        }),
      });

      if (!res.ok) throw new Error("AI request failed");

      // Collect streaming text
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
      }

      // Try to extract JSON from the stream
      const jsonMatch = full.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response");
      const parsed = JSON.parse(jsonMatch[0]);

      if (docType === "resume") {
        setResumeData({ ...defaultResumeData, ...parsed });
        toast.success("Resume enhanced by AI! ✨");
      } else {
        setDocumentData({ ...defaultDocumentData, ...parsed });
        toast.success("Document structured by AI! ✨");
      }
      setActiveInputTab("form");
    } catch (err) {
      console.error(err);
      toast.error("AI enhancement failed. Please try filling the form manually.");
    } finally {
      setAiEnhancing(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10">
            <FileOutput className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">PDF Converter</h1>
            <p className="text-[11px] text-muted-foreground">Beautiful resumes & documents, shareable in seconds</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={handleShare}
            disabled={sharing}
          >
            {sharing ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
            Share
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs bg-primary"
            onClick={handlePrint}
          >
            <Download className="size-3.5" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel: controls ─────────────────────────────────────────── */}
        <div className="flex w-[400px] shrink-0 flex-col overflow-y-auto border-r border-border/60 bg-muted/20">
          {/* Doc type tabs */}
          <div className="border-b border-border/60 p-4">
            <Tabs value={docType} onValueChange={(v) => setDocType(v as "resume" | "document")}>
              <TabsList className="grid w-full grid-cols-2 rounded-xl h-9">
                <TabsTrigger value="resume" className="rounded-lg text-xs font-medium">Resume / CV</TabsTrigger>
                <TabsTrigger value="document" className="rounded-lg text-xs font-medium">Document</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Template picker */}
          <div className="border-b border-border/60 p-4">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Palette className="size-3.5" />
              TEMPLATE
            </div>
            <div className="flex flex-wrap gap-2">
              {(docType === "resume" ? RESUME_TEMPLATES : DOCUMENT_TEMPLATES).map((t) => {
                const isActive =
                  docType === "resume" ? resumeTemplate === t.id : documentTemplate === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (docType === "resume") setResumeTemplate(t.id as ResumeTemplate);
                      else setDocumentTemplate(t.id as DocumentTemplate);
                    }}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: t.accent }}
                    />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input tabs: Form vs Raw */}
          <div className="flex-1 p-4">
            <Tabs value={activeInputTab} onValueChange={(v) => setActiveInputTab(v as "form" | "raw")}>
              <TabsList className="mb-4 h-8 w-full rounded-xl grid grid-cols-2">
                <TabsTrigger value="form" className="rounded-lg text-xs">Form</TabsTrigger>
                <TabsTrigger value="raw" className="rounded-lg text-xs">Raw Text + AI</TabsTrigger>
              </TabsList>

              {/* ── FORM tab ── */}
              <TabsContent value="form" className="mt-0 space-y-0">
                {docType === "resume" ? (
                  <ResumeForm data={resumeData} onChange={setResumeData} />
                ) : (
                  <DocumentForm data={documentData} onChange={setDocumentData} />
                )}
              </TabsContent>

              {/* ── RAW TEXT tab ── */}
              <TabsContent value="raw" className="mt-0">
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Paste any raw text — a LinkedIn profile, a bio, a rough draft — and let AI structure it into the perfect {docType}.
                  </p>
                  <Textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={
                      docType === "resume"
                        ? "Paste your LinkedIn bio, old resume, or any profile text here..."
                        : "Paste your raw document content here..."
                    }
                    className="min-h-[220px] resize-none rounded-xl text-sm font-mono"
                  />
                  <Button
                    onClick={enhanceWithAI}
                    disabled={aiEnhancing || !rawText.trim()}
                    className="w-full gap-2 rounded-xl"
                    size="sm"
                  >
                    {aiEnhancing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    {aiEnhancing ? "Enhancing with AI..." : "Enhance with AI ✨"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* ── Right panel: live preview ─────────────────────────────────────── */}
        <div className="flex flex-1 flex-col items-center overflow-auto bg-muted/30 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="secondary" className="rounded-lg text-[10px]">Live Preview</Badge>
            <span className="text-[11px] text-muted-foreground">A4 · {docType === "resume" ? "Resume" : "Document"}</span>
          </div>

          {/* A4 paper preview */}
          <div
            className="relative w-full max-w-[794px] origin-top overflow-hidden rounded-xl bg-white shadow-2xl shadow-black/10 ring-1 ring-black/5"
            style={{ minHeight: 1123 }}
          >
            <div ref={previewRef} className="w-full" style={{ minHeight: 1123 }}>
              {renderTemplate(config)}
            </div>
          </div>
        </div>
      </div>

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4 text-primary" />
              Share your PDF
            </DialogTitle>
            <DialogDescription>
              Anyone with this link can view and download the PDF — no login required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareLink ?? ""}
                className="rounded-xl font-mono text-xs"
              />
              <Button onClick={copyLink} size="sm" className="shrink-0 rounded-xl gap-1.5">
                <Link2 className="size-3.5" />
                Copy
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 The link captures your current template and content exactly as shown in the preview.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Resume form ────────────────────────────────────────────────────────────────

function ResumeForm({ data, onChange }: { data: ResumeData; onChange: (d: ResumeData) => void }) {
  const set = <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => onChange({ ...data, [k]: v });

  function addExp() {
    set("experience", [
      ...data.experience,
      { company: "", role: "", duration: "", bullets: [""] },
    ]);
  }

  function removeExp(i: number) {
    set("experience", data.experience.filter((_, idx) => idx !== i));
  }

  function setExp(i: number, patch: Partial<(typeof data.experience)[number]>) {
    const updated = [...data.experience];
    updated[i] = { ...updated[i], ...patch };
    set("experience", updated);
  }

  function addEdu() {
    set("education", [...data.education, { institution: "", degree: "", year: "", notes: "" }]);
  }

  function removeEdu(i: number) {
    set("education", data.education.filter((_, idx) => idx !== i));
  }

  function setEdu(i: number, patch: Partial<(typeof data.education)[number]>) {
    const updated = [...data.education];
    updated[i] = { ...updated[i], ...patch };
    set("education", updated);
  }

  return (
    <div className="space-y-5">
      {/* Personal info */}
      <FormSection title="Personal Info">
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Full Name">
            <Input placeholder="Jane Doe" value={data.name} onChange={(e) => set("name", e.target.value)} className="h-8 rounded-lg text-xs" />
          </FormField>
          <FormField label="Job Title">
            <Input placeholder="Software Engineer" value={data.title} onChange={(e) => set("title", e.target.value)} className="h-8 rounded-lg text-xs" />
          </FormField>
          <FormField label="Email">
            <Input placeholder="jane@example.com" value={data.email} onChange={(e) => set("email", e.target.value)} className="h-8 rounded-lg text-xs" />
          </FormField>
          <FormField label="Phone">
            <Input placeholder="+1 555 0100" value={data.phone} onChange={(e) => set("phone", e.target.value)} className="h-8 rounded-lg text-xs" />
          </FormField>
          <FormField label="Location">
            <Input placeholder="New York, NY" value={data.location} onChange={(e) => set("location", e.target.value)} className="h-8 rounded-lg text-xs" />
          </FormField>
          <FormField label="Website">
            <Input placeholder="linkedin.com/in/jane" value={data.website} onChange={(e) => set("website", e.target.value)} className="h-8 rounded-lg text-xs" />
          </FormField>
        </div>
        <FormField label="Summary">
          <Textarea
            placeholder="A brief professional summary..."
            value={data.summary}
            onChange={(e) => set("summary", e.target.value)}
            className="min-h-[70px] resize-none rounded-lg text-xs"
          />
        </FormField>
      </FormSection>

      {/* Experience */}
      <FormSection title="Experience" action={<button onClick={addExp} className="flex items-center gap-1 text-[11px] text-primary hover:underline"><Plus className="size-3" />Add</button>}>
        {data.experience.map((exp, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">#{i + 1}</span>
              <button onClick={() => removeExp(i)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Company" value={exp.company} onChange={(e) => setExp(i, { company: e.target.value })} className="h-7 rounded-lg text-xs" />
              <Input placeholder="Role" value={exp.role} onChange={(e) => setExp(i, { role: e.target.value })} className="h-7 rounded-lg text-xs" />
              <Input placeholder="Duration e.g. Jan 2022 – Present" value={exp.duration} onChange={(e) => setExp(i, { duration: e.target.value })} className="col-span-2 h-7 rounded-lg text-xs" />
            </div>
            <Textarea
              placeholder="• Built... • Led... (one bullet per line)"
              value={exp.bullets.join("\n")}
              onChange={(e) => setExp(i, { bullets: e.target.value.split("\n") })}
              className="min-h-[60px] resize-none rounded-lg text-xs"
            />
          </div>
        ))}
        {data.experience.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No experience added yet.</p>
        )}
      </FormSection>

      {/* Education */}
      <FormSection title="Education" action={<button onClick={addEdu} className="flex items-center gap-1 text-[11px] text-primary hover:underline"><Plus className="size-3" />Add</button>}>
        {data.education.map((edu, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">#{i + 1}</span>
              <button onClick={() => removeEdu(i)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Institution" value={edu.institution} onChange={(e) => setEdu(i, { institution: e.target.value })} className="h-7 rounded-lg text-xs" />
              <Input placeholder="Year" value={edu.year} onChange={(e) => setEdu(i, { year: e.target.value })} className="h-7 rounded-lg text-xs" />
              <Input placeholder="Degree" value={edu.degree} onChange={(e) => setEdu(i, { degree: e.target.value })} className="col-span-2 h-7 rounded-lg text-xs" />
            </div>
          </div>
        ))}
        {data.education.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No education added yet.</p>
        )}
      </FormSection>

      {/* Skills */}
      <FormSection title="Skills">
        <Textarea
          placeholder="React, TypeScript, Node.js, Python, ..."
          value={data.skills.join(", ")}
          onChange={(e) =>
            set(
              "skills",
              e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            )
          }
          className="min-h-[60px] resize-none rounded-lg text-xs"
        />
        <p className="text-[10px] text-muted-foreground">Separate with commas</p>
      </FormSection>

      {/* Certifications */}
      <FormSection title="Certifications (optional)">
        <Textarea
          placeholder="AWS Certified Solutions Architect&#10;Google Cloud Professional..."
          value={(data.certifications ?? []).join("\n")}
          onChange={(e) => set("certifications", e.target.value.split("\n").filter(Boolean))}
          className="min-h-[60px] resize-none rounded-lg text-xs"
        />
        <p className="text-[10px] text-muted-foreground">One per line</p>
      </FormSection>

      {/* Reset */}
      <button
        onClick={() => onChange(defaultResumeData)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
      >
        <RotateCcw className="size-3" />
        Reset all fields
      </button>
    </div>
  );
}

// ─── Document form ──────────────────────────────────────────────────────────────

function DocumentForm({ data, onChange }: { data: DocumentData; onChange: (d: DocumentData) => void }) {
  const set = <K extends keyof DocumentData>(k: K, v: DocumentData[K]) => onChange({ ...data, [k]: v });

  function addSection() {
    set("sections", [...data.sections, { heading: "", content: "" }]);
  }

  function removeSection(i: number) {
    set("sections", data.sections.filter((_, idx) => idx !== i));
  }

  function setSection(i: number, patch: Partial<{ heading: string; content: string }>) {
    const updated = [...data.sections];
    updated[i] = { ...updated[i], ...patch };
    set("sections", updated);
  }

  return (
    <div className="space-y-5">
      <FormSection title="Document Info">
        <FormField label="Title">
          <Input placeholder="Annual Report 2025" value={data.title} onChange={(e) => set("title", e.target.value)} className="h-8 rounded-lg text-xs" />
        </FormField>
        <FormField label="Subtitle (optional)">
          <Input placeholder="Q4 Summary" value={data.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} className="h-8 rounded-lg text-xs" />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Author">
            <Input placeholder="Jane Doe" value={data.author ?? ""} onChange={(e) => set("author", e.target.value)} className="h-8 rounded-lg text-xs" />
          </FormField>
          <FormField label="Date">
            <Input value={data.date ?? ""} onChange={(e) => set("date", e.target.value)} className="h-8 rounded-lg text-xs" />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Sections"
        action={
          <button onClick={addSection} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
            <Plus className="size-3" />Add Section
          </button>
        }
      >
        {data.sections.map((sec, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">Section {i + 1}</span>
              {data.sections.length > 1 && (
                <button onClick={() => removeSection(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Input
              placeholder="Section heading"
              value={sec.heading}
              onChange={(e) => setSection(i, { heading: e.target.value })}
              className="h-7 rounded-lg text-xs font-medium"
            />
            <Textarea
              placeholder="Section content..."
              value={sec.content}
              onChange={(e) => setSection(i, { content: e.target.value })}
              className="min-h-[80px] resize-none rounded-lg text-xs"
            />
          </div>
        ))}
      </FormSection>

      <button
        onClick={() => onChange(defaultDocumentData)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
      >
        <RotateCcw className="size-3" />
        Reset all fields
      </button>
    </div>
  );
}

// ─── UI primitives ──────────────────────────────────────────────────────────────

function FormSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
