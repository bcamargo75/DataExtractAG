import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import * as pdfjsLib from 'pdfjs-dist';
import { ThemeToggle } from '../ThemeToggle';
import * as XLSX from 'xlsx';

import * as pdfAnalysis from '../utils/pdfTextAnalysis';

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
    type: 'simple';
}

interface TextItem {
    str: string;
    x: number;
    y: number;
    w: number;
    h: number;
    // adding compatible fields for util
    fontName?: string;
    hasEOL?: boolean;
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

interface SavedTemplate {
    id: string;
    name: string;
    version: number;
    definition: TemplateField[];
    pdf_assets: {
        storage_path: string;
        original_filename: string;
    };
}

const ExtractionScreen = () => {
    const { session, signOut } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

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
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
    const [livePreview, setLivePreview] = useState<string>(''); // Preview text in real-time

    const [viewportDimensions, setViewportDimensions] = useState({ width: 0, height: 0 });

    // Save Modal State
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Template List State
    const [templates, setTemplates] = useState<SavedTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);



    useEffect(() => {
        if (session?.user) {
            fetchTemplates();
        }
    }, [session]);

    const fetchTemplates = async () => {
        setLoadingTemplates(true);
        const { data, error } = await supabase
            .from('templates')
            .select('*, pdf_assets(storage_path, original_filename)')
            .eq('user_id', session!.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching templates:', error);
        } else {
            setTemplates(data || []);
        }
        setLoadingTemplates(false);
    };

    // Batch Processing State
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchFiles, setBatchFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [batchResults, setBatchResults] = useState<BatchResult[]>([]);

