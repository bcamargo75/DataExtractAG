import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import ExtractionScreen from './screens/ExtractionScreen';
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import { AuthProvider } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import ProtectedRoute from './ProtectedRoute';

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <HashRouter>
                    <Routes>
                        <Route path="/" element={<LandingScreen />} />
                        <Route path="/login" element={<LoginScreen />} />
                        <Route path="/register" element={<RegisterScreen />} />
                        <Route path="/app" element={
                            <ProtectedRoute>
                                <ExtractionScreen />
                            </ProtectedRoute>
                        } />
                    </Routes>
                </HashRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}