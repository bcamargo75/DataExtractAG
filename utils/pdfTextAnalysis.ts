import { TextItem } from 'pdfjs-dist/types/src/display/api';

// Re-defining TextItem here if not exported from a shared types file, 
// or acceptable to use the one from the screen if I export it.
// For now, let's define a compatible interface to avoid dependency loops or complex imports.
export interface SimpleTextItem {
    str: string;
    x: number;
    y: number;
    w: number;
    h: number;
    fontName?: string; // Optional for now as original interface didn't show it, but useful for style
    hasEOL?: boolean; // Some pdfjs versions give this
}

export interface PDFLine {
    result: string;
    bbox: { x: number; y: number; w: number; h: number };
    items: SimpleTextItem[];
}

export interface PDFParagraph {
    id: string; // unique ID for React keys
    text: string;
    lines: PDFLine[];
    bbox: { x: number; y: number; w: number; h: number };
    styleKey: string; // Composite key of font+size+weight to help grouping
    isHeading?: boolean;
    isSeparator?: boolean;
}

/**
 * Groups raw text items into visual lines based on Y coordinate proximity.
 */
export const groupTextIntoLines = (items: SimpleTextItem[]): PDFLine[] => {
    // 1. Sort by Y (top to bottom), then X (left to right)
    // Note: PDF coordinates usually have (0,0) at bottom-left, but the extracted items in ExtractionScreen
    // seem to have been transformed to top-left Y. We'll assume top-down Y.
    const sorted = [...items].sort((a, b) => {
        const yDiff = Math.abs(a.y - b.y);
        if (yDiff < (Math.min(a.h, b.h) / 2)) {
            return a.x - b.x;
        }
        return a.y - b.y;
    });

    const lines: PDFLine[] = [];
    let currentLine: SimpleTextItem[] = [];
    let currentLineY = -1;

    sorted.forEach(item => {
        if (currentLine.length === 0) {
            currentLine.push(item);
            currentLineY = item.y;
            return;
        }

        // Check if on same line (within half height tolerance)
        const lastItem = currentLine[currentLine.length - 1];
        const yDiff = Math.abs(item.y - currentLineY);
        const heightTolerance = Math.min(item.h, lastItem.h) * 0.6; // Slightly loose tolerance

        if (yDiff < heightTolerance) {
            currentLine.push(item);
        } else {
            // Flush current line
            lines.push(createLineFromItems(currentLine));
            currentLine = [item];
            currentLineY = item.y;
        }
    });

    if (currentLine.length > 0) {
        lines.push(createLineFromItems(currentLine));
    }

    return lines;
};

const createLineFromItems = (items: SimpleTextItem[]): PDFLine => {
    const x = Math.min(...items.map(i => i.x));
    const y = Math.min(...items.map(i => i.y));
    const r = Math.max(...items.map(i => i.x + i.w));
    const b = Math.max(...items.map(i => i.y + i.h));

    // Join strings. Logic can be improved to detect big spaces.
    const text = items.map(i => i.str).join(' '); // Simple join for now

    return {
        result: text,
        bbox: { x, y, w: r - x, h: b - y },
        items
    };
};

/**
 * Groups Lines into Paragraphs based on vertical gaps and potentially style.
 */
export const groupLinesIntoParagraphs = (lines: PDFLine[]): PDFParagraph[] => {
    const paragraphs: PDFParagraph[] = [];
    if (lines.length === 0) return [];

    let currentParaLines: PDFLine[] = [];

    // Helper to get font info (if available) or approximate style
    const getStyleKey = (line: PDFLine) => {
        // Since we don't have fontName strictly in the interface yet, use height as proxy for font size
        // In real PDFJS items, fontName is available. We might need to cast or update ExtractionScreen to pass it.
        // For now: "h-{height}"
        const avgHeight = line.items.reduce((sum, i) => sum + i.h, 0) / line.items.length;
        return `h-${Math.round(avgHeight)}`;
    };

    lines.forEach((line, index) => {
        if (currentParaLines.length === 0) {
            currentParaLines.push(line);
            return;
        }

        const prevLine = currentParaLines[currentParaLines.length - 1];

        // 1. Vertical Gap Check
        const verticalGap = line.bbox.y - (prevLine.bbox.y + prevLine.bbox.h);
        const lineHeight = prevLine.bbox.h;

        // If gap is significantly larger than line height (e.g. > 1.5x), likely new paragraph
        const isBigGap = verticalGap > (lineHeight * 1.5);

        // 2. Style Check
        const styleMatch = getStyleKey(line) === getStyleKey(prevLine);

        if (isBigGap || !styleMatch) {
            paragraphs.push(createParagraph(currentParaLines));
            currentParaLines = [line];
        } else {
            currentParaLines.push(line);
        }
    });

    if (currentParaLines.length > 0) {
        paragraphs.push(createParagraph(currentParaLines));
    }

    return paragraphs;
};

