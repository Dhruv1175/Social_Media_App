import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, MessageCircle, PlusSquare, Compass, User, LogOut } from 'lucide-react';
import SearchBar from './SearchBar';
import '../styles/Navbar.css';

const Navbar = ({ showSearch = true }) => {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/">Social App</Link>
        </div>
        
        {showSearch && (
          <div className="navbar-search">
            <SearchBar />
          </div>
        )}
        
        <div className="navbar-menu">
          <Link to="/" className="nav-item">
            <Home size={24} />
          </Link>
          <Link to="/messages" className="nav-item">
            <MessageCircle size={24} />
          </Link>
          <Link to="/create-post" className="nav-item">
            <PlusSquare size={24} />
          </Link>
          <Link to="/explore" className="nav-item">
            <Compass size={24} />
          </Link>
          <Link to={`/profile/${userId}`} className="nav-item">
            <User size={24} />
          </Link>
          <button className="nav-item logout-button" onClick={handleLogout}>
            <LogOut size={24} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 