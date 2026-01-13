import React, { useRef, useState, useEffect } from 'react';

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

interface BBox {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
}

interface TemplateField {
    id: string;
    name: string;
    bbox: BBox;
    value: string;
}

interface TextItem {
    str: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

// Helper interface for the floating button
interface TempSelection {
    bbox: BBox;
    text: string;
    displayX: number; // Pixel X relative to container
    displayY: number; // Pixel Y relative to container
    width: number;    // Pixel width
}

interface BatchResult {
    fileName: string;
    data: Record<string, string>;
    status: 'success' | 'error';
}

const ExtractionScreen = () => {
    // Dashboard States
    const fileInputRef = useRef<HTMLInputElement>(null);
    const batchInputRef = useRef<HTMLInputElement>(null);

    // Editor States
    const [file, setFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [pageNum, setPageNum] = useState(1);
    const [scale, setScale] = useState(1.0); // Start at 100%
    const [textItems, setTextItems] = useState<TextItem[]>([]);
    const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);

    // Selection State
    const [tempSelection, setTempSelection] = useState<TempSelection | null>(null);

    const [viewportDimensions, setViewportDimensions] = useState({ width: 0, height: 0 });

    // Save Modal State
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [templateName, setTemplateName] = useState('');

    // Batch Processing State
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchFiles, setBatchFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [batchResults, setBatchResults] = useState<BatchResult[]>([]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null); // Reference to the wrapper for coord calculation

    // --- LOGIC: Text Intersection (Used for extraction on new PDFs) ---
    const processTextIntersection = (items: TextItem[], bbox: BBox, width: number, height: number): string => {
        // Convert Percentage BBox to Pixel Rect for the specific page dimensions
        const canvasRect = {
            x: (bbox.xmin / 100) * width,
            y: (bbox.ymin / 100) * height,
            w: ((bbox.xmax - bbox.xmin) / 100) * width,
            h: ((bbox.ymax - bbox.ymin) / 100) * height
        };

        const EPS = 3; // Tolerance in pixels

        const bounds = {
            left: canvasRect.x - EPS,
            top: canvasRect.y - EPS,
            right: canvasRect.x + canvasRect.w + EPS,
            bottom: canvasRect.y + canvasRect.h + EPS
        };

        const extractedItems = items.filter(item => {
            // item.x/y are typically bottom-left in PDF coordinates, but transformed to top-left in our load function
            const itemLeft = item.x;
            const itemRight = item.x + item.w;
            const itemTop = item.y;
            const itemBottom = item.y + item.h;

            // Check for intersection/containment
            // Simple logic: if the center of the text item is inside the box
            const centerX = itemLeft + (item.w / 2);
            const centerY = itemTop + (item.h / 2);

            const isContained =
                centerX >= bounds.left &&
                centerX <= bounds.right &&
                centerY >= bounds.top &&
                centerY <= bounds.bottom;

            return isContained;
        });

        // Sort items: mainly top to bottom, then left to right
        extractedItems.sort((a, b) => {
            const lineTolerance = (a.h || 10) / 2;
            if (Math.abs(a.y - b.y) < lineTolerance) {
                return a.x - b.x;
            }
            return a.y - b.y;
        });

        return extractedItems
            .map(i => i.str)
            .filter(s => s.trim().length > 0)
            .join(' ')
            .trim();
    };

    // --- EVENT HANDLERS: Dashboard ---
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type === 'application/pdf') {
                setFile(selectedFile);
                loadPdf(selectedFile);
            } else {
                alert("Por favor sube un archivo PDF para usar el editor de plantillas.");
            }
        }
    };

    // --- LOGIC: PDF Loading & Rendering ---
    const loadPdf = async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        try {
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const doc = await loadingTask.promise;
            setPdfDoc(doc);
            setPageNum(1);
            setTemplateFields([]);
            setTempSelection(null);
        } catch (error) {
            console.error("Error loading PDF:", error);
            alert("Error al cargar el PDF.");
        }
    };

    useEffect(() => {
        if (pdfDoc) {
            renderPage();
        }
    }, [pdfDoc, pageNum, scale]);

    const renderPage = async () => {
        if (!pdfDoc || !canvasRef.current) return;

        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            setViewportDimensions({ width: viewport.width, height: viewport.height });

            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            await page.render(renderContext).promise;

            const textContent = await page.getTextContent();
            const items: TextItem[] = textContent.items.map((item: any) => {
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const w = item.width * scale;
                const h = item.height * scale;

                return {
                    str: item.str,
                    x: tx[4],
                    y: tx[5] - h,
                    w: w,
                    h: h
                };
            });
            setTextItems(items);

        } catch (error) {
            console.error("Error rendering page:", error);
        }
    };

    // --- LOGIC: Handle Native Text Selection ---
    const handleTextSelection = () => {
        const selection = window.getSelection();

        // Clear temp selection if the user clicks away (collapses selection)
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            setTempSelection(null);
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const text = selection.toString().trim();

        if (!containerRef.current || !text) return;

        // Calculate BBox relative to the PDF Container
        const containerRect = containerRef.current.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) return;

        // Coordinates relative to container (pixels)
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;
        const w = rect.width;
        const h = rect.height;

        // Convert to Percentages (to match BBox interface and be responsive)
        const bbox: BBox = {
            xmin: (x / containerRect.width) * 100,
            ymin: (y / containerRect.height) * 100,
            xmax: ((x + w) / containerRect.width) * 100,
            ymax: ((y + h) / containerRect.height) * 100
        };

        // Instead of prompting immediately, set the temp selection state
        // to show the "Create Field" button.
        setTempSelection({
            bbox,
            text,
            displayX: x,
            displayY: y,
            width: w
        });
    };

    // --- LOGIC: Create Field from Temp Selection ---
    const confirmFieldCreation = () => {
        if (!tempSelection) return;

        const nextFieldIndex = templateFields.length + 1;
        // Automatically assign a name so we don't block the UI with a prompt
        const name = `Campo ${nextFieldIndex}`;

        const newField: TemplateField = {
            id: Date.now().toString(),
            name: name,
            bbox: tempSelection.bbox,
            value: tempSelection.text
        };

        setTemplateFields(prevFields => [...prevFields, newField]);

        // Cleanup
        setTempSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const deleteField = (id: string) => {
        setTemplateFields(prev => prev.filter(f => f.id !== id));
    };

    const closeEditor = () => {
        setFile(null);
        setPdfDoc(null);
        setTemplateFields([]);
        setTextItems([]);
        setTempSelection(null);
    };

    const handleSaveTemplate = () => {
        if (templateFields.length === 0) {
            alert("No puedes guardar una plantilla vacía. Selecciona texto en el documento para definir campos.");
            return;
        }

        setTemplateName(file?.name ? `Plantilla - ${file.name}` : "Nueva Plantilla");
        setShowSaveModal(true);
    };

    const confirmSave = () => {
        if (!templateName.trim()) return;
        console.log("Saving template:", { name: templateName, fields: templateFields });
        setShowSaveModal(false);
        alert(`Plantilla "${templateName}" guardada correctamente con ${templateFields.length} campos.`);
    };

    // --- BATCH PROCESSING LOGIC ---
    const openBatchModal = () => {
        if (templateFields.length === 0) {
            alert("Primero debes definir al menos un campo en la plantilla actual.");
            return;
        }
        setBatchFiles([]);
        setBatchResults([]);
        setProgress(0);
        setIsProcessing(false);
        setShowBatchModal(true);
    };

    const handleBatchFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setBatchFiles(Array.from(e.target.files));
        }
    };

    const runBatchProcessing = async () => {
        if (batchFiles.length === 0) return;

        setIsProcessing(true);
        setBatchResults([]);

        const results: BatchResult[] = [];

        for (let i = 0; i < batchFiles.length; i++) {
            setProgress(((i) / batchFiles.length) * 100);
            const currentFile = batchFiles[i];

            try {
                const arrayBuffer = await currentFile.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const doc = await loadingTask.promise;

                // Get First Page
                const page = await doc.getPage(1);
                // Use scale 1.0 for extraction consistency
                const viewport = page.getViewport({ scale: 1.0 });

                // Get Text
                const textContent = await page.getTextContent();
                const items: TextItem[] = textContent.items.map((item: any) => {
                    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                    return {
                        str: item.str,
                        x: tx[4],
                        y: tx[5] - item.height, // PDF coordinates to Canvas top-left logic
                        w: item.width,
                        h: item.height
                    };
                });

                // Extract Fields using Template
                const extractedData: Record<string, string> = {};
                templateFields.forEach(field => {
                    let value = processTextIntersection(items, field.bbox, viewport.width, viewport.height);

                    // Logic to strip field name from value (Field Label Redundancy Fix)
                    // Example: "Factura: 12345" -> "12345"
                    if (value.toLowerCase().startsWith(field.name.toLowerCase())) {
                        value = value.slice(field.name.length);
                        // Clean any leading colons or whitespace left
                        value = value.replace(/^[:\s]+/, '');
                    }

                    extractedData[field.name] = value;
                });

                results.push({
                    fileName: currentFile.name,
                    data: extractedData,
                    status: 'success'
                });

            } catch (error) {
                console.error(`Error processing ${currentFile.name}`, error);
                results.push({
                    fileName: currentFile.name,
                    data: {},
                    status: 'error'
                });
            }

            // Artificial delay for UI feel (optional)
            await new Promise(r => setTimeout(r, 100));
        }

        setProgress(100);
        setBatchResults(results);
        setIsProcessing(false);
    };

    const downloadCSV = () => {
        if (batchResults.length === 0) return;

        // Header
        const fieldNames = templateFields.map(f => f.name);
        const headers = ['Archivo', ...fieldNames, 'Estado'];

        // Rows
        const rows = batchResults.map(res => {
            const fieldValues = fieldNames.map(name => `"${(res.data[name] || '').replace(/"/g, '""')}"`);
            return [`"${res.fileName}"`, ...fieldValues, res.status].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `extraccion_lote_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- RENDER ---

    // 1. Dashboard View (No File)
    if (!file) {
        return (
            <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-hidden h-screen flex">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf"
                    onChange={handleFileChange}
                />



                <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-background-light dark:bg-background-dark">
                    <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-border-dark bg-white dark:bg-[#111a22] z-10 shrink-0">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Panel de Extracción</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleUploadClick}
                                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">add</span>
                                <span>Nuevo Documento</span>
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 p-6 overflow-y-auto">


                        <div className="mt-8">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Subir Documentos</h3>
                            <div
                                onClick={handleUploadClick}
                                className="border-2 border-dashed border-slate-300 dark:border-border-dark rounded-xl p-12 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer bg-white dark:bg-surface-dark/50 group"
                            >
                                <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Arrastra tu PDF aquí</h4>
                                <p className="text-sm text-slate-500 dark:text-text-secondary mt-2">Crear nueva plantilla de extracción</p>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
                                    className="mt-6 px-6 py-2 bg-white dark:bg-surface-dark border border-slate-300 dark:border-border-dark rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Seleccionar PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // 2. Editor View (File Loaded)
    return (
        <div className="bg-background-light dark:bg-background-dark h-screen flex flex-col overflow-hidden relative">
            {/* Editor Header */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-border-dark bg-[#111a22] shrink-0 text-white z-20">
                <div className="flex items-center gap-4">
                    <button onClick={closeEditor} className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-white">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-sm font-bold leading-tight">{file.name}</h2>
                        <p className="text-xs text-text-secondary">Editor de Plantillas</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-surface-dark rounded-lg p-1 border border-border-dark/50">
                        <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 hover:bg-white/10 rounded transition-colors text-text-secondary">
                            <span className="material-symbols-outlined text-[18px]">remove</span>
                        </button>
                        <span className="w-16 text-center text-xs font-mono font-medium">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(s => Math.min(2.0, s + 0.1))} className="p-1.5 hover:bg-white/10 rounded transition-colors text-text-secondary">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                    </div>
                    <button
                        onClick={openBatchModal}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-dark border border-border-dark hover:bg-[#233648] text-white text-sm font-bold rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">copy_all</span>
                        <span>Procesar Lote</span>
                    </button>
                    <button
                        onClick={handleSaveTemplate}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        <span>Guardar Plantilla</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* PDF Workspace */}
                <div className="flex-1 overflow-auto bg-slate-200/50 dark:bg-[#0d141b] relative flex justify-center p-8 custom-scrollbar">
                    <div
                        ref={containerRef}
                        className="relative shadow-2xl bg-white"
                        style={{ width: viewportDimensions.width, height: viewportDimensions.height }}
                        onMouseUp={handleTextSelection}
                    >
                        <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-white" />

                        {/* Text Layer (HTML) for Native Selection */}
                        <div className="absolute inset-0 z-10 cursor-text overflow-hidden">
                            {textItems.map((item, idx) => (
                                <span
                                    key={idx}
                                    style={{
                                        position: 'absolute',
                                        left: `${item.x}px`,
                                        top: `${item.y}px`,
                                        width: `${item.w}px`,
                                        height: `${item.h}px`,
                                        fontSize: `${item.h}px`,
                                        lineHeight: 1,
                                        color: 'transparent', // Hide text but keep selectable
                                        whiteSpace: 'nowrap',
                                        pointerEvents: 'auto',
                                        userSelect: 'text',
                                        cursor: 'text'
                                    }}
                                >
                                    {item.str}
                                </span>
                            ))}
                        </div>

                        {/* Temp Selection Button */}
                        {tempSelection && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${tempSelection.displayX + (tempSelection.width / 2)}px`,
                                    top: `${Math.max(0, tempSelection.displayY - 45)}px`,
                                    transform: 'translateX(-50%)',
                                    zIndex: 100
                                }}
                            >
                                <button
                                    onMouseDown={(e) => {
                                        // Critical: Prevent browser from clearing selection when clicking button
                                        e.preventDefault();
                                        e.stopPropagation();
                                        confirmFieldCreation();
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // Redundant backup call, but harmless if already handled in MouseDown
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded shadow-lg hover:bg-slate-800 transition-colors whitespace-nowrap animate-in fade-in zoom-in duration-200"
                                >
                                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                    Crear Campo
                                </button>
                                {/* Triangle arrow */}
                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 absolute left-1/2 -translate-x-1/2 -bottom-1.5"></div>
                            </div>
                        )}

                        {/* Overlay for Saved Fields (Non-interactive) */}
                        <div className="absolute inset-0 z-20 pointer-events-none">
                            {templateFields.map(field => (
                                <div
                                    key={field.id}
                                    className="absolute border-2 border-primary bg-primary/10 transition-colors group"
                                    style={{
                                        left: `${field.bbox.xmin}%`,
                                        top: `${field.bbox.ymin}%`,
                                        width: `${field.bbox.xmax - field.bbox.xmin}%`,
                                        height: `${field.bbox.ymax - field.bbox.ymin}%`
                                    }}
                                >
                                    <div className="absolute -top-6 left-0 bg-primary text-white text-[10px] px-2 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                                        {field.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar - Template Fields */}
                <div className="w-80 bg-white dark:bg-surface-dark border-l border-slate-200 dark:border-border-dark flex flex-col z-20 shadow-xl">
                    <div className="p-4 border-b border-slate-200 dark:border-border-dark">
                        <h3 className="font-bold text-slate-900 dark:text-white">Campos Definidos</h3>
                        <p className="text-xs text-slate-500 dark:text-text-secondary mt-1">
                            Selecciona texto en el PDF para añadir campos.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {templateFields.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 dark:text-text-secondary border-2 border-dashed border-slate-200 dark:border-border-dark/50 rounded-xl">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">text_fields</span>
                                <p className="text-sm">No hay campos definidos</p>
                            </div>
                        ) : (
                            templateFields.map((field, index) => (
                                <div key={field.id} className="bg-slate-50 dark:bg-[#111a22] rounded-lg border border-slate-200 dark:border-border-dark p-3 hover:border-primary/50 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                className="bg-transparent border-none p-0 text-xs font-bold text-slate-700 dark:text-text-secondary focus:ring-0 w-full placeholder-slate-400"
                                                value={field.name}
                                                onChange={(e) => {
                                                    const newName = e.target.value;
                                                    setTemplateFields(prev => {
                                                        const newFields = [...prev];
                                                        newFields[index] = { ...newFields[index], name: newName };
                                                        return newFields;
                                                    });
                                                }}
                                                placeholder="Nombre del campo"
                                            />
                                        </div>
                                        <button
                                            onClick={() => deleteField(field.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                    <div className="bg-white dark:bg-surface-dark p-2 rounded border border-slate-200 dark:border-border-dark">
                                        <p className="text-sm text-slate-900 dark:text-white break-words font-mono min-h-[1.25em]">
                                            {field.value || <span className="text-slate-300 dark:text-slate-600 italic">Vacío</span>}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Save Template Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-2xl w-96 border border-slate-200 dark:border-border-dark animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4 text-slate-900 dark:text-white">
                            <div className="p-2 bg-primary/10 rounded-full text-primary">
                                <span className="material-symbols-outlined">save</span>
                            </div>
                            <h3 className="text-lg font-bold">Guardar Plantilla</h3>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 dark:text-text-secondary uppercase mb-2">Nombre de la Plantilla</label>
                            <input
                                type="text"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-border-dark bg-slate-50 dark:bg-[#111a22] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-slate-400"
                                placeholder="Ej. Facturas Proveedor A"
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="px-4 py-2 text-slate-600 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmSave}
                                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg shadow-primary/25 transition-all"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Processing Modal */}
            {showBatchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-surface-dark w-full max-w-3xl rounded-xl shadow-2xl border border-slate-200 dark:border-border-dark flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-200 dark:border-border-dark flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <span className="material-symbols-outlined">copy_all</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Procesamiento por Lote</h3>
                                    <p className="text-xs text-slate-500 dark:text-text-secondary">Usa la plantilla actual para extraer datos de múltiples archivos.</p>
                                </div>
                            </div>
                            {!isProcessing && (
                                <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Step 1: File Selection */}
                            {batchFiles.length === 0 && (
                                <div className="border-2 border-dashed border-slate-300 dark:border-border-dark rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-primary/5 transition-all bg-slate-50 dark:bg-[#111a22]">
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf"
                                        ref={batchInputRef}
                                        onChange={handleBatchFiles}
                                        className="hidden"
                                    />
                                    <div className="size-14 rounded-full bg-slate-200 dark:bg-surface-dark flex items-center justify-center mb-4 text-slate-400">
                                        <span className="material-symbols-outlined text-3xl">upload_file</span>
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">Selecciona tus PDFs</h4>
                                    <p className="text-sm text-slate-500 dark:text-text-secondary mt-1 mb-4">Puedes subir múltiples archivos a la vez</p>
                                    <button
                                        onClick={() => batchInputRef.current?.click()}
                                        className="px-6 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg transition-colors"
                                    >
                                        Explorar Archivos
                                    </button>
                                </div>
                            )}

                            {/* Step 2 & 3: List & Progress */}
                            {batchFiles.length > 0 && (
                                <div className="flex flex-col gap-6">
                                    {isProcessing && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-white">
                                                <span>Procesando...</span>
                                                <span>{Math.round(progress)}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-200 dark:bg-border-dark rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary transition-all duration-300 ease-out"
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 dark:bg-[#111a22] rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-100 dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark">
                                                <tr>
                                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase">Archivo</th>
                                                    {templateFields.slice(0, 3).map(f => (
                                                        <th key={f.id} className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase">{f.name}</th>
                                                    ))}
                                                    {templateFields.length > 3 && <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase">...</th>}
                                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase text-right">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-border-dark">
                                                {(batchResults.length > 0 ? batchResults : batchFiles.map(f => ({ fileName: f.name, data: {}, status: 'pending' }))).map((item: any, idx) => (
                                                    <tr key={idx} className="bg-white dark:bg-[#111a22]">
                                                        <td className="py-3 px-4 text-sm text-slate-900 dark:text-white font-medium truncate max-w-[200px]">{item.fileName}</td>
                                                        {templateFields.slice(0, 3).map(f => (
                                                            <td key={f.id} className="py-3 px-4 text-sm text-slate-600 dark:text-text-secondary truncate max-w-[150px]">
                                                                {item.data ? item.data[f.name] || '-' : '-'}
                                                            </td>
                                                        ))}
                                                        {templateFields.length > 3 && <td className="py-3 px-4 text-sm text-slate-600 dark:text-text-secondary">-</td>}
                                                        <td className="py-3 px-4 text-right">
                                                            {item.status === 'success' ? (
                                                                <span className="text-green-500 font-bold text-xs flex items-center justify-end gap-1">
                                                                    <span className="material-symbols-outlined text-sm">check_circle</span> OK
                                                                </span>
                                                            ) : item.status === 'error' ? (
                                                                <span className="text-red-500 font-bold text-xs flex items-center justify-end gap-1">
                                                                    <span className="material-symbols-outlined text-sm">error</span> Error
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 font-medium text-xs">Pendiente</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-[#111a22] flex justify-between items-center">
                            {batchFiles.length > 0 ? (
                                <>
                                    <button
                                        onClick={() => { setBatchFiles([]); setBatchResults([]); }}
                                        className="text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white text-sm font-medium"
                                        disabled={isProcessing}
                                    >
                                        Limpiar selección
                                    </button>

                                    <div className="flex gap-3">
                                        {batchResults.length > 0 && !isProcessing ? (
                                            <button
                                                onClick={downloadCSV}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg shadow-green-600/20 transition-colors flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">download</span>
                                                Descargar CSV
                                            </button>
                                        ) : (
                                            !isProcessing && (
                                                <button
                                                    onClick={runBatchProcessing}
                                                    className="px-6 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-colors flex items-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                                    Procesar {batchFiles.length} Documentos
                                                </button>
                                            )
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 text-right">
                                    <button onClick={() => setShowBatchModal(false)} className="text-slate-500 dark:text-text-secondary font-medium">Cancelar</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExtractionScreen;