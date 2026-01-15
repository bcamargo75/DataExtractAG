import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { session, loading } = useAuth();

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
                <div className="max-w-md w-full text-center">
                    <div className="inline-flex items-center justify-center size-20 rounded-full bg-red-100 text-red-500 mb-6 animate-pulse">
                        <span className="material-symbols-outlined text-4xl">lock</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Acceso Restringido</h1>
                    <p className="text-lg text-slate-600 dark:text-text-secondary mb-8">
                        Por favor, ingrese al sistema para acceder a esta sección.
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all transform hover:-translate-y-1"
                    >
                        <span className="material-symbols-outlined">login</span>
                        Ir al Login
                    </Link>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
