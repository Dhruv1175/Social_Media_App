import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Get system preference for dark/light mode
  const getSystemTheme = () => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light';
  };

  // Get saved theme from localStorage, fall back to system preference, then default to 'light'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || getSystemTheme() || 'light';
  });
  
  // Track whether we're currently transitioning between themes
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      // Only update if user hasn't explicitly set a preference
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    // Add event listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Toggle between light and dark themes with transition
  const toggleTheme = () => {
    setIsTransitioning(true);
    
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
    
    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300); // Match this with the CSS transition duration
  };

  // Apply theme class to document when theme changes
  useEffect(() => {
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    
    // First remove any existing theme classes
    htmlElement.classList.remove('theme-light', 'theme-dark', 'theme-transitioning');
    bodyElement.classList.remove('theme-light', 'theme-dark', 'theme-transitioning');
    
    // Add transition class if currently transitioning
    if (isTransitioning) {
      htmlElement.classList.add('theme-transitioning');
      bodyElement.classList.add('theme-transitioning');
    }
    
    // Add the new theme class
    htmlElement.classList.add(`theme-${theme}`);
    bodyElement.classList.add(`theme-${theme}`);
    
    // Set data attribute for CSS selectors
    htmlElement.setAttribute('data-theme', theme);
    
    // Set color-scheme for browser UI
    htmlElement.style.colorScheme = theme;
    
    // Tell Bootstrap about the color scheme if it's being used
    htmlElement.setAttribute('data-bs-theme', theme === 'dark' ? 'dark' : 'light');
  }, [theme, isTransitioning]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
}; 