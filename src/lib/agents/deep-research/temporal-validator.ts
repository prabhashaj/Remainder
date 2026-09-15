import type {
  DateClassification,
  ResearchScope,
  SourceMetadata,
  TemporalStatus,
} from "./types";
import { parseDateString } from "./scope-resolver";

/**
 * Validates whether a source publication date is within the research scope.
 * Programmatic hard check:
 * If source_date > cutoff_date => REJECTED_OUT_OF_WINDOW
 */
export function validateSourceTemporalWindow(
  source: SourceMetadata,
  scope: ResearchScope,
): { status: TemporalStatus; reason?: string } {
  if (!scope.endDate) {
    return { status: "valid" };
  }

  const cutoff = scope.endDate;
  const sourceDate = source.publicationDate;

  if (sourceDate) {
    // String comparison works for ISO YYYY-MM-DD
    if (sourceDate > cutoff) {
      return {
        status: "rejected_out_of_window",
        reason: `Source date ${sourceDate} is strictly after the research cutoff date ${cutoff}.`,
      };
    }

    if (scope.startDate && sourceDate < scope.startDate) {
      return {
        status: "pre_window_baseline",
        reason: `Source date ${sourceDate} is prior to research start date ${scope.startDate}; retained for historical baseline only.`,
      };
    }

    return { status: "valid" };
  }

  // If no date could be extracted from source, check if rawSnippet or title explicitly contains a post-cutoff date
  const combinedText = `${source.title} ${source.rawSnippet || ""}`.toLowerCase();
  const cutoffYear = parseInt(cutoff.slice(0, 4), 10);
  const cutoffMonth = parseInt(cutoff.slice(5, 7), 10);

  // If snippet explicitly references a future month/year past cutoff
  // e.g., cutoff is 2026-09-15, and snippet says "in October 2026" or "November 2026" or "2027"
  if (cutoffYear) {
    const nextYear = cutoffYear + 1;
    if (combinedText.includes(`${nextYear}`)) {
      return {
        status: "rejected_out_of_window",
        reason: `Source text explicitly references year ${nextYear} which is past the cutoff ${cutoff}.`,
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
            reason: `Source text explicitly references ${m} ${cutoffYear} which is past cutoff date ${cutoff}.`,
          };
        }
      }
    }
  }

  return { status: "valid" };
}

/**
 * Distinguishes different dates for an entity/technology:
 * release vs announcement vs adoption vs impact
 */
export function extractDateClassification(
  text: string,
  sourceDate?: string,
): DateClassification {
  const dates: DateClassification = {
    sourcePublicationDate: sourceDate,
  };

  const announcementMatch =
    /(?:announced|unveiled|introduced|revealed)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (announcementMatch && announcementMatch[1]) {
    dates.announcementDate = parseDateString(announcementMatch[1]);
  }

  const releaseMatch =
    /(?:released|launched|shipped|available)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (releaseMatch && releaseMatch[1]) {
    dates.releaseDate = parseDateString(releaseMatch[1]);
  }

  const adoptionMatch =
    /(?:adopted|widespread adoption|deployed in production|scaled)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (adoptionMatch && adoptionMatch[1]) {
    dates.adoptionDate = parseDateString(adoptionMatch[1]);
  }

  const paperMatch =
    /(?:paper published|preprint|arxiv)(?:\s+on|\s+in)?\s+([A-Za-z]+ \d{1,2},? \d{4}|\w+ \d{4}|\d{4}-\d{2}-\d{2}|\d{4})/i.exec(
      text,
    );
  if (paperMatch && paperMatch[1]) {
    dates.researchPaperDate = parseDateString(paperMatch[1]);
  }

  return dates;
}

/**
 * Reconciles release date vs adoption date to prevent temporal confusion.
 * E.g., if a technology was released in 2024 but adoption happened in 2026,
 * ensures report states: "Originally released in 2024, but its adoption/impact accelerated during the research window."
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
