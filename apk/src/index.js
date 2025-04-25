import React from 'react';
import ReactDOM from 'react-dom/client';
import Main from './pages/Main';
import { ThemeProvider } from './context/ThemeContext';
// Import theme CSS first to ensure variables are available to other stylesheets
import './styles/theme.css';
import './styles/index.css';
import '../node_modules/bootstrap/dist/css/bootstrap.min.css'
import '../node_modules/bootstrap/dist/js/bootstrap.min.js'


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <Main/>
    </ThemeProvider>
  </React.StrictMode>
);

