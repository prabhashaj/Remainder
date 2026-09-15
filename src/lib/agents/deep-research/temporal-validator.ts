import type {
  DateClassification,
  ResearchScope,
  ResearchTask,
  SourceMetadata,
  TemporalScope,
  TemporalStatus,
} from "./types";
import { parseDateString } from "./scope-resolver";

/**
 * Validates whether a source publication date or event date is within the research scope.
 * Programmatic hard check:
 * - If strict cutoff: source_date > cutoff_date => REJECTED_OUT_OF_WINDOW
 * - If retrospective_allowed: retrospective analysis sources permitted, but event_date must be in window.
 * - Unknown dates are strictly null (never coerced into a fake default).
 */
export function validateSourceTemporalWindow(
  source: SourceMetadata,
  scope: ResearchScope | ResearchTask | TemporalScope,
): { status: TemporalStatus; reason?: string } {
  const endDate =
    "temporalScope" in scope && scope.temporalScope?.endDate
      ? scope.temporalScope.endDate
      : "endDate" in scope
        ? scope.endDate
        : undefined;

  const startDate =
    "temporalScope" in scope && scope.temporalScope?.startDate
      ? scope.temporalScope.startDate
      : "startDate" in scope
        ? scope.startDate
        : undefined;

  const cutoffPolicy =
    "temporalScope" in scope && scope.temporalScope?.cutoffPolicy
      ? scope.temporalScope.cutoffPolicy
      : "cutoffPolicy" in scope
        ? (scope as TemporalScope).cutoffPolicy
        : "strict";

  if (!endDate) {
    return { status: "valid" };
  }

  const sourceDate = source.publicationDate;

  // 1. Strict Cutoff Check on Publication Date
  if (sourceDate) {
    if (cutoffPolicy === "strict" && sourceDate > endDate) {
      return {
        status: "rejected_out_of_window",
        reason: `Source date ${sourceDate} is strictly after the research cutoff date ${endDate}.`,
      };
    }

    if (startDate && sourceDate < startDate && cutoffPolicy === "strict") {
      return {
        status: "pre_window_baseline",
        reason: `Source date ${sourceDate} is prior to research start date ${startDate}; retained for historical baseline only.`,
      };
    }

    return { status: "valid" };
  }

  // 2. If no publication date was found (remains strictly null)
  // Check whether rawSnippet or title explicitly asserts an event/publication date past cutoff
  const combinedText = `${source.title} ${source.rawSnippet || ""}`.toLowerCase();
  const cutoffYear = parseInt(endDate.slice(0, 4), 10);
  const cutoffMonth = parseInt(endDate.slice(5, 7), 10);

  if (cutoffYear) {
    const nextYear = cutoffYear + 1;
    if (combinedText.includes(`${nextYear}`)) {
      return {
        status: "rejected_out_of_window",
        reason: `Source text explicitly references year ${nextYear} which is past the cutoff ${endDate}.`,
      };
    }

    if (cutoffMonth && combinedText.includes(`${cutoffYear}`)) {
      const laterMonths = [
        "october",
        "november",
        "december",
      ].filter((_, idx) => idx + 10 > cutoffMonth);
      for (const m of laterMonths) {
        if (combinedText.includes(`${m} ${cutoffYear}`)) {
          return {
            status: "rejected_out_of_window",
            reason: `Source text explicitly references ${m} ${cutoffYear} which is past cutoff date ${endDate}.`,
          };
        }
      }
    }
  }

  return { status: "valid" };
}

/**
 * Distinguishes different dates for an entity, policy, discovery, or event:
 * - announcementDate
 * - releaseDate / discoveryDate
 * - adoptionDate / commercializationDate
 * - eventDate / occurrenceDate
 * - effectiveDate
 * - researchPaperDate
 */
export function extractDateClassification(
  text: string,
  sourceDate?: string | null,
): DateClassification {
  const dates: DateClassification = {
    sourcePublicationDate: sourceDate || null,
  };

  // 1. Announcement / Revelation / Unveiling
  const announcementMatch =
    /(?:announced|unveiled|introduced|revealed)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (announcementMatch && announcementMatch[1]) {
    dates.announcementDate = parseDateString(announcementMatch[1]);
  }

  // 2. Release / Launch / Discovery / Invention
  const releaseMatch =
    /(?:released|launched|shipped|available|discovered|invented|patented)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (releaseMatch && releaseMatch[1]) {
    dates.releaseDate = parseDateString(releaseMatch[1]);
  }

  // 3. Adoption / Deployment / Commercialization / Scale
  const adoptionMatch =
    /(?:adopted|widespread adoption|deployed in production|scaled|commercialized)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (adoptionMatch && adoptionMatch[1]) {
    dates.adoptionDate = parseDateString(adoptionMatch[1]);
  }

  // 4. Academic paper / Preprint
  const paperMatch =
    /(?:paper published|preprint|arxiv|journal)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (paperMatch && paperMatch[1]) {
    dates.researchPaperDate = parseDateString(paperMatch[1]);
  }

  // 5. Event occurrence (e.g. crisis, crash, disaster, peak, outbreak)
  const eventMatch =
    /(?:occurred|happened|collapsed|defaulted|began|triggered in|peaked in)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (eventMatch && eventMatch[1]) {
    dates.eventDate = parseDateString(eventMatch[1]);
  }

  // 6. Effective / Enactment date (policy, regulation, standard)
  const effectiveMatch =
    /(?:effective|enacted|ratified|passed into law|went into effect)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (effectiveMatch && effectiveMatch[1]) {
    dates.effectiveDate = parseDateString(effectiveMatch[1]);
  }

  return dates;
}

/**
 * Reconciles introduction/discovery date vs widespread adoption date to prevent temporal confusion.
 * E.g., if a technology/policy was introduced in 2020 but adoption happened in 2025,
 * ensures the report clearly states: "Originally released in 2020, but its production adoption and industry impact accelerated during the research window (2025)."
 */
export function reconcileReleaseVsAdoption(params: {
  entityName: string;
  releaseYear?: number;
  adoptionYear?: number;
  windowStartYear?: number;
  windowEndYear?: number;
}): { needsAdoptionClarification: boolean; clarifiedStatement?: string } {
  const { entityName, releaseYear, adoptionYear, windowStartYear } = params;

  if (
    releaseYear &&
    windowStartYear &&
    releaseYear < windowStartYear &&
    adoptionYear &&
    adoptionYear >= windowStartYear
  ) {
    return {
      needsAdoptionClarification: true,
      clarifiedStatement: `${entityName} was originally released in ${releaseYear}, but its production adoption and industry impact accelerated during the research window (${adoptionYear}).`,
    };
  }

  return { needsAdoptionClarification: false };
}
