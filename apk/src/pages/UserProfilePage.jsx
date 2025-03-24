import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Grid, Bookmark, User, ArrowLeft } from 'lucide-react';
import '../styles/UserProfilePage.css';

const UserProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const currentUserId = localStorage.getItem('userId');
        
        if (!token || !currentUserId) {
          navigate('/');
          return;
        }

        // If the profile being viewed is the current user's profile, redirect to the main profile page
        if (userId === currentUserId) {
          navigate('/profile');
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch current logged-in user
        const currentUserResponse = await axios.get(
          `http://localhost:3080/user/profile/${currentUserId}`,
          { headers }
        );
        
        setCurrentUser(currentUserResponse.data.exist);

        // Fetch profile user data
        const profileResponse = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          { headers }
        );

        if (!profileResponse.data.exist) {
          console.error('User not found');
          navigate('/search');
          return;
        }

        setProfileUser(profileResponse.data.exist);
        
        // Check if current user is following the profile user
        if (profileResponse.data.exist && profileResponse.data.exist.followers) {
          const isFollowing = profileResponse.data.exist.followers.some(
            follower => follower && follower.follower && follower.follower._id === currentUserId
          );
          setIsFollowing(isFollowing);
        }

        // Fetch user posts - make sure we're using the right endpoint
        const postsResponse = await axios.get(
          `http://localhost:3080/user/${userId}/post/userpost/get`,
          { headers }
        );

        if (postsResponse.data && postsResponse.data.data) {
          setPosts(postsResponse.data.data);
        } else {
          setPosts([]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching profile data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, navigate]);

  const handleFollow = async () => {
    if (followLoading) return; // Prevent multiple clicks
    
    try {
      setFollowLoading(true);
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      
      if (!token || !currentUserId || !profileUser) {
        setFollowLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      
      // Toggle follow/unfollow
      await axios.post(
        `http://localhost:3080/user/${currentUserId}/follow/${profileUser._id}`,
        {},
        { headers }
      );

      // Update followers count and following state
      setIsFollowing(!isFollowing);
      
      if (profileUser.followers) {
        if (isFollowing) {
          // If currently following, removing one follower
          profileUser.followers = profileUser.followers.filter(
            f => !(f.follower && f.follower._id === currentUserId)
          );
        } else {
          // If not following, add current user as follower
          profileUser.followers.push({
            follower: { _id: currentUserId, name: currentUser.name, avatar: currentUser.avatar }
          });
        }
        setProfileUser({...profileUser});
      }
      
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const renderPostsGrid = (postsArray) => {
    if (!postsArray || postsArray.length === 0) {
      return (
        <div className="no-posts">
          <p>No posts yet</p>
        </div>
      );
    }

    return (
      <div className="posts-grid">
        {postsArray.map((post) => (
          <div 
            key={post._id} 
            className="post-item"
            onClick={() => handlePostClick(post)}
          >
            {post.image ? (
              <img src={post.image} alt="Post" />
            ) : post.video ? (
              <video>
                <source src={post.video} type="video/mp4" />
              </video>
            ) : (
              <div className="text-post">
                <p>{post.text}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const handlePostClick = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const handleCloseModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="user-profile-page">
      <Sidebar user={currentUser} />
      
      <div className="user-profile-content">
        <div className="profile-section">
          <button className="back-button" onClick={handleBackClick}>
            <ArrowLeft size={24} />
          </button>
          
          <div className="profile-header">
            <div className="profile-pic-container">
              <img
                src={profileUser?.avatar || 'https://via.placeholder.com/150'}
                alt="Profile"
                className="profile-pic"
              />
            </div>
            <div className="profile-info">
              <div className="profile-top">
                <h2>{profileUser?.name || 'Username'}</h2>
                <div className="action-buttons">
                  <button 
                    className={`follow-button ${isFollowing ? 'following' : ''}`}
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button className="message-button" onClick={() => navigate('/messages')}>
                    Message
                  </button>
                </div>
              </div>
              <div className="stats">
                <span><strong>{posts?.length || 0}</strong> posts</span>
                <span><strong>{profileUser?.followers?.length || 0}</strong> followers</span>
                <span><strong>{profileUser?.following?.length || 0}</strong> following</span>
              </div>
              <div className="bio">
                <p>{profileUser?.bio || 'No bio available'}</p>
              </div>
            </div>
          </div>
          <div className="post-navigation">
            <button
              className={`tab-button ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              <Grid />
              POSTS
            </button>
          </div>
              
          <div className="posts-container">
            {activeTab === 'posts' && renderPostsGrid(posts)}
          </div>
        </div>
      </div>

      {/* Post Modal */}
      {showPostModal && selectedPost && (
        <div className="post-modal-overlay" onClick={handleCloseModal}>
          <div className="post-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal-button" onClick={handleCloseModal}>
              <ArrowLeft size={24} />
            </button>
            <div className="post-modal-content">
              <div className="post-modal-image">
                {selectedPost.image ? (
                  <img src={selectedPost.image} alt="Post" />
                ) : selectedPost.video ? (
                  <video controls>
                    <source src={selectedPost.video} type="video/mp4" />
                  </video>
                ) : (
                  <div className="text-post-modal">
                    <p>{selectedPost.text}</p>
                  </div>
                )}
              </div>
              <div className="post-modal-details">
                <div className="post-modal-header">
                  <div className="post-user-info">
                    <img 
                      src={profileUser?.avatar || 'https://via.placeholder.com/150'} 
                      alt="User avatar" 
                      className="post-user-avatar" 
                    />
                    <span className="post-username">{profileUser?.name}</span>
                  </div>
                </div>
                <div className="post-modal-caption">
                  <p>
                    <strong>{profileUser?.name}</strong> {selectedPost.text}
                  </p>
                </div>
                <div className="post-modal-date">
                  <p>{new Date(selectedPost.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage; 