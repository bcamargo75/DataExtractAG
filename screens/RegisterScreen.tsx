import React from 'react';
import { Link } from 'react-router-dom';

const RegisterScreen = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
            <div className="w-full max-w-md bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/20 text-primary mb-4">
                        <span className="material-symbols-outlined text-2xl">person_add</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Crear Cuenta</h1>
                    <p className="text-slate-500 dark:text-text-secondary mt-2">Comienza a extraer datos hoy mismo</p>
                </div>

                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
                            <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-border-dark bg-white dark:bg-[#111a22] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="Juan" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Apellido</label>
                            <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-border-dark bg-white dark:bg-[#111a22] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="Pérez" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                        <input type="email" className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-border-dark bg-white dark:bg-[#111a22] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="usuario@empresa.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña</label>
                        <input type="password" className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-border-dark bg-white dark:bg-[#111a22] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" placeholder="••••••••" />
                    </div>
                    
                    <Link to="/app" className="block w-full py-3 px-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg text-center transition-colors shadow-lg shadow-primary/25">
                        Registrarme
                    </Link>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500 dark:text-text-secondary">
                    ¿Ya tienes cuenta? <Link to="/login" className="text-primary font-bold hover:underline">Ingresar</Link>
                </div>
                <div className="mt-4 text-center">
                    <Link to="/" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-sm">arrow_back</span> Volver al inicio
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default RegisterScreen;