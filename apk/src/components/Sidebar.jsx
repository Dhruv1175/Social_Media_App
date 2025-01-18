import React from 'react';
import { Instagram, Home, Search, Compass, MessageCircle, Heart, PlusSquare, Settings } from 'lucide-react';

const Sidebar = ({ user }) => {
  return (
    <aside style={{ width: '250px', backgroundColor: '#fff', borderRight: '1px solid #ddd', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <Instagram size={32} />
        <h1 style={{ fontSize: '20px', marginLeft: '10px' }}>Instagram</h1>
      </div>
      <nav>
        <div style={{ marginBottom: '15px' }}>
          <Home size={20} /> Home
        </div>
        <div style={{ marginBottom: '15px' }}>
          <Search size={20} /> Search
        </div>
        <div style={{ marginBottom: '15px' }}>
          <Compass size={20} /> Explore
        </div>
        <div style={{ marginBottom: '15px' }}>
          <MessageCircle size={20} /> Messages
        </div>
        <div style={{ marginBottom: '15px' }}>
          <Heart size={20} /> Notifications
        </div>
        <div style={{ marginBottom: '15px' }}>
          <PlusSquare size={20} /> Create
        </div>
        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <a 
            href="/profile" 
            style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}
          >
            {user ? (
              <>
                <img
                  src={user.avatar || 'default-avatar.png'}
                  alt="Profile"
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    marginRight: '10px',
                    objectFit: 'cover',
                  }}
                />
                <span>Profile</span>
              </>
            ) : (
              <span>Loading...</span>
            )}
          </a>
        </div>
      </nav>
      <div style={{ marginTop: 'auto' }}>
        <Settings size={20} /> Settings
      </div>
    </aside>
  );
};

export default Sidebar;