    // Preview & Export States (User Feedback Features)
    const [showPreview, setShowPreview] = useState(false);
    const [previewResult, setPreviewResult] = useState<BatchResult | null>(null);
    const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null); // Reference to the wrapper for coord calculation



    // --- UX: Escape Key to Cancel Selection ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectionStart) {
                    setSelectionStart(null);
                    setMousePos(null);
                }
                if (tempSelection) {
                    setTempSelection(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectionStart, tempSelection]);

    // --- LOGIC: Text Intersection (Used for extraction on new PDFs) ---
    const getTextItemsInBBox = (items: TextItem[], bbox: BBox, width: number, height: number): TextItem[] => {
        // Convert Percentage BBox to Pixel Rect for the specific page dimensions
        const canvasRect = {
            x: (bbox.xmin / 100) * width,
            y: (bbox.ymin / 100) * height,
            w: ((bbox.xmax - bbox.xmin) / 100) * width,
            h: ((bbox.ymax - bbox.ymin) / 100) * height
        };

        // STRICT bounds - NO tolerance to ensure 100% accuracy
        const bounds = {
            left: canvasRect.x,
            top: canvasRect.y,
            right: canvasRect.x + canvasRect.w,
            bottom: canvasRect.y + canvasRect.h
        };

        const extractedItems = items.filter(item => {
            // Text item boundaries
            const itemLeft = item.x;
            const itemRight = item.x + item.w;
            const itemTop = item.y;
            const itemBottom = item.y + item.h;

            // Check if rectangles INTERSECT (any overlap means include the text)
            const hasHorizontalOverlap = itemLeft < bounds.right && itemRight > bounds.left;
            const hasVerticalOverlap = itemTop < bounds.bottom && itemBottom > bounds.top;

            return hasHorizontalOverlap && hasVerticalOverlap;
        });

        // Sort items: mainly top to bottom, then left to right
        extractedItems.sort((a, b) => {
            const lineTolerance = (a.h || 10) / 2;
            if (Math.abs(a.y - b.y) < lineTolerance) {
                return a.x - b.x;
            }
            return a.y - b.y;
        });

        return extractedItems;
    };

    const processTextIntersection = (items: TextItem[], bbox: BBox, width: number, height: number): string => {
        const extractedItems = getTextItemsInBBox(items, bbox, width, height);
        return extractedItems
            .map(i => i.str)
            .filter(s => s.trim().length > 0)
            .join(' ')
            .trim();
    };



    // --- HELPERS: Preview Formatting ---
    const formatPreview = (text: string, maxChars: number = 200): string => {
        if (!text || text.length === 0) return 'Sin texto detectado';
        if (text.length <= maxChars) return text;
        return text.slice(0, maxChars) + '...';
    };

    const getPreviewStats = (text: string) => {
        const lines = text.split('\n').filter(l => l.trim().length > 0).length;
        const chars = text.length;
        return { lines, chars };
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
                setCurrentTemplateId(null);
                setTemplateName('');
                loadPdf(selectedFile);
            } else {
                alert("Por favor sube un archivo PDF para usar el editor de plantillas.");
            }
        }
    };

    // --- LOGIC: PDF Loading & Rendering ---
    const loadPdf = async (file: File, keepFields = false) => {
        const arrayBuffer = await file.arrayBuffer();
        try {
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const doc = await loadingTask.promise;
            setPdfDoc(doc);
            setPageNum(1);
            if (!keepFields) {
                setTemplateFields([]);
            }
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

    // --- Active Field State for Editing ---
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

    // --- LOGIC: Custom Click-to-Click Selection ---
    const handlePdfContainerClick = (e: React.MouseEvent) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (!selectionStart) {
            // First Click: Start Selection
            setSelectionStart({ x, y });
            setMousePos({ x, y });
            setTempSelection(null);

        } else {
            // Second Click: Finish Selection
            const xMin = Math.min(selectionStart.x, x);
            const xMax = Math.max(selectionStart.x, x);
            const yMin = Math.min(selectionStart.y, y);
            const yMax = Math.max(selectionStart.y, y);

            const width = xMax - xMin;
            const height = yMax - yMin;

            if (width < 5 || height < 5) {
                // Too small, reset
                setSelectionStart(null);
                setMousePos(null);
                setLivePreview('');
                return;
            }

            // Calculate BBox in percentages
            const bbox: BBox = {
                xmin: (xMin / viewportDimensions.width) * 100,
                ymin: (yMin / viewportDimensions.height) * 100,
                xmax: (xMax / viewportDimensions.width) * 100,
                ymax: (yMax / viewportDimensions.height) * 100
            };

            // Identify text within this box
            const text = processTextIntersection(textItems, bbox, viewportDimensions.width, viewportDimensions.height);

            setTempSelection({
                bbox,
                text: text || "Texto no detectado",
                displayX: xMin,
                displayY: yMin,
                width: width
            });

            // Reset selection state
            setSelectionStart(null);
            setMousePos(null);
            setLivePreview('');
        }
    };

                const handlePdfContainerMouseMove = (e: React.MouseEvent) => {
                    if (!selectionStart || !containerRef.current) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    const currentPos = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                    };
                    setMousePos(currentPos);

                    // Calculate live preview
                    if (viewportDimensions.width > 0 && viewportDimensions.height > 0) {
                        const xMin = Math.min(selectionStart.x, currentPos.x);
                        const xMax = Math.max(selectionStart.x, currentPos.x);
                        const yMin = Math.min(selectionStart.y, currentPos.y);
                        const yMax = Math.max(selectionStart.y, currentPos.y);

                        const bbox: BBox = {
                            xmin: (xMin / viewportDimensions.width) * 100,
                            ymin: (yMin / viewportDimensions.height) * 100,
                            xmax: (xMax / viewportDimensions.width) * 100,
                            ymax: (yMax / viewportDimensions.height) * 100
                        };

                        const preview = processTextIntersection(textItems, bbox, viewportDimensions.width, viewportDimensions.height);
                        setLivePreview(preview);
                    }
                };

                // Keep original handleTextSelection for legacy/fallback if needed, 
                // but we'll prioritize the new click flow.
                const handleTextSelection = () => {
                    // Native selection disabled in favour of click-to-click
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
                        value: tempSelection.text,
                        type: 'simple'
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
                    setCurrentTemplateId(null);
                    setTemplateName('');
                };

                const handleSaveTemplate = () => {
                    if (templateFields.length === 0) {
                        alert("No puedes guardar una plantilla vacía. Selecciona texto en el documento para definir campos.");
                        return;
                    }

                    // --- FREE PLAN LIMIT ENFORCEMENT ---
                    if (!currentTemplateId) {
                        checkTemplateLimitAndOpenModal();
                    } else {
                        // If we are updating, we just open the modal (no limit check needed)
                        setTemplateName(file?.name ? `Plantilla - ${file.name}` : "Nueva Plantilla");
                        setShowSaveModal(true);
                    }
                };

                const checkTemplateLimitAndOpenModal = async () => {
                    // setIsSaving(true); // Don't block UI for check
                    try {
                        const { count, error } = await supabase
                            .from('templates')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', session!.user.id);

                        if (error) throw error;

                        if (count !== null && count >= 1) {
                            alert("Plan Free: Solo puedes tener 1 plantilla activa.\n\nEdita la existente o elimina una para crear otra.");
                            return;
                        }

                        // Success
                        setTemplateName(file?.name ? `Plantilla - ${file.name}` : "Nueva Plantilla");
                        setShowSaveModal(true);
                    } catch (err) {
                        console.error("Error checking limits:", err);
                        alert("Error verificando límites del plan.");
                    }
                };

                const confirmSave = async () => {
                    if (!templateName.trim()) return;
                    if (!file || !session?.user) return;

                    setIsSaving(true);

                    try {
                        const user = session.user;

                        // 1. Sanitize Fields
                        const sanitizedFields = templateFields.map(f => ({
                            id: f.id,
                            name: f.name,
                            bbox: f.bbox,
                            value: f.value,
                            type: 'simple'
                        }));

                        // 2. Upload PDF
                        const pdfAssetId = crypto.randomUUID();
                        const path = `${user.id}/${pdfAssetId}.pdf`;

                        const { error: uploadError } = await supabase.storage
                            .from("template-pdfs")
                            .upload(path, file, {
                                contentType: "application/pdf",
                                upsert: true,
                            });

                        if (uploadError) throw new Error(`Error uploading PDF: ${uploadError.message}`);

                        // 3. Save to DB (Using Correct JSON Schema)
                        // First, insert into pdf_assets table
                        const { error: assetError } = await supabase.from("pdf_assets").insert({
                            id: pdfAssetId,
                            user_id: user.id,
                            storage_path: path,
                            original_filename: file.name,
                        });
                        if (assetError) throw new Error(`Error saving asset: ${assetError.message}`);

                        if (currentTemplateId) {
                            // UPDATE (Link to the new asset)
                            const { error: updateError } = await supabase
                                .from("templates")
                                .update({
                                    name: templateName,
                                    pdf_asset_id: pdfAssetId, // FK to pdf_assets table
                                    definition: sanitizedFields,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', currentTemplateId);

                            if (updateError) throw new Error(`Error updating template: ${updateError.message}`);

                        } else {
                            // INSERT
                            const { error: templateError } = await supabase.from("templates").insert({
                                user_id: user.id,
                                name: templateName,
                                pdf_asset_id: pdfAssetId, // FK to pdf_assets table
                                version: 1,
                                definition: sanitizedFields,
                            });
                            if (templateError) throw new Error(`Error creating template: ${templateError.message}`);
                        }

                        alert(`Plantilla "${templateName}" guardada correctamente.`);
                        setShowSaveModal(false);
                        setLoadingTemplates(true); // Trigger refresh
                        fetchTemplates();

                    } catch (error: any) {
                        console.error("Error saving template:", error);
                        alert(`Error al guardar: ${error.message || 'Error desconocido'}`);
                    } finally {
                        setIsSaving(false);
                    }
                };


                const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;

                    const { error } = await supabase.from('templates').delete().eq('id', id);
                    if (error) {
                        alert('Error al eliminar');
                    } else {
                        fetchTemplates();
                    }
                };

                const handleLoadTemplate = async (template: SavedTemplate, mode: 'edit' | 'batch') => {
                    try {
                        // Download PDF
                        const { data, error } = await supabase.storage
                            .from('template-pdfs')
                            .download(template.pdf_assets.storage_path);

                        if (error || !data) throw error || new Error("No data");

                        const file = new File([data], template.pdf_assets.original_filename, { type: 'application/pdf' });

                        // Set State
                        setFile(file);
                        setTemplateFields(template.definition);
                        setCurrentTemplateId(template.id);
                        setTemplateName(template.name);

                        // Load and Render
                        await loadPdf(file, true);

                        if (mode === 'batch') {
                            setTimeout(() => openBatchModal(), 500); // Small delay to ensure state is ready
                        }

                    } catch (error) {
                        console.error("Error loading template:", error);
                        alert("No se pudo cargar la plantilla (posiblemente el archivo fue borrado del storage).");
                    }
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
                        let files = Array.from(e.target.files);

                        // --- FREE PLAN LIMIT ENFORCEMENT ---
                        if (files.length > 10) {
                            alert("Plan Free: El límite es de 10 archivos por lote.\nSe seleccionarán solo los primeros 10.");
                            files = files.slice(0, 10);
                        }

                        setBatchFiles(files);
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
                                // Only apply for simple fields where the user might have selected the label too
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

                    // Generate filename with template name + YYYYMMDDHHMMSS
                    const now = new Date();
                    const timestamp = [
                        now.getFullYear(),
                        String(now.getMonth() + 1).padStart(2, '0'),
                        String(now.getDate()).padStart(2, '0'),
                        String(now.getHours()).padStart(2, '0'),
                        String(now.getMinutes()).padStart(2, '0'),
                        String(now.getSeconds()).padStart(2, '0')
                    ].join('');

                    // Sanitize template name for filename (remove special characters)
                    const safeTemplateName = (templateName || 'extraccion').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '').replace(/\s+/g, '_');
                    const filename = `${safeTemplateName}_${timestamp}.csv`;

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', filename);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                };

                // Excel Export (User Feedback Request)
                const downloadXLSX = () => {
                    if (batchResults.length === 0) return;

                    const fieldNames = templateFields.map(f => f.name);

                    // Create worksheet data
                    const wsData = [
                        ['Archivo', ...fieldNames, 'Estado'],
                        ...batchResults.map(res => [
                            res.fileName,
                            ...fieldNames.map(name => res.data[name] || ''),
                            res.status
                        ])
                    ];

                    // Create workbook and worksheet
                    const wb = XLSX.utils.book_new();
                    const ws = XLSX.utils.aoa_to_sheet(wsData);

                    // Auto-fit column widths
                    const colWidths = wsData[0].map((_, i) => ({
                        wch: Math.max(...wsData.map(row => String(row[i] || '').length)) + 2
                    }));
                    ws['!cols'] = colWidths;

                    XLSX.utils.book_append_sheet(wb, ws, 'Extracción');

                    // Generate filename with template name + YYYYMMDDHHMMSS
                    const now = new Date();
                    const timestamp = [
                        now.getFullYear(),
                        String(now.getMonth() + 1).padStart(2, '0'),
                        String(now.getDate()).padStart(2, '0'),
                        String(now.getHours()).padStart(2, '0'),
                        String(now.getMinutes()).padStart(2, '0'),
                        String(now.getSeconds()).padStart(2, '0')
                    ].join('');

                    // Sanitize template name for filename (remove special characters)
                    const safeTemplateName = (templateName || 'extraccion').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '').replace(/\s+/g, '_');
                    const filename = `${safeTemplateName}_${timestamp}.xlsx`;

                    // Download
                    XLSX.writeFile(wb, filename);
                };

                // Preview Processing (User Feedback Request - Carlos Alberto)
                const runPreviewProcessing = async () => {
                    if (batchFiles.length === 0) return;

                    const firstFile = batchFiles[0];

                    try {
                        const arrayBuffer = await firstFile.arrayBuffer();
                        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                        const doc = await loadingTask.promise;

                        const page = await doc.getPage(1);
                        const viewport = page.getViewport({ scale: 1.0 });

                        const textContent = await page.getTextContent();
                        const items: TextItem[] = textContent.items.map((item: any) => {
                            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                            return {
                                str: item.str,
                                x: tx[4],
                                y: tx[5] - item.height,
                                w: item.width,
                                h: item.height
                            };
                        });

                        // Extract Fields using Template
                        const extractedData: Record<string, string> = {};
                        templateFields.forEach(field => {
                            let value = processTextIntersection(items, field.bbox, viewport.width, viewport.height);

                            if (value.toLowerCase().startsWith(field.name.toLowerCase())) {
                                value = value.slice(field.name.length);
                                value = value.replace(/^[:\s]+/, '');
                            }

                            extractedData[field.name] = value;
                        });

                        setPreviewResult({
                            fileName: firstFile.name,
                            data: extractedData,
                            status: 'success'
                        });
                        setShowPreview(true);

                    } catch (error) {
                        console.error('Preview error:', error);
                        setPreviewResult({
                            fileName: firstFile.name,
                            data: {},
                            status: 'error'
                        });
                        setShowPreview(true);
                    }
                };

                // Download handler that routes to correct format
                const handleDownload = () => {
                    if (exportFormat === 'xlsx') {
                        downloadXLSX();
                    } else {
                        downloadCSV();
                    }
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
                                    <div className="flex items-center gap-4">
                                        {/* User Profile */}
                                        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark">
                                            {session?.user?.user_metadata?.avatar_url && (
                                                <img
                                                    src={session.user.user_metadata.avatar_url}
                                                    alt="Avatar"
                                                    className="size-8 rounded-full border border-slate-300 dark:border-slate-600"
                                                />
                                            )}
                                            <div className="hidden sm:block text-right">
                                                <p className="text-xs font-bold text-slate-700 dark:text-white leading-none">
                                                    {session?.user?.user_metadata?.full_name || session?.user?.email}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-text-secondary leading-none mt-1">Usuario</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center justify-center size-9 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Cerrar Sesión"
                                        >
                                            <span className="material-symbols-outlined">logout</span>
                                        </button>

                                        <div className="h-6 w-px bg-slate-200 dark:bg-border-dark mx-1"></div>

                                        <button
                                            onClick={handleUploadClick}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">add</span>
                                            <span>Nuevo</span>
                                        </button>
                                    </div>
                                </header>

                                <div className="flex-1 p-6 overflow-y-auto">


                                    <div className="mt-8">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Mis Plantillas</h3>

                                        {loadingTemplates ? (
                                            <div className="text-center py-8 text-slate-500">Cargando plantillas...</div>
                                        ) : templates.length === 0 ? (
                                            <div className="text-center py-8 bg-slate-50 dark:bg-surface-dark border border-dashed border-slate-200 dark:border-border-dark rounded-xl text-slate-500">
                                                No tienes plantillas guardadas. Sube un documento para comenzar.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {templates.map(tpl => (
                                                    <div key={tpl.id} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group relative">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                                                    <span className="material-symbols-outlined">description</span>
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-bold text-slate-900 dark:text-white leading-tight">{tpl.name}</h4>
                                                                    <p className="text-xs text-slate-500 dark:text-text-secondary truncate max-w-[150px]" title={tpl.pdf_assets?.original_filename}>
                                                                        {tpl.pdf_assets?.original_filename || "Sin archivo"}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[180px]">
                                                                        {tpl.definition?.length || 0} campos: {tpl.definition?.map(f => f.name).join(', ') || 'Sin campos'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded transition-colors"
                                                                    title="Eliminar"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 flex gap-2">
                                                            <button
                                                                onClick={() => handleLoadTemplate(tpl, 'edit')}
                                                                className="flex-1 py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                                Editar / Usar Plantilla
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                    </div>

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
                        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-border-dark bg-white dark:bg-[#111a22] shrink-0 z-20 transition-colors">
                            <div className="flex items-center gap-4 text-slate-900 dark:text-white">
                                <button onClick={closeEditor} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500 dark:text-text-secondary">
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>
                                <div>
                                    <h2 className="text-sm font-bold leading-tight">{file.name}</h2>
                                    <p className="text-xs text-slate-500 dark:text-text-secondary">Editor de Plantillas</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <ThemeToggle />
                                {/* User Profile Mini */}
                                <div className="flex items-center gap-2 mr-2 opacity-80 hover:opacity-100 transition-opacity text-slate-900 dark:text-white">
                                    {session?.user?.user_metadata?.avatar_url && (
                                        <img
                                            src={session.user.user_metadata.avatar_url}
                                            alt="Avatar"
                                            className="size-7 rounded-full border border-slate-600"
                                        />
                                    )}
                                    <span className="text-xs font-bold hidden xl:block max-w-[100px] truncate">
                                        {session?.user?.user_metadata?.full_name?.split(' ')[0]}
                                    </span>
                                    <button
                                        onClick={handleLogout}
                                        className="text-slate-400 hover:text-red-400 ml-1"
                                        title="Cerrar Sesión"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">logout</span>
                                    </button>
                                </div>

                                <div className="h-6 w-px bg-white/10 mx-1"></div>



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
                                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-dark border border-border-dark hover:bg-[#233648] text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">copy_all</span>
                                    <span className="hidden lg:inline">Lote</span>
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">save</span>
                                    <span className="hidden lg:inline">Guardar</span>
                                </button>
                            </div>
                        </header>



                        <div className="flex-1 flex overflow-hidden">
                            {/* PDF Workspace */}
                            <div
                                className="flex-1 overflow-auto bg-slate-200/50 dark:bg-[#0d141b] relative flex justify-center p-8 custom-scrollbar"
                                onMouseDown={(e) => {
                                    // Deselect if clicking outside the PDF container
                                    if (e.target === e.currentTarget) {
                                        setSelectionStart(null);
                                        setMousePos(null);
                                        setTempSelection(null);
                                    }
                                }}
                            >
                                <div
                                    ref={containerRef}
                                    className={`relative shadow-2xl bg-white select-none ${selectionStart ? 'cursor-crosshair' : ''}`}
                                    style={{ width: viewportDimensions.width, height: viewportDimensions.height }}
                                    onClick={handlePdfContainerClick}
                                    onMouseMove={handlePdfContainerMouseMove}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        // Right-click cancels selection
                                        if (selectionStart) {
                                            setSelectionStart(null);
                                            setMousePos(null);
                                        }
                                        if (tempSelection) {
                                            setTempSelection(null);
                                        }
                                    }}
                                >
                                    <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-white pointer-events-none" />

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

                                    {/* Click-to-Click Preview Overlay */}
                                    {selectionStart && mousePos && (() => {
                                        const xMin = Math.min(selectionStart.x, mousePos.x);
                                        const xMax = Math.max(selectionStart.x, mousePos.x);
                                        const yMin = Math.min(selectionStart.y, mousePos.y);
                                        const yMax = Math.max(selectionStart.y, mousePos.y);

                                        const previewBBox = {
                                            xmin: (xMin / viewportDimensions.width) * 100,
                                            ymin: (yMin / viewportDimensions.height) * 100,
                                            xmax: (xMax / viewportDimensions.width) * 100,
                                            ymax: (yMax / viewportDimensions.height) * 100
                                        };

                                        const itemsInSelection = getTextItemsInBBox(textItems, previewBBox, viewportDimensions.width, viewportDimensions.height);

                                        return (
                                            <div className="absolute inset-0 pointer-events-none z-40">
                                                {/* Subtle bounding box for context */}
                                                <div
                                                    className="absolute border border-primary/30 border-dashed bg-primary/5"
                                                    style={{ left: xMin, top: yMin, width: xMax - xMin, height: yMax - yMin }}
                                                />
                                                {/* Text Highlights */}
                                                {itemsInSelection.map((item, idx) => (
                                                    <div
                                                        key={`preview-item-${idx}`}
                                                        className="absolute bg-primary/40 rounded-sm"
                                                        style={{
                                                            left: item.x - 1,
                                                            top: item.y - 1,
                                                            width: item.w + 2,
                                                            height: item.h + 2
                                                        }}
                                                    />
                                                ))}

                                                {/* Start Point Marker */}
                                                <div
                                                    className="absolute w-4 h-4 -ml-2 -mt-2 bg-primary rounded-full animate-pulse ring-4 ring-primary/30 shadow-lg z-50"
                                                    style={{ left: selectionStart.x, top: selectionStart.y }}
                                                />

                                                {/* Live Preview Tooltip */}
                                                <div
                                                    className="absolute pointer-events-none z-50 animate-fade-in-up"
                                                    style={{ left: mousePos.x + 15, top: mousePos.y - 80 }}
                                                >
                                                    <div className="bg-slate-900 text-white text-xs rounded-lg shadow-2xl overflow-hidden max-w-md">
                                                        <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[14px] text-primary">search</span>
                                                            <span className="font-bold">Preview</span>
                                                        </div>
                                                        <div className="px-3 py-2 max-h-24 overflow-y-auto">
                                                            <p className="text-xs leading-relaxed">
                                                                {formatPreview(livePreview, 100)}
                                                            </p>
                                                        </div>
                                                        <div className="px-2 py-1 bg-slate-800/50 text-[10px] text-slate-400 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">mouse</span>
                                                            Click para confirmar
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Enhanced Field Selection Menu - 2026 Design */}
                                    {tempSelection && (
                                        <>
                                            {/* Selection Highlight Overlay */}
                                            <div
                                                className="absolute pointer-events-none z-30"
                                                style={{
                                                    left: `${tempSelection.bbox.xmin}%`,
                                                    top: `${tempSelection.bbox.ymin}%`,
                                                    width: `${tempSelection.bbox.xmax - tempSelection.bbox.xmin}%`,
                                                    height: `${tempSelection.bbox.ymax - tempSelection.bbox.ymin}%`
                                                }}
                                            >
                                                <div className="w-full h-full border-2 border-dashed border-primary animate-pulse bg-primary/10 rounded"></div>
                                            </div>

                                            {/* Floating Selection Menu */}
                                            <div
                                                className="animate-fade-in-up"
                                                style={{
                                                    position: 'absolute',
                                                    left: `${Math.min(Math.max(tempSelection.displayX + (tempSelection.width / 2), 160), viewportDimensions.width - 160)}px`,
                                                    top: `${Math.max(10, tempSelection.displayY - 140)}px`,
                                                    transform: 'translateX(-50%)',
                                                    zIndex: 100
                                                }}
                                            >
                                                {/* Glassmorphism Container */}
                                                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 p-4 min-w-[320px]">
                                                    {/* Header */}
                                                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700/50">
                                                        <div className="p-1.5 bg-primary/10 rounded-lg">
                                                            <span className="material-symbols-outlined text-primary text-[18px]">
                                                                add_box
                                                            </span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                                                                Crear Campo de Extracción
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                                                "{tempSelection.text.slice(0, 30)}{tempSelection.text.length > 30 ? '...' : ''}"
                                                            </p>
                                                        </div>
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); setTempSelection(null); window.getSelection()?.removeAllRanges(); }}
                                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                                        </button>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <button
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            confirmFieldCreation();
                                                        }}
                                                        className="w-full py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">crop_free</span>
                                                        Crear Campo
                                                    </button>

                                                    {/* Keyboard Shortcuts Hint */}
                                                    <div className="mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/30 flex items-center justify-center gap-4 text-[9px] text-slate-400">
                                                        <span>💡 Selecciona texto para crear campos</span>
                                                    </div>
                                                </div>

                                                {/* Arrow pointer */}
                                                <div className="flex justify-center mt-1">
                                                    <div className="w-3 h-3 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-700/50 transform rotate-45 -mt-2 shadow-lg"></div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Overlay for Saved Fields (Non-interactive) */}
                                    <div className="absolute inset-0 z-20 pointer-events-none">
                                        {/* 1. Field Headers (The visible boxes showing field names) */}
                                        {templateFields.map(field => {
                                            const itemsInField = getTextItemsInBBox(textItems, field.bbox, viewportDimensions.width, viewportDimensions.height);

                                            return (
                                                <div key={field.id} className="group">
                                                    {/* Text Highlights for the field - NO BORDER */}
                                                    {itemsInField.map((item, idx) => (
                                                        <div
                                                            key={`${field.id}-item-${idx}`}
                                                            className="absolute rounded-sm transition-all duration-300 bg-primary/30"
                                                            style={{
                                                                left: item.x,
                                                                top: item.y,
                                                                width: item.w,
                                                                height: item.h
                                                            }}
                                                        />
                                                    ))}

                                                    {/* Hover Label - appears on first highlight */}
                                                    {itemsInField.length > 0 && (
                                                        <div
                                                            className="absolute text-white text-[10px] px-2 py-0.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-30 flex items-center gap-1 bg-gradient-to-r from-primary to-blue-600"
                                                            style={{
                                                                left: itemsInField[0].x,
                                                                top: itemsInField[0].y - 20
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]">crop_free</span>
                                                            {field.name}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}


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
                        {
                            showSaveModal && (
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
                                                disabled={isSaving}
                                                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {isSaving && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                                                {isSaving ? "Guardando..." : "Guardar"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }

                        {/* Batch Processing Modal */}
                        {
                            showBatchModal && (
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
                                                    {/* Preview Step - Show extraction result for first file */}
                                                    {showPreview && previewResult && (
                                                        <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10 rounded-xl border border-primary/20">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="material-symbols-outlined text-primary">preview</span>
                                                                <h4 className="font-bold text-slate-900 dark:text-white">Vista Previa: {previewResult.fileName}</h4>
                                                                {previewResult.status === 'success' ? (
                                                                    <span className="ml-auto px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold rounded-full">Extracción OK</span>
                                                                ) : (
                                                                    <span className="ml-auto px-2 py-0.5 bg-red-500/10 text-red-500 text-xs font-bold rounded-full">Error</span>
                                                                )}
                                                            </div>
                                                            <div className="space-y-2">
                                                                {templateFields.map(field => (
                                                                    <div key={field.id} className="flex items-start gap-3 text-sm">
                                                                        <span className="text-slate-500 dark:text-text-secondary font-medium min-w-[120px] shrink-0">{field.name}:</span>
                                                                        <span className="text-slate-900 dark:text-white font-mono bg-white dark:bg-surface-dark px-2 py-0.5 rounded border border-slate-200 dark:border-border-dark flex-1">
                                                                            {previewResult.data[field.name] || <span className="text-slate-400 italic">Sin datos</span>}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <p className="mt-3 text-xs text-slate-500 dark:text-text-secondary">
                                                                {previewResult.status === 'success'
                                                                    ? '✓ La extracción parece correcta. Puedes procesar todos los archivos.'
                                                                    : '⚠️ Hubo un error. Revisa tu plantilla o los archivos seleccionados.'}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-6 border-t border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-[#111a22] flex justify-between items-center">
                                            {batchFiles.length > 0 ? (
                                                <>
                                                    <button
                                                        onClick={() => { setBatchFiles([]); setBatchResults([]); setShowPreview(false); setPreviewResult(null); }}
                                                        className="text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white text-sm font-medium"
                                                        disabled={isProcessing}
                                                    >
                                                        Limpiar selección
                                                    </button>

                                                    <div className="flex items-center gap-3">
                                                        {batchResults.length > 0 && !isProcessing ? (
                                                            <>
                                                                {/* Export Format Toggle */}
                                                                <div className="flex items-center bg-slate-200 dark:bg-surface-dark rounded-lg p-1 border border-slate-300 dark:border-border-dark">
                                                                    <button
                                                                        onClick={() => setExportFormat('csv')}
                                                                        className={`px-3 py-1 text-xs font-bold rounded transition-all ${exportFormat === 'csv' ? 'bg-white dark:bg-primary text-slate-900 dark:text-white shadow' : 'text-slate-500 dark:text-text-secondary hover:text-slate-700'}`}
                                                                    >
                                                                        CSV
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setExportFormat('xlsx')}
                                                                        className={`px-3 py-1 text-xs font-bold rounded transition-all ${exportFormat === 'xlsx' ? 'bg-white dark:bg-primary text-slate-900 dark:text-white shadow' : 'text-slate-500 dark:text-text-secondary hover:text-slate-700'}`}
                                                                    >
                                                                        Excel
                                                                    </button>
                                                                </div>
                                                                <button
                                                                    onClick={handleDownload}
                                                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg shadow-green-600/20 transition-colors flex items-center gap-2"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                                                    Descargar {exportFormat === 'xlsx' ? 'Excel' : 'CSV'}
                                                                </button>
                                                            </>
                                                        ) : !isProcessing && (
                                                            <>
                                                                {!showPreview ? (
                                                                    <button
                                                                        onClick={runPreviewProcessing}
                                                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg shadow-purple-600/20 transition-colors flex items-center gap-2"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[18px]">preview</span>
                                                                        Vista Previa
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => { setShowPreview(false); setPreviewResult(null); }}
                                                                        className="px-3 py-2 text-slate-500 dark:text-text-secondary hover:text-slate-700 dark:hover:text-white font-medium text-sm"
                                                                    >
                                                                        Volver
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={runBatchProcessing}
                                                                    className="px-6 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-colors flex items-center gap-2"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                                                    Procesar {batchFiles.length} Documentos
                                                                </button>
                                                            </>
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
                            )
                        }
                    </div >
                );
            };

            export default ExtractionScreen;