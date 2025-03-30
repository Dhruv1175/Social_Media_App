import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Grid, Bookmark, User, ArrowLeft, MoreHorizontal, Edit, Trash2, Heart, MessageCircle, Share2 } from 'lucide-react';
import '../styles/UserProfilePage.css';

// PostOptions component to better handle options menu
const PostOptions = ({ post, currentUser, onEdit, onDelete }) => {
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef(null);

  const toggleOptions = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowOptions(!showOptions);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowOptions(false);
    onEdit(post);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowOptions(false);
    onDelete(post);
  };

  const isOwnPost = () => {
    if (!post || !currentUser) return false;
    const currentUserId = localStorage.getItem('userId');
    return post.user?._id === currentUserId || post.userId === currentUserId;
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOwnPost()) return null;

  return (
    <div className="post-options-container" ref={optionsRef}>
      <button 
        className="post-options-button" 
        onClick={toggleOptions}
        type="button"
        aria-label="Post options"
      >
        <MoreHorizontal size={20} />
      </button>
      
      {showOptions && (
        <div className="post-options-menu" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={handleEdit} 
            className="option-button"
            type="button"
          >
            <Edit size={16} />
            <span>Edit</span>
          </button>
          <button 
            onClick={handleDelete} 
            className="option-button delete-option"
            type="button"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
};

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
  const [followError, setFollowError] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [editPostMode, setEditPostMode] = useState(false);
  const [editedPostText, setEditedPostText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const optionsRef = useRef(null);

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
        
        // First check in localStorage if we're already following this user
        const followedUsers = JSON.parse(localStorage.getItem('followedUsers') || '[]');
        const isAlreadyFollowing = followedUsers.includes(userId);
        
        // If found in localStorage, use that state directly
        if (isAlreadyFollowing) {
          setIsFollowing(true);
        } 
        // Otherwise, check from the API response
        else if (profileResponse.data.exist && profileResponse.data.exist.followers) {
          const isFollowing = profileResponse.data.exist.followers.some(
            followerObj => followerObj?.follower?._id === currentUserId
          );
          setIsFollowing(isFollowing);
          
          // If we are following but it's not in localStorage, update localStorage
          if (isFollowing && !isAlreadyFollowing) {
            followedUsers.push(userId);
            localStorage.setItem('followedUsers', JSON.stringify(followedUsers));
          }
        }
        
        setFollowersCount(profileResponse.data.exist.followers?.length || 0);

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
    
    // Reset error state
    setFollowError(false);
    
    // If already following, show confirmation first
    if (isFollowing && !showUnfollowConfirm) {
      setShowUnfollowConfirm(true);
      setTimeout(() => {
        setShowUnfollowConfirm(false);
      }, 3000); // Auto-reset after 3 seconds
      return;
    }
    
    try {
      setFollowLoading(true);
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      
      if (!currentUserId || !profileUser) {
        setFollowLoading(false);
        return;
      }

      // Get the current followed users list
      const followedUsers = JSON.parse(localStorage.getItem('followedUsers') || '[]');
      
      if (isFollowing) {
        // UNFOLLOW - no authentication needed
        const response = await axios.post(
          `http://localhost:3080/user/${currentUserId}/${profileUser._id}/unfollow`,
          {} // No need for authentication headers
        );

        if (response.data.success) {
          // Reset unfollow confirmation
          setShowUnfollowConfirm(false);
          
          // Update UI immediately
          setIsFollowing(false);
          
          // Update followers count
          setFollowersCount(followersCount - 1);
          
          // Remove from localStorage
          const updatedFollowedUsers = followedUsers.filter(id => id !== profileUser._id);
          localStorage.setItem('followedUsers', JSON.stringify(updatedFollowedUsers));
          
          // Update the followers list in profileUser
          const updatedProfileUser = {...profileUser};
          if (updatedProfileUser.followers) {
            updatedProfileUser.followers = updatedProfileUser.followers.filter(
              f => !(f.follower && f.follower._id === currentUserId)
            );
            setProfileUser(updatedProfileUser);
          }
        }
      } else {
        // FOLLOW - requires authentication
        const headers = { Authorization: `Bearer ${token}` };
        
        const response = await axios.post(
          `http://localhost:3080/user/${currentUserId}/${profileUser._id}/follow`,
          {},
          { headers }
        );

        if (response.data.success) {
          // Update UI immediately
          setIsFollowing(true);
          
          // Update followers count
          setFollowersCount(followersCount + 1);
          
          // Add to localStorage
          if (!followedUsers.includes(profileUser._id)) {
            followedUsers.push(profileUser._id);
            localStorage.setItem('followedUsers', JSON.stringify(followedUsers));
          }
          
          // Update the followers list in profileUser
          const updatedProfileUser = {...profileUser};
          if (!updatedProfileUser.followers) {
            updatedProfileUser.followers = [];
          }
          
          updatedProfileUser.followers.push({
            follower: { _id: currentUserId, name: currentUser?.name, avatar: currentUser?.avatar }
          });
          
          setProfileUser(updatedProfileUser);
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setFollowError(true);
      
      // Display the specific error message from the backend
      if (error.response && error.response.data && error.response.data.message) {
        alert(error.response.data.message);
      } else {
        console.error('Error details:', error.response ? error.response.data : 'No response data');
        alert('Failed to follow/unfollow. Please try again.');
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    try {
      // If the messaging page already exists, navigate directly to it
      navigate('/messages', { state: { selectedContact: profileUser } });
    } catch (error) {
      console.error('Error starting conversation:', error);
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
    setEditPostMode(false);
    setShowDeleteConfirm(false);
    setEditedPostText(post.text || '');
  };

  const handleCloseModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
    setEditPostMode(false);
    setShowDeleteConfirm(false);
  };

  const handleEditPost = (post) => {
    setEditPostMode(true);
    setEditedPostText(post.text || '');
  };

  const handleDeleteRequest = (post) => {
    setShowDeleteConfirm(true);
  };

  const handleTextChange = (e) => {
    setEditedPostText(e.target.value);
  };

  const handleSavePost = async () => {
    if (!selectedPost || !editedPostText.trim()) return;
    
    try {
      setIsSubmitting(true);
      
      // Try Firebase implementation first
      try {
        // Import Firebase if it's available in your project
        // This is a mock implementation - adjust according to your actual Firebase setup
        const firebase = window.firebase;
        if (firebase && firebase.firestore) {
          const db = firebase.firestore();
          await db.collection('posts').doc(selectedPost._id).update({
            text: editedPostText,
            updatedAt: new Date()
          });
          
          // Update post in local state
          const updatedPosts = posts.map(post => 
            post._id === selectedPost._id 
            ? { ...post, text: editedPostText } 
            : post
          );
          
          setPosts(updatedPosts);
          setSelectedPost({...selectedPost, text: editedPostText});
          setEditPostMode(false);
          return; // Exit early if Firebase succeeds
        }
      } catch (firebaseError) {
        console.log('Firebase not available or error:', firebaseError);
        // Continue with REST API if Firebase fails
      }
      
      // Fallback to REST API
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.patch(
        `http://localhost:3080/api/post/${selectedPost._id}`,
        { text: editedPostText },
        { headers }
      );
      
      if (response.status === 200) {
        // Update post in local state
        const updatedPosts = posts.map(post => 
          post._id === selectedPost._id 
          ? { ...post, text: editedPostText } 
          : post
        );
        
        setPosts(updatedPosts);
        setSelectedPost({...selectedPost, text: editedPostText});
        setEditPostMode(false);
      }
    } catch (error) {
      console.error('Error saving post:', error);
      alert('Failed to save post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;
    
    try {
      setIsSubmitting(true);
      
      // Try Firebase implementation first
      try {
        // Import Firebase if it's available in your project
        // This is a mock implementation - adjust according to your actual Firebase setup
        const firebase = window.firebase;
        if (firebase && firebase.firestore) {
          const db = firebase.firestore();
          await db.collection('posts').doc(selectedPost._id).delete();
          
          // Remove post from local state
          const updatedPosts = posts.filter(post => post._id !== selectedPost._id);
          setPosts(updatedPosts);
          
          // Close modal
          setShowPostModal(false);
          setSelectedPost(null);
          setShowDeleteConfirm(false);
          return; // Exit early if Firebase succeeds
        }
      } catch (firebaseError) {
        console.log('Firebase not available or error:', firebaseError);
        // Continue with REST API if Firebase fails
      }
      
      // Fallback to REST API
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.delete(
        `http://localhost:3080/api/post/${selectedPost._id}`,
        { headers }
      );
      
      if (response.status === 200) {
        // Remove post from local state
        const updatedPosts = posts.filter(post => post._id !== selectedPost._id);
        setPosts(updatedPosts);
        
        // Close modal
        setShowPostModal(false);
        setSelectedPost(null);
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
                  {isFollowing ? (
                    <button 
                      className={`follow-button following ${followError ? 'error' : ''} ${showUnfollowConfirm ? 'confirm-unfollow' : ''}`}
                      onClick={handleFollow}
                      disabled={followLoading}
                    >
                      {followLoading ? 'Loading...' : 
                       showUnfollowConfirm ? 'Unfollow?' : 'Following'}
                    </button>
                  ) : (
                    <button 
                      className={`follow-button ${followError ? 'error' : ''}`}
                      onClick={handleFollow}
                      disabled={followLoading}
                    >
                      {followLoading ? 'Loading...' : 'Follow'}
                    </button>
                  )}
                  <button className="message-button" onClick={handleMessage}>
                    Message
                  </button>
                </div>
              </div>
              <div className="stats">
                <span><strong>{posts?.length || 0}</strong> posts</span>
                <span className="clickable-stat" onClick={() => navigate('/follows', { state: { filter: 'followers', userId: profileUser?._id } })}>
                  <strong>{followersCount}</strong> followers
                </span>
                <span className="clickable-stat" onClick={() => navigate('/follows', { state: { filter: 'following', userId: profileUser?._id } })}>
                  <strong>{profileUser?.following?.length || 0}</strong> following
                </span>
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

      {/* Post Modal with Enhanced UI and Edit/Delete Options */}
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
                  
                  {/* Using the new PostOptions component */}
                  <PostOptions 
                    post={selectedPost}
                    currentUser={currentUser}
                    onEdit={handleEditPost}
                    onDelete={handleDeleteRequest}
                  />
                </div>
                
                <div className="post-modal-caption">
                  {editPostMode ? (
                    <div className="caption-edit-container">
                      <textarea
                        value={editedPostText}
                        onChange={handleTextChange}
                        className="caption-editor"
                        rows={3}
                        disabled={isSubmitting}
                        placeholder="Edit your caption..."
                      />
                      <div className="caption-edit-actions">
                        <button 
                          onClick={() => setEditPostMode(false)} 
                          className="cancel-edit-button"
                          disabled={isSubmitting}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSavePost} 
                          className="save-edit-button"
                          disabled={isSubmitting || !editedPostText.trim()}
                        >
                          {isSubmitting ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>
                      <strong>{profileUser?.name}</strong> {selectedPost.text}
                    </p>
                  )}
                </div>
                
                <div className="post-modal-actions">
                  <div className="post-actions">
                    <div className="left-actions">
                      <button className="action-button">
                        <Heart size={24} />
                      </button>
                      <button className="action-button">
                        <MessageCircle size={24} />
                      </button>
                      <button className="action-button">
                        <Share2 size={24} />
                      </button>
                    </div>
                  </div>
                  <div className="post-likes-count">
                    <span>{selectedPost.likes || 0} likes</span>
                  </div>
                </div>
                
                <div className="post-modal-date">
                  <p>{new Date(selectedPost.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <>
          <div className="overlay" onClick={() => setShowDeleteConfirm(false)}></div>
          <div className="delete-confirm-dialog">
            <h4>Delete Post?</h4>
            <p>Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="delete-confirm-actions">
              <button 
                onClick={handleDeletePost}
                className="delete-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="cancel-button"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserProfilePage; 