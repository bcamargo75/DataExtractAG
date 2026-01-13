import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const LandingScreen = () => {
    const navigate = useNavigate();

    const enterDemoMode = () => {
        localStorage.setItem('is_demo_mode', 'true');
        // Optional: Reset counters on fresh entry if needed, 
        // but keeping history is better for testing limits unless explicitly reset.
        if (!localStorage.getItem('demo_pdf_count')) {
            localStorage.setItem('demo_pdf_count', '0');
        }
        navigate('/app');
    };

    return (
        <div className="h-screen overflow-y-auto bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display flex flex-col scroll-smooth">
            
            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-white/80 dark:bg-[#111a22]/80 backdrop-blur-md border-b border-slate-200 dark:border-border-dark">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2">
                            <div className="bg-center bg-no-repeat bg-cover rounded-full size-8 bg-primary/20 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-xl">dataset</span>
                            </div>
                            <span className="font-bold text-lg tracking-tight">DataExtract</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-sm font-medium text-slate-600 dark:text-text-secondary hover:text-primary transition-colors">
                                Ingresar
                            </Link>
                            <Link to="/register" className="px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold transition-colors shadow-lg shadow-primary/20">
                                Registrarme
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-40 pb-80 md:pt-48 md:pb-96 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none opacity-30 dark:opacity-20 z-0">
                     <div className="absolute top-20 left-20 w-72 h-72 bg-primary rounded-full filter blur-[100px]"></div>
                     <div className="absolute bottom-20 right-20 w-72 h-72 bg-purple-500 rounded-full filter blur-[100px]"></div>
                </div>

                <div className="max-w-4xl mx-auto text-center relative z-30">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8 leading-tight">
                        Extrae datos de documentos <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500 pb-2 inline-block">
                            en segundos
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 dark:text-text-secondary mb-12 max-w-2xl mx-auto leading-relaxed">
                        Automatiza la entrada de datos, elimina errores manuales y procesa lotes de PDFs con plantillas inteligentes personalizables.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pb-4">
                        <button onClick={enterDemoMode} className="w-full sm:w-auto px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg transition-all shadow-xl shadow-amber-500/25 transform hover:-translate-y-1 flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined">science</span>
                            Probar Demo
                        </button>
                        <Link to="/register" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary hover:bg-blue-600 text-white font-bold text-lg transition-all shadow-xl shadow-primary/25 transform hover:-translate-y-1">
                            Comenzar Gratis
                        </Link>
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="pt-32 pb-20 bg-slate-50 dark:bg-[#0d141b] relative z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">¿Cómo funciona?</h2>
                        <p className="text-slate-500 dark:text-text-secondary">Simplifica tu flujo de trabajo en 3 pasos sencillos</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Step 1 */}
                        <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark relative group hover:border-primary/50 transition-colors">
                            <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 text-2xl font-bold">1</div>
                            <h3 className="text-lg font-bold mb-2">Subí un PDF de ejemplo</h3>
                            <p className="text-sm text-slate-500 dark:text-text-secondary">
                                Cargá un documento modelo para definir qué información querés capturar.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark relative group hover:border-primary/50 transition-colors">
                            <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 text-2xl font-bold">2</div>
                            <h3 className="text-lg font-bold mb-2">Definí y guardá tu plantilla</h3>
                            <p className="text-sm text-slate-500 dark:text-text-secondary">
                                Marcá los campos en el documento, poneles nombre y guardá la plantilla para reutilizarla.
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark relative group hover:border-primary/50 transition-colors">
                            <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 text-2xl font-bold">3</div>
                            <h3 className="text-lg font-bold mb-2">Procesá tus PDFs</h3>
                            <p className="text-sm text-slate-500 dark:text-text-secondary">
                                Subí uno o varios PDFs, aplicá la plantilla y obtené los datos listos para revisar o exportar.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits */}
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="col-span-1 lg:col-span-1">
                            <h2 className="text-3xl font-bold mb-6">¿Por qué elegir DataExtract?</h2>
                            <p className="text-slate-500 dark:text-text-secondary mb-8 leading-relaxed">
                                Deja de perder tiempo transcribiendo datos manualmente. Nuestra herramienta te permite organizar tus documentos de manera eficiente.
                            </p>
                            <Link to="/register" className="inline-flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all">
                                Empieza ahora <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </Link>
                        </div>
                        <div className="col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex gap-4 items-start">
                                <div className="p-3 rounded-lg bg-green-500/10 text-green-500 shrink-0">
                                    <span className="material-symbols-outlined">check_circle</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-1">Reduce carga manual</h3>
                                    <p className="text-sm text-slate-500 dark:text-text-secondary">Minimiza los errores de transcripción manual.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                                    <span className="material-symbols-outlined">rule</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-1">Estandarizá datos</h3>
                                    <p className="text-sm text-slate-500 dark:text-text-secondary">Captura la información siempre de la misma forma.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500 shrink-0">
                                    <span className="material-symbols-outlined">copy_all</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-1">Procesamiento por lotes</h3>
                                    <p className="text-sm text-slate-500 dark:text-text-secondary">Sube carpetas enteras y procesa todo de una vez.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="p-3 rounded-lg bg-orange-500/10 text-orange-500 shrink-0">
                                    <span className="material-symbols-outlined">download</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-1">Resultados listos</h3>
                                    <p className="text-sm text-slate-500 dark:text-text-secondary">Descarga la información estructurada lista para usar.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-20 bg-slate-50 dark:bg-[#0d141b]">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12">Preguntas Frecuentes</h2>
                    <div className="space-y-4">
                        <details className="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl overflow-hidden">
                            <summary className="flex items-center justify-between p-4 cursor-pointer font-medium select-none">
                                ¿Funciona con cualquier PDF?
                                <span className="material-symbols-outlined transition-transform group-open:rotate-180">expand_more</span>
                            </summary>
                            <div className="px-4 pb-4 text-slate-500 dark:text-text-secondary text-sm">
                                Sí, siempre y cuando el PDF tenga texto seleccionable (no sea una imagen plana). Para imágenes escaneadas, estamos trabajando en mejoras de reconocimiento.
                            </div>
                        </details>
                        <details className="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl overflow-hidden">
                            <summary className="flex items-center justify-between p-4 cursor-pointer font-medium select-none">
                                ¿Qué pasa si cambia el formato de mi factura?
                                <span className="material-symbols-outlined transition-transform group-open:rotate-180">expand_more</span>
                            </summary>
                            <div className="px-4 pb-4 text-slate-500 dark:text-text-secondary text-sm">
                                Si el diseño cambia drásticamente, solo necesitas crear una nueva plantilla o ajustar la existente en segundos.
                            </div>
                        </details>
                        <details className="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl overflow-hidden">
                            <summary className="flex items-center justify-between p-4 cursor-pointer font-medium select-none">
                                ¿Mis archivos se guardan en la nube?
                                <span className="material-symbols-outlined transition-transform group-open:rotate-180">expand_more</span>
                            </summary>
                            <div className="px-4 pb-4 text-slate-500 dark:text-text-secondary text-sm">
                                Los archivos se procesan localmente en tu navegador para máxima privacidad y solo se guardan metadatos esenciales si decides usar nuestra nube segura.
                            </div>
                        </details>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white dark:bg-[#111a22] border-t border-slate-200 dark:border-border-dark py-12 px-4">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                         <div className="bg-center bg-no-repeat bg-cover rounded-full size-6 bg-primary/20 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-sm">dataset</span>
                        </div>
                        <span className="font-bold text-slate-700 dark:text-white">DataExtract</span>
                    </div>
                    <div className="flex gap-6 text-sm text-slate-500 dark:text-text-secondary">
                        <a href="#" className="hover:text-primary transition-colors">Términos de Servicio</a>
                        <a href="#" className="hover:text-primary transition-colors">Política de Privacidad</a>
                        <a href="#" className="hover:text-primary transition-colors">Soporte</a>
                    </div>
                    <div className="text-sm text-slate-400">
                        © 2024 DataExtract. Todos los derechos reservados.
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingScreen;