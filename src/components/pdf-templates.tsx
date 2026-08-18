/**
 * pdf-templates.tsx
 *
 * All themed HTML templates rendered inside the PDF converter preview.
 * The Remispace watermark is always present (bottom-right, print-safe).
 */

import remiLogo from "@/assets/remi.png";

// ─── Shared types ──────────────────────────────────────────────────────────────

export type DocumentType = "resume" | "document";

export type ResumeTemplate = "modern" | "classic" | "minimal" | "bold" | "elegant";
export type DocumentTemplate = "executive" | "academic" | "report" | "newsletter";

export type TemplateId = ResumeTemplate | DocumentTemplate;

export interface ResumeData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  languages?: string[];
  certifications?: string[];
}

export interface ExperienceItem {
  company: string;
  role: string;
  duration: string;
  bullets: string[];
}

export interface EducationItem {
  institution: string;
  degree: string;
  year: string;
  notes?: string;
}

export interface DocumentData {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  sections: DocumentSection[];
}

export interface DocumentSection {
  heading: string;
  content: string;
}

export type PdfConfig =
  | { type: "resume"; template: ResumeTemplate; data: ResumeData }
  | { type: "document"; template: DocumentTemplate; data: DocumentData };

// ─── Template metadata ─────────────────────────────────────────────────────────

export const RESUME_TEMPLATES: { id: ResumeTemplate; label: string; accent: string }[] = [
  { id: "modern", label: "Modern", accent: "#6366f1" },
  { id: "classic", label: "Classic", accent: "#1e3a5f" },
  { id: "minimal", label: "Minimal", accent: "#374151" },
  { id: "bold", label: "Bold", accent: "#dc2626" },
  { id: "elegant", label: "Elegant", accent: "#7c3aed" },
];

export const DOCUMENT_TEMPLATES: { id: DocumentTemplate; label: string; accent: string }[] = [
  { id: "executive", label: "Executive", accent: "#0f172a" },
  { id: "academic", label: "Academic", accent: "#1d4ed8" },
  { id: "report", label: "Report", accent: "#065f46" },
  { id: "newsletter", label: "Newsletter", accent: "#9333ea" },
];

// ─── Watermark (always injected) ───────────────────────────────────────────────

function Watermark() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "14px",
        right: "18px",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        opacity: 0.18,
        pointerEvents: "none",
        zIndex: 9999,
        userSelect: "none",
      }}
      className="pdf-watermark"
    >
      <img src={remiLogo} alt="" style={{ width: 18, height: 18 }} />
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "#000",
        }}
      >
        Remispace
      </span>
    </div>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────────

const base: React.CSSProperties = {
  fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
  fontSize: "12px",
  lineHeight: 1.55,
  color: "#111",
  background: "#fff",
  padding: "48px 52px",
  minHeight: "100%",
  position: "relative",
  boxSizing: "border-box",
};

// ─── RESUME TEMPLATES ──────────────────────────────────────────────────────────

