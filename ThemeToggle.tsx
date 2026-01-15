import React from 'react';
import { useTheme } from './ThemeContext';

export const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
            title={theme === 'light' ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
        >
            <span className="material-symbols-outlined">
                {theme === 'light' ? 'dark_mode' : 'light_mode'}
            </span>
        </button>
    );
};