const createParagraph = (lines: PDFLine[]): PDFParagraph => {
    const x = Math.min(...lines.map(l => l.bbox.x));
    const y = Math.min(...lines.map(l => l.bbox.y));
    const r = Math.max(...lines.map(l => l.bbox.x + l.bbox.w));
    const b = Math.max(...lines.map(l => l.bbox.y + l.bbox.h));

    // Compute dominant style (average height for now)
    const allItems = lines.flatMap(l => l.items);
    const avgHeight = allItems.reduce((sum, i) => sum + i.h, 0) / allItems.length;
    const styleKey = `h-${Math.round(avgHeight)}`;

    const text = lines.map(l => l.result).join('\n');

    return {
        id: crypto.randomUUID(),
        text,
        lines,
        bbox: { x, y, w: r - x, h: b - y },
        styleKey
    };
};

/**
 * Heuristic to detect headings vs body.
 * Returns the paragraphs with `isHeading` flag set.
 */
/**
 * Heuristic to detect headings vs body.
 * Returns the paragraphs with `isHeading` flag set.
 * Check against knownAnchors to force heading detection.
 */
export const analyzeHeadings = (paragraphs: PDFParagraph[], knownAnchors: string[] = []): PDFParagraph[] => {
    if (paragraphs.length === 0) return [];

    // 1. Determine "Body" style (Key with most characters or occurrences)
    const styleCounts: Record<string, number> = {};
    paragraphs.forEach(p => {
        styleCounts[p.styleKey] = (styleCounts[p.styleKey] || 0) + p.text.length; // Weight by length
    });

    let bodyStyle = '';
    let maxCount = -1;
    for (const [style, count] of Object.entries(styleCounts)) {
        if (count > maxCount) {
            maxCount = count;
            bodyStyle = style;
        }
    }

    // Parse body size from key "h-12" -> 12
    const bodySize = parseInt(bodyStyle.split('-')[1] || '10');

    return paragraphs.map(p => {
        // 0. Force Known Anchors
        const cleanText = p.text.trim().toLowerCase();
        if (knownAnchors.some(anchor => cleanText === anchor.toLowerCase().trim())) {
            return { ...p, isHeading: true };
        }

        const pSize = parseInt(p.styleKey.split('-')[1] || '10');

        // 1. Size Check
        const isLarger = pSize > (bodySize * 1.1); // 10% larger than body

        // 2. Formatting Check (AllCaps + Short)
        // Heuristic: Titles often are short (< 100 chars) and uppercase
        const isShort = p.text.length < 100;
        const isAllCaps = p.text.length > 4 && p.text === p.text.toUpperCase();

        // Combined Heuristic
        const isLikelyHeading = isLarger || (isShort && isAllCaps);

        return {
            ...p,
            isHeading: isLikelyHeading || !!p.isHeading
        };
    });
};

/**
 * Detects visual separators (lines like ---- or ____) or empty gaps that signify a section break.
 * Returns paragraphs that are separators.
 */
export const detectSeparators = (paragraphs: PDFParagraph[]): PDFParagraph[] => {
    return paragraphs.map(p => {
        const cleanText = p.text.trim();
        // Dashes, underscores, equal signs, asterisks
        const isSeparatorLine = /^[_\-=\*]{3,}$/.test(cleanText);

        if (isSeparatorLine) {
            return { ...p, isSeparator: true };
        }
        return p;
    });
};

/**
 * Detects specific footer/note tokens that should stop the block.
 * e.g. "Nota:", "Note:"
 */
export const detectFooters = (paragraphs: PDFParagraph[]): PDFParagraph[] => {
    return paragraphs.map(p => {
        const cleanText = p.text.trim().toLowerCase();
        // Starts with "nota:" or is exactly "nota"
        const isFooterNote = cleanText.startsWith('nota:') ||
            cleanText.startsWith('note:') ||
            cleanText === 'nota' ||
            cleanText === 'note';

        if (isFooterNote) {
            return { ...p, isFooter: true };
        }
        return p;
    });
};
