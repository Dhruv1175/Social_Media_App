import React, { useEffect, useState } from 'react';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Search,
  Home,
  PlusSquare,
  Compass,
  Instagram,
  Settings,
} from 'lucide-react';
import axios from 'axios';

function Home1() {
  const [stories, setStories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);

  // Fetch data from the database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('authToken'); // Assuming token is stored in localStorage

        const [storiesResponse, postsResponse, userResponse] = await Promise.all([
          axios.get('/api/stories', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/posts', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/user', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        setStories(storiesResponse.data);
        setPosts(postsResponse.data);
        setUser(userResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
      {/* Sidebar */}
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
            {user && (
              <>
                <img
                  src={user.avatar}
                  alt="Profile"
                  style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '10px' }}
                />
                Profile
              </>
            )}
          </div>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <Settings size={20} /> Settings
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '20px' }}>
        {/* Stories */}
        <div style={{ display: 'flex', overflowX: 'scroll', marginBottom: '20px' }}>
          {stories.map((story) => (
            <div key={story.id} style={{ marginRight: '10px', textAlign: 'center' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundImage: story.isWatched
                    ? 'none'
                    : 'linear-gradient(to top right, orange, red)',
                  padding: '3px',
                }}
              >
                <img
                  src={story.avatar}
                  alt={story.username}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid white' }}
                />
              </div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>{story.username}</div>
            </div>
          ))}
        </div>

        {/* Posts */}
        {posts.map((post) => (
          <div key={post.id} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px' }}>
              <img
                src={post.userAvatar}
                alt={post.username}
                style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px' }}
              />
              <div>
                <div style={{ fontWeight: 'bold' }}>{post.username}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{post.timestamp}</div>
              </div>
            </div>
            <img src={post.image} alt="Post" style={{ width: '100%' }} />
            <div style={{ padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <Heart size={20} /> <MessageCircle size={20} /> <Share2 size={20} />
                </div>
                <Bookmark size={20} />
              </div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{post.likes} likes</div>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold' }}>{post.username}</span> {post.caption}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>{post.comments} comments</div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default Home1;
