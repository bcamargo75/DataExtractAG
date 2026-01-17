import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { ThemeToggle } from '../ThemeToggle'; // Import Toggle

const LandingScreen = () => {
    const { session, signOut } = useAuth();
    const navigate = useNavigate();

    const enterDemoMode = () => {
        if (session) {
            navigate('/app');
        } else {
            navigate('/login');
        }
    };

    const handleLogout = async () => {
        await signOut();
    };

    // Redirect to App if logged in
    React.useEffect(() => {
        if (session) {
            navigate('/app');
        }
    }, [session, navigate]);



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
                            <ThemeToggle /> {/* Add Toggle */}
                            {session ? (
                                <div className="flex items-center gap-4 animate-in fade-in duration-300">
                                    <Link to="/app" className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark hover:border-primary/50 transition-colors">
                                        {session?.user?.user_metadata?.avatar_url && (
                                            <img
                                                src={session.user.user_metadata.avatar_url}
                                                alt="Avatar"
                                                className="size-8 rounded-full border border-slate-300 dark:border-slate-600"
                                            />
                                        )}
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-700 dark:text-white leading-none">
                                                {session?.user?.user_metadata?.full_name || session?.user?.email}
                                            </p>
                                        </div>
                                    </Link>

                                    <button
                                        onClick={handleLogout}
                                        className="text-sm font-bold text-slate-500 hover:text-red-500 transition-colors"
                                    >
                                        Salir
                                    </button>

                                    <Link
                                        to="/app"
                                        className="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-primary/20"
                                    >
                                        Ir a la App
                                    </Link>
                                </div>
                            ) : (
                                <Link
                                    to="/login"
                                    className="text-sm font-bold text-slate-700 dark:text-white hover:text-primary transition-colors"
                                >
                                    Ingresar
                                </Link>
                            )}
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
                        <button onClick={enterDemoMode} className="w-full sm:w-auto px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg transition-all shadow-xl shadow-orange-500/25 transform hover:-translate-y-1 flex items-center justify-center gap-2">
                            Comenzar
                        </button>
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
                            {/* Link removed per request */}
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

            {/* Pricing Section */}
            <section className="py-20 bg-white dark:bg-[#111a22] border-t border-slate-100 dark:border-border-dark/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Planes y Precios</h2>
                        <p className="text-slate-500 dark:text-text-secondary max-w-2xl mx-auto">
                            Elige el plan que mejor se adapte a tus necesidades de extracción de datos.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Plan Free (Active) */}
                        <div className="relative p-8 bg-white dark:bg-surface-dark rounded-2xl border-2 border-primary/20 shadow-xl hover:-translate-y-1 transition-transform duration-300">
                            <div className="absolute top-0 right-0 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-lg">
                                ACTIVO
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Free</h3>
                            <div className="text-4xl font-black text-slate-900 dark:text-white mb-6">
                                $0 <span className="text-base font-normal text-slate-500">/mes</span>
                            </div>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-slate-700 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-green-500 text-[20px]">check</span>
                                    <span>1 Plantilla activa</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-green-500 text-[20px]">check</span>
                                    <span>Lotes de hasta 5 PDFs</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-green-500 text-[20px]">check</span>
                                    <span>Extracción Básica</span>
                                </li>
                            </ul>

                            <button
                                onClick={enterDemoMode}
                                className="w-full py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-primary/20"
                            >
                                Comenzar Gratis
                            </button>
                        </div>

                        {/* Plan Pro (Popular) */}
                        <div className="relative p-8 bg-gradient-to-br from-primary/5 to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10 rounded-2xl border-2 border-primary shadow-xl hover:-translate-y-1 transition-transform duration-300 ring-2 ring-primary/20">
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-purple-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl rounded-tr-xl">
                                ⭐ POPULAR
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Pro</h3>
                            <div className="text-4xl font-black text-slate-900 dark:text-white mb-6">
                                $15 <span className="text-base font-normal text-slate-500">/mes</span>
                            </div>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-slate-700 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-green-500 text-[20px]">check</span>
                                    <span><strong>5 Plantillas</strong> activas</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-green-500 text-[20px]">check</span>
                                    <span>Lotes de hasta <strong>20 PDFs</strong></span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-green-500 text-[20px]">check</span>
                                    <span>Exportación Excel + CSV</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-700 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-green-500 text-[20px]">check</span>
                                    <span>Soporte Prioritario</span>
                                </li>
                            </ul>

                            <button
                                disabled
                                className="w-full py-3 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/30 cursor-not-allowed opacity-75"
                            >
                                Próximamente
                            </button>
                        </div>

                        {/* Plan Enterprise (Coming Soon) */}
                        <div className="relative p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-border-dark opacity-75 grayscale-[0.5]">
                            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-10">
                                <span className="bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">En Construcción</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Enterprise</h3>
                            <div className="text-2xl font-black text-slate-900 dark:text-white mb-6 pt-3">
                                Contactar
                            </div>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-slate-600 dark:text-gray-400">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">check</span>
                                    <span>API Access</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-600 dark:text-gray-400">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">check</span>
                                    <span>Integraciones Custom</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-600 dark:text-gray-400">
                                    <span className="material-symbols-outlined text-slate-400 text-[20px]">check</span>
                                    <span>SLA Garantizado</span>
                                </li>
                            </ul>

                            <button disabled className="w-full py-3 bg-slate-200 dark:bg-slate-800 text-slate-400 font-bold rounded-xl cursor-not-allowed">
                                Próximamente
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-20 bg-gradient-to-b from-white to-slate-50 dark:from-[#111a22] dark:to-[#0d141b]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-sm font-bold mb-4">
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                            Usuarios Verificados
                        </div>
                        <h2 className="text-3xl font-bold mb-4">Lo que dicen nuestros usuarios</h2>
                        <p className="text-slate-500 dark:text-text-secondary max-w-2xl mx-auto">
                            Contadores y profesionales que ya optimizaron su flujo de trabajo
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Testimonial 1 */}
                        <div className="bg-white dark:bg-surface-dark/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center gap-1 mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} className="material-symbols-outlined icon-fill text-amber-400 text-[18px]">star</span>
                                ))}
                            </div>
                            <p className="text-slate-600 dark:text-text-secondary text-sm leading-relaxed mb-6">
                                "Antes pasaba <strong className="text-slate-900 dark:text-white">3 días al mes</strong> ingresando datos manualmente. Ahora proceso un lote de 100 facturas en minutos."
                            </p>
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-border-dark/50">
                                <div className="size-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold text-sm">MG</div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">María Elena G.</p>
                                    <p className="text-xs text-slate-500 dark:text-text-secondary">Estudio Contable • 300 facturas/mes</p>
                                </div>
                            </div>
                        </div>

                        {/* Testimonial 2 */}
                        <div className="bg-white dark:bg-surface-dark/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center gap-1 mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} className="material-symbols-outlined icon-fill text-amber-400 text-[18px]">star</span>
                                ))}
                            </div>
                            <p className="text-slate-600 dark:text-text-secondary text-sm leading-relaxed mb-6">
                                "La <strong className="text-slate-900 dark:text-white">precisión de extracción del 98%</strong> cuando el formato es consistente. La primera herramienta que me permite definir exactamente qué extraer."
                            </p>
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-border-dark/50">
                                <div className="size-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">RF</div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">Roberto F.</p>
                                    <p className="text-xs text-slate-500 dark:text-text-secondary">Asesoría Tributaria • 200 facturas/mes</p>
                                </div>
                            </div>
                        </div>

                        {/* Testimonial 3 */}
                        <div className="bg-white dark:bg-surface-dark/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center gap-1 mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} className="material-symbols-outlined icon-fill text-amber-400 text-[18px]">star</span>
                                ))}
                            </div>
                            <p className="text-slate-600 dark:text-text-secondary text-sm leading-relaxed mb-6">
                                "La interfaz es moderna y fácil de usar. El <strong className="text-slate-900 dark:text-white">modo oscuro 🌙</strong> me ayuda cuando trabajo de noche procesando facturas."
                            </p>
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-border-dark/50">
                                <div className="size-10 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white font-bold text-sm">AL</div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">Ana Lucía R.</p>
                                    <p className="text-xs text-slate-500 dark:text-text-secondary">Soluciones Fiscales • 400 facturas/mes</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="text-center p-6 bg-white/50 dark:bg-surface-dark/30 rounded-2xl backdrop-blur-sm border border-slate-200/50 dark:border-border-dark/30">
                            <div className="text-3xl font-black text-primary mb-1">98%</div>
                            <div className="text-sm text-slate-500 dark:text-text-secondary">Precisión</div>
                        </div>
                        <div className="text-center p-6 bg-white/50 dark:bg-surface-dark/30 rounded-2xl backdrop-blur-sm border border-slate-200/50 dark:border-border-dark/30">
                            <div className="text-3xl font-black text-primary mb-1">4.8</div>
                            <div className="text-sm text-slate-500 dark:text-text-secondary">Satisfacción</div>
                        </div>
                        <div className="text-center p-6 bg-white/50 dark:bg-surface-dark/30 rounded-2xl backdrop-blur-sm border border-slate-200/50 dark:border-border-dark/30">
                            <div className="text-3xl font-black text-primary mb-1">3 días</div>
                            <div className="text-sm text-slate-500 dark:text-text-secondary">Ahorro/mes</div>
                        </div>
                        <div className="text-center p-6 bg-white/50 dark:bg-surface-dark/30 rounded-2xl backdrop-blur-sm border border-slate-200/50 dark:border-border-dark/30">
                            <div className="text-3xl font-black text-primary mb-1">1000+</div>
                            <div className="text-sm text-slate-500 dark:text-text-secondary">Facturas/mes</div>
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
                        © 2026 DataExtract. Todos los derechos reservados.
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingScreen;