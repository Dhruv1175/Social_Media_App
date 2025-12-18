import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Grid, Bookmark, User, MoreHorizontal, Edit, Trash2, Heart, MessageCircle, Share2, X, BookmarkCheck, Film, Send } from 'lucide-react';
import '../styles/UserProfilePage.css';
import '../styles/ProfilePage.css';

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';
const DEFAULT_POST = '/assets/default-post.svg';
const DEFAULT_VIDEO = '/assets/default-video.svg';

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
  const [savedPosts, setSavedPosts] = useState([]);
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
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const shareMenuRef = useRef(null);
  const optionsRef = useRef(null);

  // Comment states
  const [postComments, setPostComments] = useState({}); // { postId: [comments] }
  const [newCommentText, setNewCommentText] = useState({}); // { postId: text }
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const [commentUsers, setCommentUsers] = useState({}); // Cache for user data
  const [postCommentCounts, setPostCommentCounts] = useState({}); // { postId: count }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const currentUserId = localStorage.getItem('userId');
        const userLikedPosts = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
        
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
          `http://localhost:30801/user/profile/${currentUserId}`,
          { headers }
        );
        
        setCurrentUser(currentUserResponse.data.exist);

        // Fetch profile user data
        const profileResponse = await axios.get(
          `http://localhost:30801/user/profile/${userId}`,
          { headers }
        );

        if (!profileResponse.data.exist) {
          console.error('User not found');
          navigate('/search');
          return;
        }

        setProfileUser(profileResponse.data.exist);
        
        // First check session storage for this specific follow relationship
        const sessionFollowKey = `follow_status_${currentUserId}_${userId}`;
        const sessionFollowStatus = sessionStorage.getItem(sessionFollowKey);
        
        if (sessionFollowStatus !== null) {
          // Use cached follow status as initial state
          const followStatusFromSession = sessionFollowStatus === 'true';
          console.log(`Retrieved follow status from session: ${followStatusFromSession}`);
          setIsFollowing(followStatusFromSession);
        } else {
          // Check if current user is following this profile from server data
          const isFollowingFromServer = profileResponse.data.exist.followers?.some(
            followerObj => followerObj?.follower?._id === currentUserId ||
                          followerObj?._id === currentUserId
          ) || false;
          
          // Set following state based on server data
          setIsFollowing(isFollowingFromServer);
          console.log('Initial follow status from server:', isFollowingFromServer);
          
          // Save to session storage for persistence
          sessionStorage.setItem(sessionFollowKey, isFollowingFromServer.toString());
        }
        
        // Update followers count
        setFollowersCount(profileResponse.data.exist.followers?.length || 0);

        // NEW: Fetch like counts for all posts
        let likeCounts = {};
        try {
          const likeCountsResponse = await axios.get(
            `http://localhost:30801/api/posts/likeCounts`,
            { headers }
          );
          
          if (likeCountsResponse.data && likeCountsResponse.data.success) {
            likeCounts = likeCountsResponse.data.likeCounts;
            console.log('Fetched like counts:', likeCounts);
          }
        } catch (error) {
          console.warn('Could not fetch like counts, will use array length:', error);
        }

        // Get user's liked posts for proper like state
        let likedPostIds = userLikedPosts;
        try {
          const userLikesResponse = await axios.get(
            `http://localhost:30801/user/${currentUserId}/likes`,
            { headers }
          );
          
          if (userLikesResponse.data && userLikesResponse.data.success) {
            // Update from server if available
            likedPostIds = userLikesResponse.data.likedPosts.map(post => post._id);
            localStorage.setItem('userLikedPosts', JSON.stringify(likedPostIds));
          }
        } catch (error) {
          console.warn('Could not fetch user likes, using cached likes', error);
        }

        // Fetch user posts
        const postsResponse = await axios.get(
          `http://localhost:30801/user/${userId}/post/userpost/get`,
          { headers }
        );

        if (postsResponse.data && postsResponse.data.data) {
          // Process posts with like counts
          const processedPosts = postsResponse.data.data.map(post => {
            // Get like count from likeCounts API or fallback to array length
            const serverLikeCount = likeCounts[post._id] || post.likes?.length || 0;
            
            // Start with base post data
            const processedPost = {
              ...post,
              // Use server like count to populate likes array if available
              likes: Array(serverLikeCount).fill(null).map((_, index) => 
                likedPostIds.includes(post._id) && index === 0 ? currentUserId : `like-${index}`
              ),
              isSaved: false,
              // Store the actual count separately for display
              likeCount: serverLikeCount
            };
            
            // Ensure user ID is in likes array if it should be
            if (likedPostIds.includes(post._id) && !processedPost.likes.includes(currentUserId)) {
              processedPost.likes = [currentUserId, ...processedPost.likes.slice(1)];
            }
            
            return processedPost;
          });
          
          setPosts(processedPosts);
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

  // Fetch comment counts when posts change
  useEffect(() => {
    const fetchCommentCounts = async () => {
      if (!posts || posts.length === 0) return;
      
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      if (!token || !currentUserId) return;
      
      const counts = {};
      
      try {
        // Fetch counts for all posts in parallel
        await Promise.all(
          posts.map(async (post) => {
            try {
              const response = await axios.get(
                `http://localhost:30801/user/post/userpost/${post._id}/comment/get`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              
              if (response.data.success && response.data.comdata) {
                counts[post._id] = response.data.comdata.length;
              } else {
                counts[post._id] = 0;
              }
            } catch (error) {
              console.error(`Error fetching comments for post ${post._id}:`, error);
              counts[post._id] = 0;
            }
          })
        );
        
        setPostCommentCounts(prev => ({ ...prev, ...counts }));
      } catch (error) {
        console.error('Error fetching comment counts:', error);
      }
    };
    
    if (posts.length > 0) {
      fetchCommentCounts();
    }
  }, [posts]);

  // Fetch comments when post modal opens
  useEffect(() => {
    if (showPostModal && selectedPost && !postComments[selectedPost._id]) {
      fetchComments(selectedPost._id);
    }
  }, [showPostModal, selectedPost]);

  // Fetch user data for a comment if not already cached
  const fetchCommentUser = async (userId) => {
    if (!userId) return null;
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(
        `http://localhost:30801/user/profile/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data && response.data.exist) {
        setCommentUsers(prev => ({
          ...prev,
          [userId]: response.data.exist
        }));
        return response.data.exist;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    return null;
  };

  // Fetch comments for a specific post
  const fetchComments = async (postId) => {
    if (isLoadingComments[postId]) return;
    
    setIsLoadingComments(prev => ({ ...prev, [postId]: true }));
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(
        `http://localhost:30801/user/post/userpost/${postId}/comment/get`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data && response.data.success && response.data.comdata) {
        // Process comments to ensure proper user data
        const processedComments = await Promise.all(
          response.data.comdata.map(async (comment) => {
            let userData = comment.user;
            
            // If user is just an ID, fetch user data
            if (typeof comment.user === 'string') {
              userData = commentUsers[comment.user] || await fetchCommentUser(comment.user);
            } else if (comment.user && !comment.user.name) {
              // If user object exists but lacks details, try to fetch
              userData = commentUsers[comment.user._id] || await fetchCommentUser(comment.user._id);
            }
            
            return {
              ...comment,
              user: userData || { _id: comment.user || comment.user?._id, name: 'User' },
              // Handle both date field names
              createdAt: comment.createdAt || comment.date || new Date().toISOString()
            };
          })
        );
        
        setPostComments(prev => ({
          ...prev,
          [postId]: processedComments
        }));
        
        // Update comment count
        setPostCommentCounts(prev => ({
          ...prev,
          [postId]: processedComments.length
        }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Post a new comment
  const postComment = async (postId) => {
    const commentText = newCommentText[postId]?.trim();
    const currentUserId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    
    if (!commentText || !currentUserId || !token) return;

    // Optimistic update
    const tempCommentId = `temp_${Date.now()}`;
    const optimisticComment = {
      _id: tempCommentId,
      text: commentText,
      user: {
        _id: currentUserId,
        name: currentUser?.name || 'You',
        avatar: currentUser?.avatar
      },
      createdAt: new Date().toISOString()
    };

    setPostComments(prev => ({
      ...prev,
      [postId]: [optimisticComment, ...(prev[postId] || [])]
    }));

    // Update comment count optimistically
    setPostCommentCounts(prev => ({
      ...prev,
      [postId]: (prev[postId] || 0) + 1
    }));

    // Clear input
    setNewCommentText(prev => ({ ...prev, [postId]: '' }));

    try {
      const response = await axios.post(
        `http://localhost:30801/user/${currentUserId}/post/userpost/${postId}/comment/add`,
        { text: commentText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data && response.data.success) {
        // Refetch comments to get the actual comment with proper ID
        await fetchComments(postId);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      // Remove optimistic comment on error
      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(comment => comment._id !== tempCommentId)
      }));
      
      // Revert comment count
      setPostCommentCounts(prev => ({
        ...prev,
        [postId]: Math.max((prev[postId] || 0) - 1, 0)
      }));
      
      // Restore the text
      setNewCommentText(prev => ({ ...prev, [postId]: commentText }));
    }
  };

  // Delete a comment
  const deleteComment = async (commentId, postId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.delete(
        `http://localhost:30801/user/post/userpost/comment/${commentId}/delete`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data && response.data.success) {
        // Remove comment from state
        setPostComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(comment => comment._id !== commentId)
        }));
        
        // Update comment count
        setPostCommentCounts(prev => ({
          ...prev,
          [postId]: Math.max((prev[postId] || 0) - 1, 0)
        }));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Update a comment
  const updateComment = async (commentId, postId, newText) => {
    if (!newText.trim()) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.patch(
        `http://localhost:30801/user/post/userpost/comment/${commentId}/update`,
        { text: newText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data && response.data.success) {
        // Update comment in state
        setPostComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(comment => 
            comment._id === commentId ? { ...comment, text: newText } : comment
          )
        }));
      }
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  // Format date safely for comments
  const formatCommentDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // Show relative time for recent comments
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
      return '';
    }
  };

  // Get user name safely
  const getCommentUserName = (comment) => {
    if (!comment.user) return 'User';
    
    if (typeof comment.user === 'string') {
      return 'User';
    }
    
    return comment.user.name || 'User';
  };

  // Get user ID safely
  const getCommentUserId = (comment) => {
    if (!comment.user) return null;
    
    if (typeof comment.user === 'string') {
      return comment.user;
    }
    
    return comment.user._id;
  };

  // Get user avatar safely
  const getCommentUserAvatar = (comment) => {
    if (!comment.user || typeof comment.user === 'string') {
      return null;
    }
    
    return comment.user.avatar;
  };

  // Handle comment user click
  const handleCommentUserClick = (comment, e) => {
    e.stopPropagation();
    const userId = getCommentUserId(comment);
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

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

      // Always include authentication headers
      const headers = { Authorization: `Bearer ${token}` };
      
      // Use the correct API endpoint formats from the backend routes
      const endpoint = isFollowing 
        ? `http://localhost:30801/user/${currentUserId}/${profileUser._id}/unfollow`
        : `http://localhost:30801/user/${currentUserId}/${profileUser._id}/follow`;
      
      console.log(`Using endpoint: ${endpoint} for ${isFollowing ? 'unfollow' : 'follow'} action`);
      
      // Create session storage key for this follow relationship
      const sessionFollowKey = `follow_status_${currentUserId}_${profileUser._id}`;
      
      // Optimistically update UI
      const originalFollowStatus = isFollowing;
      const newFollowStatus = !isFollowing;
      
      setIsFollowing(newFollowStatus);
      // Update session storage immediately for persistence
      sessionStorage.setItem(sessionFollowKey, newFollowStatus.toString());
      
      setFollowersCount(prev => originalFollowStatus ? Math.max(0, prev - 1) : prev + 1);
      
      try {
        // Make the API call with correct endpoint and empty body (as per backend implementation)
        const response = await axios.post(
          endpoint,
          {}, // Empty body as the backend uses route parameters
          { headers }
        );

        // Log the response for debugging
        console.log('Follow/unfollow API response:', response.data);

        // If response is successful, update the profile user object
        if (response.data && response.data.success) {
          // Reset unfollow confirmation if it was an unfollow action
          if (originalFollowStatus) {
            setShowUnfollowConfirm(false);
          }
          
          console.log(`Successfully ${originalFollowStatus ? 'unfollowed' : 'followed'} user.`);
          
          // Manually set the follow state based on the action we just performed
          setIsFollowing(newFollowStatus);
          sessionStorage.setItem(sessionFollowKey, newFollowStatus.toString());
          
          // Create a small delay before refreshing data to let the database update
          setTimeout(() => fetchFollowStatus(), 500);
        } else {
          // If the server returned success:false, revert the optimistic updates
          console.error('Follow/unfollow action failed:', response.data);
          setIsFollowing(originalFollowStatus);
          // Update session storage with reverted state
          sessionStorage.setItem(sessionFollowKey, originalFollowStatus.toString());
          
          setFollowersCount(prev => originalFollowStatus ? prev + 1 : Math.max(0, prev - 1));
          throw new Error(response.data.message || 'Failed to update follow status');
        }
      } catch (error) {
        console.error('Follow/unfollow request failed:', error);
        
        // Revert UI state to what it was before the optimistic update
        setIsFollowing(originalFollowStatus);
        // Update session storage with reverted state
        sessionStorage.setItem(sessionFollowKey, originalFollowStatus.toString());
        
        setFollowersCount(prev => originalFollowStatus ? prev + 1 : Math.max(0, prev - 1));
        
        setFollowError(true);
        
        // Display the specific error message from the backend
        if (error.response && error.response.data && error.response.data.message) {
          alert(error.response.data.message);
        } else {
          alert(error.message || 'Failed to follow/unfollow. Please try again.');
        }
        
        // Always fetch fresh follow data from server to ensure UI is in sync
        setTimeout(() => fetchFollowStatus(), 500);
      }
    } catch (error) {
      console.error('Error in follow/unfollow process:', error);
      setFollowError(true);
      alert('Error processing your request. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  // Function to fetch follow status directly from the server
  const fetchFollowStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      
      if (!token || !currentUserId || !profileUser?._id) return;
      
      const headers = { Authorization: `Bearer ${token}` };
      
      console.log('Fetching fresh follow status from server');
      
      // Get fresh followers data
      const followersResponse = await axios.get(
        `http://localhost:30801/user/${profileUser._id}/followers`,
        { headers }
      );
      
      let isUserFollowing = false;
      
      if (followersResponse.data && followersResponse.data.success) {
        // Check if current user is in the followers list
        isUserFollowing = followersResponse.data.followdetails.some(
          f => (f.follower && f.follower._id === currentUserId) || f._id === currentUserId
        );
        
        console.log('Followers check result:', followersResponse.data.followdetails.length, 'followers');
        console.log('Current user in followers list:', isUserFollowing);
      }
      
      // Also get fresh profile data as a backup check
      const profileResponse = await axios.get(
        `http://localhost:30801/user/profile/${profileUser._id}`,
        { headers }
      );
      
      if (profileResponse.data && profileResponse.data.exist) {
        const updatedProfileUser = profileResponse.data.exist;
        
        // Update followers count
        setFollowersCount(updatedProfileUser.followers?.length || 0);
        
        // If we didn't find the user in the followers list, try the profile data
        if (!isUserFollowing && updatedProfileUser.followers) {
          isUserFollowing = updatedProfileUser.followers.some(
            f => (f.follower && f.follower._id === currentUserId) || f._id === currentUserId
          );
          console.log('Profile followers check result:', isUserFollowing);
        }
        
        // Update following state
        setIsFollowing(isUserFollowing);
        
        // Update session storage with current follow status
        const sessionFollowKey = `follow_status_${currentUserId}_${profileUser._id}`;
        sessionStorage.setItem(sessionFollowKey, isUserFollowing.toString());
        
        // Also update the profile user in state
        setProfileUser(updatedProfileUser);
        
        console.log('Follow status refreshed from server:', isUserFollowing);
      }
      
      // As a final failsafe, directly check the follow relationship
      if (!isUserFollowing) {
        try {
          const directCheckResponse = await axios.get(
            `http://localhost:30801/follows/check/${currentUserId}/${profileUser._id}`,
            { headers }
          );
          
          if (directCheckResponse.data && directCheckResponse.data.isFollowing) {
            isUserFollowing = true;
            setIsFollowing(true);
            
            // Update session storage
            const sessionFollowKey = `follow_status_${currentUserId}_${profileUser._id}`;
            sessionStorage.setItem(sessionFollowKey, 'true');
            
            console.log('Direct follow check result:', isUserFollowing);
          }
        } catch (directCheckError) {
          console.log('Direct follow check not available or failed');
        }
      }
    } catch (error) {
      console.error('Error fetching follow status:', error);
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

  // Handle like functionality
  const handleLikePost = async (postId, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      
      if (!token || !currentUserId) {
        console.error('User not authenticated');
        return;
      }
      
      // First update UI optimistically for better user experience
      const updatedPosts = posts.map(post => {
        if (post._id === postId) {
          const isLiked = post.likes?.includes(currentUserId);
          const newLikeCount = isLiked ? (post.likeCount || post.likes?.length || 0) - 1 : (post.likeCount || post.likes?.length || 0) + 1;
          
          return {
            ...post,
            likes: isLiked 
              ? (post.likes || []).filter(id => id !== currentUserId) 
              : [...(post.likes || []), currentUserId],
            likeCount: newLikeCount
          };
        }
        return post;
      });
      
      setPosts(updatedPosts);
      
      // If the post is selected in modal, update it too
      if (selectedPost && selectedPost._id === postId) {
        const isLiked = selectedPost.likes?.includes(currentUserId);
        const newLikeCount = isLiked ? (selectedPost.likeCount || selectedPost.likes?.length || 0) - 1 : (selectedPost.likeCount || selectedPost.likes?.length || 0) + 1;
        
        setSelectedPost({
          ...selectedPost,
          likes: isLiked 
            ? (selectedPost.likes || []).filter(id => id !== currentUserId) 
            : [...(selectedPost.likes || []), currentUserId],
          likeCount: newLikeCount
        });
      }
      
      // Also update saved posts if the liked/unliked post is in saved posts too
      const updatedSavedPosts = savedPosts.map(post => {
        if (post._id === postId) {
          const isLiked = post.likes?.includes(currentUserId);
          const newLikeCount = isLiked ? (post.likeCount || post.likes?.length || 0) - 1 : (post.likeCount || post.likes?.length || 0) + 1;
          
          return {
            ...post,
            likes: isLiked 
              ? (post.likes || []).filter(id => id !== currentUserId) 
              : [...(post.likes || []), currentUserId],
            likeCount: newLikeCount
          };
        }
        return post;
      });
      
      setSavedPosts(updatedSavedPosts);
      
      // Save the updated posts to localStorage for persistence
      localStorage.setItem('cachedPosts', JSON.stringify(updatedPosts));
      
      // Also store user's liked posts IDs separately for quick reference
      const likedPostsCache = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
      const isCurrentlyLiked = updatedPosts.find(p => p._id === postId)?.likes?.includes(currentUserId);
      
      let updatedLikedPosts;
      if (isCurrentlyLiked && !likedPostsCache.includes(postId)) {
        // Add to liked posts
        updatedLikedPosts = [...likedPostsCache, postId];
      } else if (!isCurrentlyLiked && likedPostsCache.includes(postId)) {
        // Remove from liked posts
        updatedLikedPosts = likedPostsCache.filter(id => id !== postId);
      } else {
        updatedLikedPosts = likedPostsCache;
      }
      
      localStorage.setItem('userLikedPosts', JSON.stringify(updatedLikedPosts));
      
      // Now make the API call using the correct endpoint
      const response = await axios.post(
        `http://localhost:30801/user/${currentUserId}/post/userpost/${postId}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Like post response:', response.data);
      
      // Update the like count from server response if available
      if (response.data && response.data.likes !== undefined) {
        // Update posts with server like count
        const updatedPostsWithServerCount = updatedPosts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              likeCount: response.data.likes
            };
          }
          return post;
        });
        setPosts(updatedPostsWithServerCount);
        
        // Update saved posts
        const updatedSavedPostsWithServerCount = updatedSavedPosts.map(post => {
          if (post._id === postId) {
            return {
              ...post,
              likeCount: response.data.likes
            };
          }
          return post;
        });
        setSavedPosts(updatedSavedPostsWithServerCount);
        
        // Update localStorage
        localStorage.setItem('cachedPosts', JSON.stringify(updatedPostsWithServerCount));
      }
    } catch (error) {
      console.error('Error liking post:', error);
      // If API fails, we've already updated the UI optimistically
    }
  };

  // Handle save functionality
  const handleSavePost = async (postId, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      
      // Find the post we're saving/unsaving
      const postToToggle = posts.find(post => post._id === postId) || 
                         savedPosts.find(post => post._id === postId);
      
      if (!postToToggle) {
        console.error('Post not found:', postId);
        return;
      }
      
      // Update optimistically for better UX
      const updatedPosts = posts.map(post => {
        if (post._id === postId) {
          return {
            ...post,
            isSaved: !post.isSaved
          };
        }
        return post;
      });
      
      setPosts(updatedPosts);
      
      // If this post is open in the modal, update it there too
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost({
          ...selectedPost,
          isSaved: !selectedPost.isSaved
        });
      }
      
      // Handle changes to the savedPosts array
      const isSaved = !postToToggle.isSaved;
      let updatedSavedPosts = [...savedPosts];
      
      if (isSaved) {
        // Post is being saved - add to savedPosts if not already there
        if (!savedPosts.some(post => post._id === postId)) {
          updatedSavedPosts = [...savedPosts, { ...postToToggle, isSaved: true }];
        }
      } else {
        // Post is being unsaved - remove from savedPosts
        updatedSavedPosts = savedPosts.filter(post => post._id !== postId);
      }
      
      // Update savedPosts state
      setSavedPosts(updatedSavedPosts);
      
      // Always update the savedPosts list, not just when activeTab is 'saved'
      // This ensures the changes are reflected immediately when switching tabs
      
      // Save the updated posts and savedPosts to localStorage for persistence
      localStorage.setItem('cachedPosts', JSON.stringify(updatedPosts));
      localStorage.setItem('cachedSavedPosts', JSON.stringify(updatedSavedPosts));
      
      // Use the correct endpoint path from the backend routes
      const response = await axios.post(
        `http://localhost:30801/user/post/${currentUserId}/${postId}/save`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Save/unsave post response:', response.data);
    } catch (error) {
      console.error('Error saving/unsaving post:', error);
      // Keep the optimistic update even if API fails
    }
  };

  // Check if post is liked by current user
  const isPostLiked = (post) => {
    if (!post || !post.likes) return false;
    const currentUserId = localStorage.getItem('userId');
    return post.likes.includes(currentUserId);
  };

  // Share post functionality
  const toggleShareMenu = (postId, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    if (showPostModal) {
      setShareMenuOpen(!shareMenuOpen);
    } else {
      setShowShareModal(true);
      const selectedPostData = posts.find(post => post._id === postId);
      if (selectedPostData) {
        setSelectedPost(selectedPostData);
      }
    }
  };

  // Copy post link to clipboard
  const handleCopyLink = () => {
    try {
      // Get the proper URL with app's domain and post ID
      const postUrl = `${window.location.origin}/post/${selectedPost._id}`;
      navigator.clipboard.writeText(postUrl);
      
      // Close share menu and show feedback
      setShareMenuOpen(false);
      alert("Link copied to clipboard!");
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert("Failed to copy link. Please try again.");
    }
  };

  // Social media share functions
  const handleSocialShare = (platform) => {
    let shareUrl = '';
    const postUrl = `${window.location.origin}/post/${selectedPost._id}`;
    const shareText = "Check out this post!";
    
    switch(platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(shareText)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + postUrl)}`;
        break;
      default:
        console.error('Unknown platform:', platform);
        return;
    }
    
    // Open share dialog
    window.open(shareUrl, '_blank');
    
    // Close share menu
    setShareMenuOpen(false);
    setShowShareModal(false);
  };

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setShareMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const renderPostsGrid = (postsArray) => {
    if (!postsArray || postsArray.length === 0) {
      return (
        <div className="no-posts">
          <div className="no-posts-icon">
            <User size={48} />
          </div>
          <h3>No Posts Yet</h3>
          <p>This user hasn't shared any posts yet.</p>
        </div>
      );
    }

    return (
      <div className="posts-grid">
        {postsArray.map((post) => (
          <div 
            key={post._id} 
            className="post-grid-item"
          >
            <div className="post-grid-content" onClick={() => handlePostClick(post)}>
              {post.video || post.postType === 'reel' ? (
                // Video/Reel post
                <>
                  <div className="reel-post-item">
                    <img 
                      src={post.thumbnail || post.image || DEFAULT_VIDEO} 
                      alt={post.text || 'Reel'} 
                      className="grid-post-image" 
                    />
                    <div className="video-indicator">
                      <Film size={20} />
                    </div>
                  </div>
                </>
              ) : post.image ? (
                // Image post
                <>
                  <img 
                    src={post.image} 
                    alt={post.text || 'Post'} 
                    className="grid-post-image" 
                  />
                </>
              ) : (
                // Text-only post
                <div className="text-post-grid">
                  <p>{post.text}</p>
                </div>
              )}
              <div className="post-overlay">
                <div className="post-interactions">
                  <span>
                    <Heart size={20} className="interaction-icon" /> 
                    {post.likeCount || post.likes?.length || 0}
                  </span>
                  <span>
                    <MessageCircle size={20} className="interaction-icon" /> 
                    {postCommentCounts[post._id] || 0}
                  </span>
                </div>
                
                <div className="post-grid-info">
                  <div className="post-grid-date">
                    {formatDate(post.date || post.createdAt)}
                  </div>
                </div>
                
                <div className="post-grid-options" onClick={(e) => e.stopPropagation()}>
                  <PostOptions 
                    post={post}
                    currentUser={currentUser}
                    onEdit={(post) => {
                      setSelectedPost(post);
                      setEditPostMode(true);
                      setEditedPostText(post.text || '');
                    }}
                    onDelete={(post) => {
                      setSelectedPost(post);
                      setShowDeleteConfirm(true);
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="post-grid-actions">
              <button 
                className={`action-icon-button ${isPostLiked(post) ? 'liked' : ''}`}
                onClick={(e) => handleLikePost(post._id, e)}
              >
                <Heart size={24} className={isPostLiked(post) ? 'filled-heart' : ''} />
              </button>
              <button className="action-icon-button" onClick={(e) => toggleShareMenu(post._id, e)}>
                <Share2 size={22} />
              </button>
              <button 
                className={`action-icon-button ${post.isSaved ? 'saved' : ''}`}
                onClick={(e) => handleSavePost(post._id, e)}
              >
                {post.isSaved ? <BookmarkCheck size={22} /> : <Bookmark size={22} />}
              </button>
            </div>
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
    setShareMenuOpen(false);
  };

  const handleEditPost = (post) => {
    setEditPostMode(true);
    setEditedPostText(post.text || '');
  };

  const handleDeleteRequest = (post) => {
    setSelectedPost(post);
    setShowDeleteConfirm(true);
  };

  const handleTextChange = (e) => {
    setEditedPostText(e.target.value);
  };

  const handleSavePostEdit = async () => {
    if (!selectedPost || !editedPostText.trim()) return;
    
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.patch(
        `http://localhost:30801/user/post/userpost/${selectedPost._id}/update`,
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
        alert('Post updated successfully!');
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
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.delete(
        `http://localhost:30801/user/post/userpost/${selectedPost._id}/delete`,
        { headers }
      );
      
      if (response.status === 200) {
        // Remove post from local state
        const updatedPosts = posts.filter(post => post._id !== selectedPost._id);
        setPosts(updatedPosts);
        
        // Also remove comment count for this post
        setPostCommentCounts(prev => {
          const newCounts = { ...prev };
          delete newCounts[selectedPost._id];
          return newCounts;
        });
        
        // Remove comments for this post
        setPostComments(prev => {
          const newComments = { ...prev };
          delete newComments[selectedPost._id];
          return newComments;
        });
        
        // Close modal
        setShowPostModal(false);
        setSelectedPost(null);
        setShowDeleteConfirm(false);
        
        // Update localStorage
        localStorage.setItem('cachedPosts', JSON.stringify(updatedPosts));
        
        alert('Post deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="user-profile-page">
      <Sidebar user={currentUser} />
      
      <div className="user-profile-content">
        <div className="profile-section">
          <div className="profile-header">
            <div className="profile-pic-container">
              <img
                src={profileUser?.avatar || DEFAULT_AVATAR}
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
            <button
              className={`tab-button ${activeTab === 'reels' ? 'active' : ''}`}
              onClick={() => setActiveTab('reels')}
            >
              <Film size={16} />
              <span>REELS</span>
            </button>
          </div>
              
          <div className="posts-container">
            {activeTab === 'posts' && renderPostsGrid(posts.filter(post => post.postType === 'post' || (!post.postType && !post.video)))}
            {activeTab === 'reels' && renderPostsGrid(posts.filter(post => post.postType === 'reel' || (!post.postType && post.video)))}
          </div>
        </div>
      </div>

      {/* Post Modal */}
      {showPostModal && selectedPost && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="post-modal-content">
              <div className="post-modal-image">
                {selectedPost.video || selectedPost.videoUrl ? (
                  <video 
                    src={selectedPost.video || selectedPost.videoUrl} 
                    controls
                    poster={selectedPost.thumbnail || selectedPost.image}
                    className="post-video"
                    autoPlay
                  />
                ) : selectedPost.image ? (
                  <img 
                    src={selectedPost.image} 
                    alt={selectedPost.text || 'Post'} 
                  />
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
                      src={profileUser?.avatar || DEFAULT_AVATAR} 
                      alt="User avatar" 
                      className="post-user-avatar" 
                    />
                    <span className="post-username">{profileUser?.name}</span>
                  </div>
                  
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
                          onClick={handleSavePostEdit} 
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
                
                <div className="post-modal-interactions">
                  <div className="post-action-buttons">
                    <button 
                      className={`post-action-button ${isPostLiked(selectedPost) ? 'liked' : ''}`}
                      onClick={() => handleLikePost(selectedPost._id)}
                    >
                      <Heart size={24} className={isPostLiked(selectedPost) ? 'filled-heart' : ''} />
                    </button>
                    <button className="post-action-button" onClick={() => toggleShareMenu(selectedPost._id)}>
                      <Share2 size={22} />
                    </button>
                    <div className="share-menu-container" ref={shareMenuRef}>
                      {shareMenuOpen && (
                        <div className="share-menu">
                          <button onClick={handleCopyLink}>
                            Copy Link
                          </button>
                          <button onClick={() => handleSocialShare('facebook')}>
                            Share to Facebook
                          </button>
                          <button onClick={() => handleSocialShare('twitter')}>
                            Share to Twitter
                          </button>
                          <button onClick={() => handleSocialShare('whatsapp')}>
                            Share to WhatsApp
                          </button>
                        </div>
                      )}
                    </div>
                    <button 
                      className={`post-action-button ${selectedPost.isSaved ? 'saved' : ''}`}
                      onClick={() => handleSavePost(selectedPost._id)}
                    >
                      {selectedPost.isSaved ? <BookmarkCheck size={22} /> : <Bookmark size={22} />}
                    </button>
                  </div>
                  <div className="post-likes">
                    <strong>{selectedPost.likeCount || selectedPost.likes?.length || 0} likes</strong>
                  </div>
                  <div className="post-date">
                    {formatDate(selectedPost.date || selectedPost.createdAt)}
                  </div>
                </div>
                
                <div className="post-comments-section">
                  <div className="post-comments-container">
                    {isLoadingComments[selectedPost._id] ? (
                      <div className="loading-comments">Loading comments...</div>
                    ) : postComments[selectedPost._id] && postComments[selectedPost._id].length > 0 ? (
                      postComments[selectedPost._id].map(comment => {
                        const userName = getCommentUserName(comment);
                        const userId = getCommentUserId(comment);
                        const userAvatar = getCommentUserAvatar(comment);
                        const commentDate = formatCommentDate(comment.createdAt);
                        
                        return (
                          <div key={comment._id} className="comment-item">
                            <div 
                              className="comment-avatar"
                              onClick={(e) => handleCommentUserClick(comment, e)}
                            >
                              {userAvatar ? (
                                <img 
                                  src={userAvatar} 
                                  alt={userName} 
                                  className="comment-user-avatar"
                                />
                              ) : (
                                <User size={16} />
                              )}
                            </div>
                            <div className="comment-content">
                              <div className="comment-header">
                                <span 
                                  className="comment-username"
                                  onClick={(e) => handleCommentUserClick(comment, e)}
                                  style={{ cursor: userId ? 'pointer' : 'default' }}
                                >
                                  {userName}
                                </span>
                                {commentDate && (
                                  <span className="comment-time">
                                    {commentDate}
                                  </span>
                                )}
                              </div>
                              <p className="comment-text">{comment.text}</p>
                              {userId === localStorage.getItem('userId') && (
                                <div className="comment-actions">
                                  <button 
                                    className="comment-action-btn"
                                    onClick={() => {
                                      const newText = prompt('Edit your comment:', comment.text);
                                      if (newText !== null) {
                                        updateComment(comment._id, selectedPost._id, newText);
                                      }
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    className="comment-action-btn delete"
                                    onClick={() => deleteComment(comment._id, selectedPost._id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="no-comments-yet">No comments yet.</p>
                    )}
                  </div>
                  <div className="add-comment-container">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      className="comment-input"
                      value={newCommentText[selectedPost._id] || ''}
                      onChange={(e) => setNewCommentText(prev => ({
                        ...prev,
                        [selectedPost._id]: e.target.value
                      }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          postComment(selectedPost._id);
                        }
                      }}
                    />
                    <button 
                      className="post-comment-button"
                      onClick={() => postComment(selectedPost._id)}
                      disabled={!newCommentText[selectedPost._id]?.trim()}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <button className="close-modal-button" onClick={handleCloseModal}>
              <X size={24} />
            </button>
          </div>
        </div>
      )}
      
      {/* Share Modal */}
      {showShareModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h4>Share Post</h4>
              <button className="close-button" onClick={() => setShowShareModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="share-options">
              <button className="share-option" onClick={handleCopyLink}>
                <div className="share-icon">Copy Link</div>
                <span>Copy link to clipboard</span>
              </button>
              <button 
                className="share-option"
                onClick={() => handleSocialShare('facebook')}
              >
                <div className="share-icon facebook">Facebook</div>
                <span>Share to Facebook</span>
              </button>
              <button 
                className="share-option"
                onClick={() => handleSocialShare('twitter')}
              >
                <div className="share-icon twitter">Twitter</div>
                <span>Share to Twitter</span>
              </button>
              <button 
                className="share-option"
                onClick={() => handleSocialShare('whatsapp')}
              >
                <div className="share-icon whatsapp">WhatsApp</div>
                <span>Share to WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="delete-confirmation-modal">
          <div className="delete-confirmation-content">
            <h4>Delete Post?</h4>
            <p>Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="delete-confirmation-actions">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="cancel-delete-button"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeletePost}
                className="confirm-delete-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;