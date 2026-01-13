import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import ExtractionScreen from './screens/ExtractionScreen';
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

export default function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<LandingScreen />} />
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/register" element={<RegisterScreen />} />
                <Route path="/app" element={<ExtractionScreen />} />
            </Routes>
        </HashRouter>
    );
}