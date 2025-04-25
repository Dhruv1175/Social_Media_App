import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import PostPage from './pages/PostPage';
import Settings from './pages/Settings';
import FeedPage from './pages/FeedPage';
import './styles/App.css';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    // Check if user is authenticated by verifying token in local storage
    const token = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');
    setIsAuthenticated(!!token && !!userId);
    
    // Listen for storage changes (logout from other tabs)
    const handleStorageChange = () => {
      const updatedToken = localStorage.getItem('accessToken');
      const updatedUserId = localStorage.getItem('userId');
      setIsAuthenticated(!!updatedToken && !!updatedUserId);
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <ThemeProvider>
      <div className="app">
        <Router>
          <Routes>
            <Route path="/" element={
              isAuthenticated ? 
                <Navigate to="/home" /> : 
                <LoginPage />
            } />
            <Route path="/login" element={
              isAuthenticated ? 
                <Navigate to="/home" /> : 
                <LoginPage />
            } />
            <Route path="/register" element={
              isAuthenticated ? 
                <Navigate to="/home" /> : 
                <RegisterPage />
            } />
            
            {/* Protected routes */}
            <Route path="/home" element={
              isAuthenticated ? 
                <FeedPage /> : 
                <Navigate to="/login" />
            } />
            <Route path="/profile" element={
              isAuthenticated ? 
                <ProfilePage /> : 
                <Navigate to="/login" />
            } />
            <Route path="/profile/:username" element={
              isAuthenticated ? 
                <ProfilePage /> : 
                <Navigate to="/login" />
            } />
            <Route path="/post/:postId" element={
              isAuthenticated ? 
                <PostPage /> : 
                <Navigate to="/login" />
            } />
            <Route path="/settings" element={
              isAuthenticated ? 
                <Settings /> : 
                <Navigate to="/login" />
            } />
            
            {/* Fallback for unknown routes */}
            <Route path="*" element={<Navigate to={isAuthenticated ? "/home" : "/login"} />} />
          </Routes>
        </Router>
      </div>
    </ThemeProvider>
  );
}

export default App;
