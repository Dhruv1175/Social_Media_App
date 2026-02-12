import axios from 'axios';

// This pulls the URL from your .env file automatically
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const API = axios.create({
    baseURL: API_BASE_URL,
});

export default API;