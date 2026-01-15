import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from "../supabaseClient";


import { useAuth } from '../AuthContext';
import { useEffect } from 'react';
import { ThemeToggle } from '../ThemeToggle';

const LoginScreen = () => {
    const { session } = useAuth();
    const navigate = useNavigate();

    // Redirect if already logged in
    useEffect(() => {
        if (session) {
            navigate('/app');
        }
    }, [session, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4 relative">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-md bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/20 text-primary mb-4">
                        <span className="material-symbols-outlined text-2xl">lock</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bienvenido de nuevo</h1>
                    <p className="text-slate-500 dark:text-text-secondary mt-2">Ingresa a tu cuenta para continuar</p>
                </div>

                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={loginGoogle}
                        className="w-full py-3 px-4 bg-white dark:bg-[#111a22] border border-slate-300 dark:border-border-dark text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold rounded-lg text-center transition-colors flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                    >
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                        <span>Continuar con Google</span>
                    </button>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200 dark:border-border-dark"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">Solo acceso autorizado</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-border-dark"></div>
                    </div>
                </div>

                <div className="mt-6 text-center text-sm text-slate-500 dark:text-text-secondary">
                    <span className="text-xs">Al continuar, aceptas nuestros términos y condiciones.</span>
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

async function loginGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
    });
    if (error) alert(error.message);
}

export default LoginScreen;