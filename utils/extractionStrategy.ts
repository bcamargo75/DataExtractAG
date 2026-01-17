import { SimpleTextItem, PDFParagraph, groupTextIntoLines, groupLinesIntoParagraphs, analyzeHeadings, detectSeparators, detectFooters } from './pdfTextAnalysis';

// --- Types ---

export interface StopRules {
    stopAtHeading?: boolean;
    stopAtSeparator?: boolean;
    stopAtEmptyGap?: boolean;
    stopAtNextField?: boolean;
    maxLines?: number; // Safety valve
}

export interface RelativeExtractionDefinition {
    anchorText: string;    // The text to look for (title/label)
    relativeBBox?: {       // Optional hint: Where roughly was it in the original relative to the page? (0-100%)
        xmin: number;
        ymin: number;
        xmax: number;
        ymax: number;
    };
    stopRules: StopRules;
    stopMarker?: string; // New: Explicit text to stop at
}

// --- Logic ---

/**
 * Finds the anchor paragraph in the current document that matches the definition.
 * Uses text similarity and optional geometric hints.
 */
export const findAnchor = (paragraphs: PDFParagraph[], definition: RelativeExtractionDefinition): PDFParagraph | null => {
    // 1. Text Match (Exact or Fuzzy)
    // For now, strict case-insensitive match on the start of the text
    const targetText = definition.anchorText.toLowerCase().trim();

    // Filter candidates
    const candidates = paragraphs.filter(p => p.text.toLowerCase().includes(targetText));

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // 2. Disambiguate using Geometric Hint (if available)
    if (definition.relativeBBox) {
        // Find the one centered closest to the relative hint
        // Note: we'd need page dimensions to map % back to pixels to do this perfectly, 
        // but for now let's assume valid candidates are rare enough.
        // Or we just take the first one found top-down.
        return candidates[0];
    }

    return candidates[0];
};

/**
 * Determines the "Column" or content width for the field.
 * Returns a BBox representing the horizontal bounds allowed.
 */
export const getContentColumn = (anchor: PDFParagraph, paragraphs: PDFParagraph[], pageWidth: number): { left: number, right: number } => {
    // Heuristic:
    // 1. Start from anchor.bbox.x
    // 2. If most paragraphs below are aligned with anchor, use anchor alignment.
    // 3. If standard 2-column layout, use mid-page as split.

    // Simple Default: Use anchor's left alignment - tolerance, and extend to right margin or next column.

    const leftBound = Math.max(0, anchor.bbox.x - 20); // 20px tolerance for hanging indent

    // Determine right bound: 
    // Is there a clear "gutter" to the right?
    // Check paragraphs roughly at the same Ys but to the right of anchor.

    // For MVP: Let's assume full width to the right of the anchor, 
    // unless we detect a paragraph explicitly starting far to the right (multi-column detection).

    return { left: leftBound, right: pageWidth };
};

/**
 * Main Extraction Strategy
 */
export const extractRelativeField = (
    items: SimpleTextItem[],
    definition: RelativeExtractionDefinition,
    allFieldsDefs: RelativeExtractionDefinition[], // To check for next field
    pageWidth: number,
    pageHeight: number
): string => {
    // 1. Reconstruct Layout Structure
    const lines = groupTextIntoLines(items);
    const rawParagraphs = groupLinesIntoParagraphs(lines);

    // Collect all potential anchors to treat them as Headings
    const knownAnchors = [
        definition.anchorText,
        ...allFieldsDefs.map(d => d.anchorText)
    ].filter(a => a && a.length > 0);

    let paragraphs = analyzeHeadings(rawParagraphs, knownAnchors);
    paragraphs = detectSeparators(paragraphs as PDFParagraph[]) as PDFParagraph[];
    paragraphs = detectFooters(paragraphs as PDFParagraph[]) as PDFParagraph[];

    // 2. Find Anchor
    const anchor = findAnchor(paragraphs, definition);
    if (!anchor) return ''; // Anchor not found

    // 3. Determine Stop Position
    const allowedColumn = getContentColumn(anchor, paragraphs, pageWidth);

    const extraction: string[] = [];

    // Start strictly AFTER the anchor
    // Find index of anchor
    const anchorIndex = paragraphs.findIndex(p => p.id === anchor.id);
    if (anchorIndex === -1) return ''; // Should not happen

    for (let i = anchorIndex + 1; i < paragraphs.length; i++) {
        const p = paragraphs[i];

        // --- Structural Checks (Geomtetry) ---
        // Must be below anchor (guaranteed by loop order if sorted)
        // Must be within column bounds
        // Relaxing the column check slightly to avoid missing indented items
        if (p.bbox.x > allowedColumn.right + 50) {
            // Definitely too far right
            continue;
        }

        // --- Stop Rules ---

        // 1. Heading
        if (definition.stopRules.stopAtHeading && p.isHeading) {
            break;
        }

        // 2. Separator
        if (definition.stopRules.stopAtSeparator && p['isSeparator']) {
            break;
        }

        // New: Explicit Stop Marker
        if (definition.stopMarker) {
            const marker = definition.stopMarker.toLowerCase().trim();
            // Check if this paragraph contains or is the marker
            if (p.text.toLowerCase().includes(marker)) {
                break;
            }
        }

        // 3. Footer / Note Check (Explicit Stop)
        // If it's a footer/note, we stop BEFORE including it.
        // This is a "Global" stop rule for block extraction usually.
        if (p['isFooter']) {
            break;
        }

        // 4. Next Field Anchor (Implied Stop)
        // Redundant if isHeading worked correctly with knownAnchors, but good as backup
        if (definition.stopRules.stopAtNextField) {
            const isOtherAnchor = allFieldsDefs.some(f =>
                f.anchorText.toLowerCase().trim() === p.text.toLowerCase().trim() &&
                f.anchorText !== definition.anchorText // Don't match self
            );
            if (isOtherAnchor) break;
        }

        // 5. Empty Gap (Big vertical space)
        if (definition.stopRules.stopAtEmptyGap) {
            const prevP = i > 0 ? paragraphs[i - 1] : anchor;
            const gap = p.bbox.y - (prevP.bbox.y + prevP.bbox.h);
            const GAP_THRESHOLD = prevP.bbox.h * 4; // 4 lines blank
            if (gap > GAP_THRESHOLD) break;
        }

        extraction.push(p.text);
    }

    return extraction.join('\n\n');
};