export function ResumeModernTemplate({ data }: { data: ResumeData }) {
  const accent = "#6366f1";
  return (
    <div style={base}>
      {/* Header */}
      <div style={{ borderBottom: `3px solid ${accent}`, paddingBottom: 20, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>
          {data.name || "Your Name"}
        </h1>
        {data.title && (
          <p style={{ margin: "4px 0 0", fontSize: 14, color: accent, fontWeight: 600 }}>{data.title}</p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: 10, fontSize: 11, color: "#555" }}>
          {data.email && <span>✉ {data.email}</span>}
          {data.phone && <span>📞 {data.phone}</span>}
          {data.location && <span>📍 {data.location}</span>}
          {data.website && <span>🌐 {data.website}</span>}
        </div>
      </div>

      {data.summary && (
        <Section title="Profile" accent={accent}>
          <p style={{ margin: 0, color: "#444" }}>{data.summary}</p>
        </Section>
      )}

      {data.experience?.length > 0 && (
        <Section title="Experience" accent={accent}>
          {data.experience.map((exp, i) => (
            <ExpBlock key={i} exp={exp} accent={accent} />
          ))}
        </Section>
      )}

      {data.education?.length > 0 && (
        <Section title="Education" accent={accent}>
          {data.education.map((edu, i) => (
            <EduBlock key={i} edu={edu} />
          ))}
        </Section>
      )}

      {data.skills?.length > 0 && (
        <Section title="Skills" accent={accent}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.skills.map((s, i) => (
              <span
                key={i}
                style={{
                  background: `${accent}18`,
                  color: accent,
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {data.certifications?.length > 0 && (
        <Section title="Certifications" accent={accent}>
          {data.certifications.map((c, i) => (
            <p key={i} style={{ margin: "0 0 4px" }}>• {c}</p>
          ))}
        </Section>
      )}
      <Watermark />
    </div>
  );
}

export function ResumeClassicTemplate({ data }: { data: ResumeData }) {
  const accent = "#1e3a5f";
  return (
    <div style={{ ...base, fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: `2px solid ${accent}`, paddingBottom: 16, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: accent, letterSpacing: "2px", textTransform: "uppercase" }}>
          {data.name || "Your Name"}
        </h1>
        {data.title && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", fontStyle: "italic" }}>{data.title}</p>}
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "12px", marginTop: 8, fontSize: 11, color: "#555" }}>
          {data.email && <span>{data.email}</span>}
          {data.phone && <span>|  {data.phone}</span>}
          {data.location && <span>|  {data.location}</span>}
          {data.website && <span>|  {data.website}</span>}
        </div>
      </div>

      {data.summary && (
        <ClassicSection title="Objective" accent={accent}>
          <p style={{ margin: 0, color: "#333", fontStyle: "italic" }}>{data.summary}</p>
        </ClassicSection>
      )}

      {data.experience?.length > 0 && (
        <ClassicSection title="Professional Experience" accent={accent}>
          {data.experience.map((exp, i) => (
            <ExpBlock key={i} exp={exp} accent={accent} />
          ))}
        </ClassicSection>
      )}

      {data.education?.length > 0 && (
        <ClassicSection title="Education" accent={accent}>
          {data.education.map((edu, i) => (
            <EduBlock key={i} edu={edu} />
          ))}
        </ClassicSection>
      )}

      {data.skills?.length > 0 && (
        <ClassicSection title="Skills" accent={accent}>
          <p style={{ margin: 0 }}>{data.skills.join(" · ")}</p>
        </ClassicSection>
      )}
      <Watermark />
    </div>
  );
}

export function ResumeMinimalTemplate({ data }: { data: ResumeData }) {
  const accent = "#374151";
  return (
    <div style={{ ...base, padding: "44px 64px" }}>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 300, letterSpacing: "-1px", color: "#111" }}>
        {data.name || "Your Name"}
      </h1>
      {data.title && <p style={{ margin: "2px 0 0", fontSize: 13, color: "#888", letterSpacing: "0.5px" }}>{data.title}</p>}
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#aaa" }}>
        {data.email && <span>{data.email}</span>}
        {data.phone && <span>{data.phone}</span>}
        {data.location && <span>{data.location}</span>}
        {data.website && <span>{data.website}</span>}
      </div>

      <div style={{ borderTop: "1px solid #e5e7eb", margin: "20px 0" }} />

      {data.summary && (
        <MinSection title="About">
          <p style={{ margin: 0, color: "#555", maxWidth: 520 }}>{data.summary}</p>
        </MinSection>
      )}
      {data.experience?.length > 0 && (
        <MinSection title="Experience">
          {data.experience.map((exp, i) => <ExpBlock key={i} exp={exp} accent={accent} />)}
        </MinSection>
      )}
      {data.education?.length > 0 && (
        <MinSection title="Education">
          {data.education.map((edu, i) => <EduBlock key={i} edu={edu} />)}
        </MinSection>
      )}
      {data.skills?.length > 0 && (
        <MinSection title="Skills">
          <p style={{ margin: 0, color: "#555" }}>{data.skills.join(", ")}</p>
        </MinSection>
      )}
      <Watermark />
    </div>
  );
}

export function ResumeBoldTemplate({ data }: { data: ResumeData }) {
  const accent = "#dc2626";
  return (
    <div style={{ ...base, padding: 0 }}>
      {/* Bold sidebar header */}
      <div style={{ background: "#111", color: "#fff", padding: "36px 52px 28px" }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: "-0.5px" }}>
          {data.name || "Your Name"}
        </h1>
        {data.title && (
          <p style={{ margin: "4px 0 0", fontSize: 14, color: accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
            {data.title}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, fontSize: 11, color: "#bbb" }}>
          {data.email && <span>✉ {data.email}</span>}
          {data.phone && <span>📞 {data.phone}</span>}
          {data.location && <span>📍 {data.location}</span>}
          {data.website && <span>🌐 {data.website}</span>}
        </div>
      </div>

      <div style={{ padding: "32px 52px" }}>
        {data.summary && (
          <BoldSection title="Profile" accent={accent}>
            <p style={{ margin: 0 }}>{data.summary}</p>
          </BoldSection>
        )}
        {data.experience?.length > 0 && (
          <BoldSection title="Experience" accent={accent}>
            {data.experience.map((exp, i) => <ExpBlock key={i} exp={exp} accent={accent} />)}
          </BoldSection>
        )}
        {data.education?.length > 0 && (
          <BoldSection title="Education" accent={accent}>
            {data.education.map((edu, i) => <EduBlock key={i} edu={edu} />)}
          </BoldSection>
        )}
        {data.skills?.length > 0 && (
          <BoldSection title="Skills" accent={accent}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {data.skills.map((s, i) => (
                <span key={i} style={{ background: "#fef2f2", color: accent, padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                  {s}
                </span>
              ))}
            </div>
          </BoldSection>
        )}
      </div>
      <Watermark />
    </div>
  );
}

export function ResumeElegantTemplate({ data }: { data: ResumeData }) {
  const accent = "#7c3aed";
  return (
    <div style={{ ...base, fontFamily: "'Georgia', serif", background: "#faf9ff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#1a0533", letterSpacing: "-0.3px" }}>
            {data.name || "Your Name"}
          </h1>
          {data.title && <p style={{ margin: "4px 0 0", fontSize: 14, color: accent, fontWeight: 600, fontStyle: "italic" }}>{data.title}</p>}
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#666", lineHeight: 1.8 }}>
          {data.email && <div>{data.email}</div>}
          {data.phone && <div>{data.phone}</div>}
          {data.location && <div>{data.location}</div>}
          {data.website && <div>{data.website}</div>}
        </div>
      </div>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}, transparent)`, marginBottom: 24 }} />

      {data.summary && (
        <Section title="Summary" accent={accent}>
          <p style={{ margin: 0, color: "#444", fontStyle: "italic" }}>{data.summary}</p>
        </Section>
      )}
      {data.experience?.length > 0 && (
        <Section title="Experience" accent={accent}>
          {data.experience.map((exp, i) => <ExpBlock key={i} exp={exp} accent={accent} />)}
        </Section>
      )}
      {data.education?.length > 0 && (
        <Section title="Education" accent={accent}>
          {data.education.map((edu, i) => <EduBlock key={i} edu={edu} />)}
        </Section>
      )}
      {data.skills?.length > 0 && (
        <Section title="Skills" accent={accent}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.skills.map((s, i) => (
              <span key={i} style={{ background: `${accent}15`, color: accent, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}
      <Watermark />
    </div>
  );
}

// ─── DOCUMENT TEMPLATES ────────────────────────────────────────────────────────

export function DocumentExecutiveTemplate({ data }: { data: DocumentData }) {
  const accent = "#0f172a";
  return (
    <div style={base}>
      <div style={{ borderBottom: `4px double ${accent}`, paddingBottom: 16, marginBottom: 28 }}>
        {data.author && <p style={{ margin: "0 0 4px", fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "1.5px" }}>{data.author}</p>}
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: accent, letterSpacing: "-0.5px" }}>{data.title || "Document Title"}</h1>
        {data.subtitle && <p style={{ margin: "6px 0 0", fontSize: 14, color: "#555", fontStyle: "italic" }}>{data.subtitle}</p>}
        {data.date && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#888" }}>{data.date}</p>}
      </div>
      {data.sections?.map((sec, i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px" }}>
            {sec.heading}
          </h2>
          <div style={{ color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{sec.content}</div>
        </div>
      ))}
      <Watermark />
    </div>
  );
}

export function DocumentAcademicTemplate({ data }: { data: DocumentData }) {
  const accent = "#1d4ed8";
  return (
    <div style={{ ...base, fontFamily: "'Georgia', serif", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111" }}>{data.title || "Paper Title"}</h1>
        {data.subtitle && <p style={{ margin: "6px 0 0", color: "#555", fontSize: 13, fontStyle: "italic" }}>{data.subtitle}</p>}
        {data.author && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#333" }}>{data.author}</p>}
        {data.date && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#777" }}>{data.date}</p>}
        <div style={{ width: 60, height: 2, background: accent, margin: "16px auto 0" }} />
      </div>
      {data.sections?.map((sec, i) => (
        <div key={i} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: accent, margin: "0 0 6px" }}>
            {i + 1}. {sec.heading}
          </h2>
          <div style={{ color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.8, textAlign: "justify" }}>{sec.content}</div>
        </div>
      ))}
      <Watermark />
    </div>
  );
}

export function DocumentReportTemplate({ data }: { data: DocumentData }) {
  const accent = "#065f46";
  return (
    <div style={{ ...base, padding: 0 }}>
      <div style={{ background: accent, color: "#fff", padding: "36px 52px 28px" }}>
        <p style={{ margin: "0 0 6px", fontSize: 10, textTransform: "uppercase", letterSpacing: "2px", opacity: 0.7 }}>Report</p>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{data.title || "Report Title"}</h1>
        {data.subtitle && <p style={{ margin: "6px 0 0", opacity: 0.8, fontSize: 13 }}>{data.subtitle}</p>}
        <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 11, opacity: 0.7 }}>
          {data.author && <span>Prepared by: {data.author}</span>}
          {data.date && <span>{data.date}</span>}
        </div>
      </div>
      <div style={{ padding: "32px 52px" }}>
        {data.sections?.map((sec, i) => (
          <div key={i} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ background: accent, color: "#fff", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: accent }}>{sec.heading}</h2>
            </div>
            <div style={{ color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.7, paddingLeft: 34 }}>{sec.content}</div>
          </div>
        ))}
      </div>
      <Watermark />
    </div>
  );
}

export function DocumentNewsletterTemplate({ data }: { data: DocumentData }) {
  const accent = "#9333ea";
  return (
    <div style={{ ...base, background: "#fff" }}>
      <div style={{ background: `linear-gradient(135deg, ${accent}, #c084fc)`, color: "#fff", padding: "28px 36px", borderRadius: 8, marginBottom: 28 }}>
        <p style={{ margin: "0 0 4px", fontSize: 10, textTransform: "uppercase", letterSpacing: "3px", opacity: 0.8 }}>Newsletter</p>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{data.title || "Newsletter Title"}</h1>
        {data.subtitle && <p style={{ margin: "4px 0 0", opacity: 0.85, fontSize: 13 }}>{data.subtitle}</p>}
        {data.date && <p style={{ margin: "8px 0 0", fontSize: 11, opacity: 0.7 }}>{data.date}</p>}
      </div>
      {data.sections?.map((sec, i) => (
        <div key={i} style={{ marginBottom: 20, borderLeft: `3px solid ${accent}`, paddingLeft: 16 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: accent }}>{sec.heading}</h2>
          <div style={{ color: "#444", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{sec.content}</div>
        </div>
      ))}
      <Watermark />
    </div>
  );
}

// ─── Reusable sub-components ────────────────────────────────────────────────────

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: accent }}>
          {title}
        </h2>
        <div style={{ flex: 1, height: 1, background: `${accent}30` }} />
      </div>
      {children}
    </div>
  );
}

function ClassicSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "1px", borderBottom: `1px solid ${accent}40`, paddingBottom: 4 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function MinSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#aaa" }}>{title}</p>
      {children}
    </div>
  );
}

function BoldSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 4, height: 18, background: accent, borderRadius: 2 }} />
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px", color: "#111" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ExpBlock({ exp, accent }: { exp: ExperienceItem; accent: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: "#111" }}>{exp.role}</span>
        <span style={{ fontSize: 10.5, color: "#888" }}>{exp.duration}</span>
      </div>
      <div style={{ fontSize: 11, color: accent, fontWeight: 600, marginBottom: 5 }}>{exp.company}</div>
      {exp.bullets?.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {exp.bullets.map((b, i) => (
            <li key={i} style={{ fontSize: 11.5, color: "#444", marginBottom: 2 }}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EduBlock({ edu }: { edu: EducationItem }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: "#111" }}>{edu.degree}</span>
        <span style={{ fontSize: 10.5, color: "#888" }}>{edu.year}</span>
      </div>
      <div style={{ fontSize: 11, color: "#555" }}>{edu.institution}</div>
      {edu.notes && <div style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>{edu.notes}</div>}
    </div>
  );
}

// ─── Master renderer ───────────────────────────────────────────────────────────

export function renderTemplate(config: PdfConfig) {
  if (config.type === "resume") {
    switch (config.template) {
      case "modern": return <ResumeModernTemplate data={config.data} />;
      case "classic": return <ResumeClassicTemplate data={config.data} />;
      case "minimal": return <ResumeMinimalTemplate data={config.data} />;
      case "bold": return <ResumeBoldTemplate data={config.data} />;
      case "elegant": return <ResumeElegantTemplate data={config.data} />;
    }
  } else {
    switch (config.template) {
      case "executive": return <DocumentExecutiveTemplate data={config.data} />;
      case "academic": return <DocumentAcademicTemplate data={config.data} />;
      case "report": return <DocumentReportTemplate data={config.data} />;
      case "newsletter": return <DocumentNewsletterTemplate data={config.data} />;
    }
  }
}
