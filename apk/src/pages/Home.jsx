import React, { useEffect, useState } from 'react';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
} from 'lucide-react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';

function Home1() {
  const [stories, setStories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);

  // Fetch data from the database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const userId = localStorage.getItem('userId');

        //const [storiesResponse] = await Promise.all([
          //
          
        //]);
       // const storiesResponse = await  axios.get('/api/stories', { headers: { Authorization: `Bearer ${token}` } });
        const postsResponse = await axios.get(`http://localhost:3080/user/post/671a37ae3c913946f010a726/feed`, { headers: { Authorization: `Bearer ${token}` } })
        const userResponse = await  axios.get(`http://localhost:3080/user/profile/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
        //console.log('Stories:', storiesResponse.data);
        console.log('Posts:', postsResponse.data.posts);
        console.log('User:', userResponse.data);

        //setStories(storiesResponse.data || []); // Ensure an array
        setPosts(postsResponse.data.posts || []); // Ensure an array
        setUser(userResponse.data || null); // Ensure an object or null
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
      {/* Sidebar */}
     
        <Sidebar user={user}/>
     

      {/* Main Content */}
      <main style={{ flex: 1, padding: '20px' }}>
        {/* Stories */}
        <div style={{ display: 'flex', overflowX: 'scroll', marginBottom: '20px' }}>
          {stories.length === 0 && <p>No stories to show</p>}
          {stories.map((story) => (
            <div key={story.id || 'default-id'} style={{ marginRight: '10px', textAlign: 'center' }}>
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
                  src={story.avatar || 'default-avatar.png'}
                  alt={story.username || 'Unknown'}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid white' }}
                />
              </div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>{story.username || 'Anonymous'}</div>
            </div>
          ))}
        </div>

        {/* Posts */}
        
        {posts.length === 0 && <p>No posts to show</p>}
        {posts.map((post) => (
          <div
            key={post._id || 'default-id'}
            style={{
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px' }}>
              <img
                src={post.user?.avatar || 'default-avatar.png'}
                alt={post.user?.name || 'Unknown User'}
                style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px' }}
              />
              <div>
                <div style={{ fontWeight: 'bold' }}>{post.user?.name || 'Unknown User'}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {new Date(post.date).toLocaleString()}
                </div>
              </div>
            </div>
            {post.image && <img src={post.image} alt="Post" style={{ width: '100%' }} />}
            <div style={{ padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <Heart size={20} /> <MessageCircle size={20} /> <Share2 size={20} />
                </div>
                <Bookmark size={20} />
              </div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{post.likes || 0} likes</div>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold' }}>{post.user?.name || 'Unknown User'}</span>{' '}
                {post.text || ''}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>{post.comments?.length || 0} comments</div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default Home1;
