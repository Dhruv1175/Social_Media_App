import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Grid, Bookmark, User, MoreHorizontal, Edit, Trash2, Heart, MessageCircle, Share2, X, BookmarkCheck, Film, Send, Check, X as XIcon } from 'lucide-react';
import '../styles/UserProfilePage.css';
import '../styles/ProfilePage.css';

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';
const DEFAULT_POST = '/assets/default-post.svg';
const DEFAULT_VIDEO = '/assets/default-video.svg';

// PostOptions component
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
  const [followersCount, setFollowersCount] = useState(0);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [editPostMode, setEditPostMode] = useState(false);
  const [editedPostText, setEditedPostText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);
  const shareMenuRef = useRef(null);
  const optionsRef = useRef(null);

  // Comment states
  const [postComments, setPostComments] = useState({});
  const [newCommentText, setNewCommentText] = useState({});
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const [commentUsers, setCommentUsers] = useState({});
  const [postCommentCounts, setPostCommentCounts] = useState({});

  // Fetch data when userId changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const currentUserId = localStorage.getItem('userId');
        
        if (!token || !currentUserId) {
          navigate('/');
          return;
        }

        // If viewing own profile, redirect to main profile page
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

        const fetchedProfileUser = profileResponse.data.exist;
        setProfileUser(fetchedProfileUser);
        
        // Update followers count from profile data
        setFollowersCount(fetchedProfileUser.followers?.length || 0);

        // Fetch follow status directly from the check endpoint
        try {
          const followCheckResponse = await axios.get(
            `http://localhost:30801/follows/check/${currentUserId}/${userId}`,
            { headers }
          );
          
          if (followCheckResponse.data && followCheckResponse.data.isFollowing !== undefined) {
            setIsFollowing(followCheckResponse.data.isFollowing);
            console.log('Follow status from check endpoint:', followCheckResponse.data.isFollowing);
          }
        } catch (followCheckError) {
          console.error('Error checking follow status:', followCheckError);
          // Fallback: Check from profile data
          const isFollowingFromProfile = fetchedProfileUser.followers?.some(
            follower => follower.follower?._id === currentUserId || follower._id === currentUserId
          ) || false;
          setIsFollowing(isFollowingFromProfile);
        }

        // Fetch like counts for all posts
        let likeCounts = {};
        try {
          const likeCountsResponse = await axios.get(
            `http://localhost:30801/api/posts/likeCounts`,
            { headers }
          );
          
          if (likeCountsResponse.data && likeCountsResponse.data.success) {
            likeCounts = likeCountsResponse.data.likeCounts;
          }
        } catch (error) {
          console.warn('Could not fetch like counts:', error);
        }

        // Get user's liked posts
        let likedPostIds = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
        try {
          const userLikesResponse = await axios.get(
            `http://localhost:30801/user/${currentUserId}/likes`,
            { headers }
          );
          
          if (userLikesResponse.data && userLikesResponse.data.success) {
            likedPostIds = userLikesResponse.data.likedPosts.map(post => post._id);
            localStorage.setItem('userLikedPosts', JSON.stringify(likedPostIds));
          }
        } catch (error) {
          console.warn('Could not fetch user likes:', error);
        }

        // Fetch user posts
        const postsResponse = await axios.get(
          `http://localhost:30801/user/${userId}/post/userpost/get`,
          { headers }
        );

        if (postsResponse.data && postsResponse.data.data) {
          const processedPosts = postsResponse.data.data.map(post => {
            const serverLikeCount = likeCounts[post._id] || post.likes?.length || 0;
            
            const processedPost = {
              ...post,
              likes: Array(serverLikeCount).fill(null).map((_, index) => 
                likedPostIds.includes(post._id) && index === 0 ? currentUserId : `like-${index}`
              ),
              isSaved: false,
              likeCount: serverLikeCount
            };
            
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

  // Function to refresh user data including follow status
  const refreshUserData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      
      if (!token || !currentUserId || !profileUser) return;
      
      const headers = { Authorization: `Bearer ${token}` };
      
      // Refresh profile user data
      const profileResponse = await axios.get(
        `http://localhost:30801/user/profile/${userId}`,
        { headers }
      );
      
      if (profileResponse.data && profileResponse.data.exist) {
        const updatedProfileUser = profileResponse.data.exist;
        setProfileUser(updatedProfileUser);
        setFollowersCount(updatedProfileUser.followers?.length || 0);
      }
      
      // Refresh follow status
      const followCheckResponse = await axios.get(
        `http://localhost:30801/follows/check/${currentUserId}/${userId}`,
        { headers }
      );
      
      if (followCheckResponse.data && followCheckResponse.data.isFollowing !== undefined) {
        setIsFollowing(followCheckResponse.data.isFollowing);
        console.log('Refreshed follow status:', followCheckResponse.data.isFollowing);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (followLoading) return;
    
    try {
      setFollowLoading(true);
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      
      if (!currentUserId || !profileUser) {
        setFollowLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      
      // Determine endpoint based on current follow status
      const endpoint = isFollowing 
        ? `http://localhost:30801/user/${currentUserId}/${profileUser._id}/unfollow`
        : `http://localhost:30801/user/${currentUserId}/${profileUser._id}/follow`;
      
      console.log(`${isFollowing ? 'Unfollowing' : 'Following'} user ${profileUser._id}`);
      
      // Optimistic update
      const wasFollowing = isFollowing;
      setIsFollowing(!wasFollowing);
      setFollowersCount(prev => wasFollowing ? Math.max(0, prev - 1) : prev + 1);
      
      try {
        const response = await axios.post(endpoint, {}, { headers });
        
        if (response.data && response.data.success) {
          console.log(`${wasFollowing ? 'Unfollowed' : 'Followed'} successfully`);
          
          // Close unfollow dialog if it was open
          if (wasFollowing) {
            setShowUnfollowDialog(false);
          }
          
          // Refresh data after a short delay
          setTimeout(() => {
            refreshUserData();
          }, 100);
        } else {
          // Revert optimistic update on failure
          setIsFollowing(wasFollowing);
          setFollowersCount(prev => wasFollowing ? prev + 1 : Math.max(0, prev - 1));
          alert(response.data?.message || 'Operation failed');
        }
      } catch (apiError) {
        console.error('API error:', apiError);
        // Revert optimistic update
        setIsFollowing(wasFollowing);
        setFollowersCount(prev => wasFollowing ? prev + 1 : Math.max(0, prev - 1));
        
        if (apiError.response?.status === 401) {
          alert('Session expired. Please login again.');
          navigate('/login');
        } else {
          alert(apiError.response?.data?.message || 'Failed to update follow status');
        }
      }
    } catch (error) {
      console.error('Error in follow process:', error);
      alert('Error processing your request');
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle follow button click
  const handleFollowClick = () => {
    if (isFollowing) {
      setShowUnfollowDialog(true);
    } else {
      handleFollow();
    }
  };

  // Handle unfollow confirmation
  const handleUnfollowConfirm = () => {
    handleFollow();
  };

  // Handle message button click
  const handleMessage = () => {
    navigate('/messages', { state: { selectedContact: profileUser } });
  };

  // Fetch comment counts when posts change
  useEffect(() => {
    const fetchCommentCounts = async () => {
      if (!posts || posts.length === 0) return;
      
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      if (!token || !currentUserId) return;
      
      const counts = {};
      
      try {
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
        const processedComments = await Promise.all(
          response.data.comdata.map(async (comment) => {
            let userData = comment.user;
            
            if (typeof comment.user === 'string') {
              userData = commentUsers[comment.user] || await fetchCommentUser(comment.user);
            } else if (comment.user && !comment.user.name) {
              userData = commentUsers[comment.user._id] || await fetchCommentUser(comment.user._id);
            }
            
            return {
              ...comment,
              user: userData || { _id: comment.user || comment.user?._id, name: 'User' },
              createdAt: comment.createdAt || comment.date || new Date().toISOString()
            };
          })
        );
        
        setPostComments(prev => ({
          ...prev,
          [postId]: processedComments
        }));
        
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

  // Fetch user data for comment
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

  // Post a new comment
  const postComment = async (postId) => {
    const commentText = newCommentText[postId]?.trim();
    const currentUserId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    
    if (!commentText || !currentUserId || !token) return;

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

    setPostCommentCounts(prev => ({
      ...prev,
      [postId]: (prev[postId] || 0) + 1
    }));

    setNewCommentText(prev => ({ ...prev, [postId]: '' }));

    try {
      const response = await axios.post(
        `http://localhost:30801/user/${currentUserId}/post/userpost/${postId}/comment/add`,
        { text: commentText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data && response.data.success) {
        await fetchComments(postId);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(comment => comment._id !== tempCommentId)
      }));
      
      setPostCommentCounts(prev => ({
        ...prev,
        [postId]: Math.max((prev[postId] || 0) - 1, 0)
      }));
      
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
        setPostComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(comment => comment._id !== commentId)
        }));
        
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

  // Format date for comments
  const formatCommentDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
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

  // Get comment user name
  const getCommentUserName = (comment) => {
    if (!comment.user) return 'User';
    
    if (typeof comment.user === 'string') {
      return 'User';
    }
    
    return comment.user.name || 'User';
  };

  // Get comment user ID
  const getCommentUserId = (comment) => {
    if (!comment.user) return null;
    
    if (typeof comment.user === 'string') {
      return comment.user;
    }
    
    return comment.user._id;
  };

  // Get comment user avatar
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

  // Handle like functionality
  const handleLikePost = async (postId, event) => {
    if (event) event.stopPropagation();
    
    try {
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      
      if (!token || !currentUserId) return;
      
      // Optimistic update
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
      
      // Update localStorage
      const likedPostsCache = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
      const isCurrentlyLiked = updatedPosts.find(p => p._id === postId)?.likes?.includes(currentUserId);
      
      let updatedLikedPosts;
      if (isCurrentlyLiked && !likedPostsCache.includes(postId)) {
        updatedLikedPosts = [...likedPostsCache, postId];
      } else if (!isCurrentlyLiked && likedPostsCache.includes(postId)) {
        updatedLikedPosts = likedPostsCache.filter(id => id !== postId);
      } else {
        updatedLikedPosts = likedPostsCache;
      }
      
      localStorage.setItem('userLikedPosts', JSON.stringify(updatedLikedPosts));
      
      // API call
      await axios.post(
        `http://localhost:30801/user/${currentUserId}/post/userpost/${postId}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  // Handle save functionality
  const handleSavePost = async (postId, event) => {
    if (event) event.stopPropagation();
    
    try {
      const token = localStorage.getItem('accessToken');
      const currentUserId = localStorage.getItem('userId');
      
      const postToToggle = posts.find(post => post._id === postId);
      if (!postToToggle) return;
      
      // Optimistic update
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
      
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost({
          ...selectedPost,
          isSaved: !selectedPost.isSaved
        });
      }
      
      const isSaved = !postToToggle.isSaved;
      let updatedSavedPosts = [...savedPosts];
      
      if (isSaved) {
        if (!savedPosts.some(post => post._id === postId)) {
          updatedSavedPosts = [...savedPosts, { ...postToToggle, isSaved: true }];
        }
      } else {
        updatedSavedPosts = savedPosts.filter(post => post._id !== postId);
      }
      
      setSavedPosts(updatedSavedPosts);
      
      // API call
      await axios.post(
        `http://localhost:30801/user/post/${currentUserId}/${postId}/save`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error saving/unsaving post:', error);
    }
  };

  // Check if post is liked
  const isPostLiked = (post) => {
    if (!post || !post.likes) return false;
    const currentUserId = localStorage.getItem('userId');
    return post.likes.includes(currentUserId);
  };

  // Share post functionality
  const toggleShareMenu = (postId, event) => {
    if (event) event.stopPropagation();
    
    if (showPostModal) {
      setShareMenuOpen(!shareMenuOpen);
    } else {
      setShowShareModal(true);
      const selectedPostData = posts.find(post => post._id === postId);
      if (selectedPostData) setSelectedPost(selectedPostData);
    }
  };

  // Copy post link
  const handleCopyLink = () => {
    try {
      const postUrl = `${window.location.origin}/post/${selectedPost._id}`;
      navigator.clipboard.writeText(postUrl);
      setShareMenuOpen(false);
      alert("Link copied to clipboard!");
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert("Failed to copy link. Please try again.");
    }
  };

  // Social media share
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
        return;
    }
    
    window.open(shareUrl, '_blank');
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

  // Render posts grid
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
          <div key={post._id} className="post-grid-item">
            <div className="post-grid-content" onClick={() => handlePostClick(post)}>
              {post.video || post.postType === 'reel' ? (
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
              ) : post.image ? (
                <img 
                  src={post.image} 
                  alt={post.text || 'Post'} 
                  className="grid-post-image" 
                />
              ) : (
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

  // Handle post click
  const handlePostClick = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
    setEditPostMode(false);
    setShowDeleteConfirm(false);
    setEditedPostText(post.text || '');
  };

  // Close modal
  const handleCloseModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
    setEditPostMode(false);
    setShowDeleteConfirm(false);
    setShareMenuOpen(false);
  };

  // Handle edit post
  const handleEditPost = (post) => {
    setEditPostMode(true);
    setEditedPostText(post.text || '');
  };

  // Handle delete request
  const handleDeleteRequest = (post) => {
    setSelectedPost(post);
    setShowDeleteConfirm(true);
  };

  // Handle text change
  const handleTextChange = (e) => {
    setEditedPostText(e.target.value);
  };

  // Save post edit
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

  // Delete post
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
        const updatedPosts = posts.filter(post => post._id !== selectedPost._id);
        setPosts(updatedPosts);
        
        setPostCommentCounts(prev => {
          const newCounts = { ...prev };
          delete newCounts[selectedPost._id];
          return newCounts;
        });
        
        setPostComments(prev => {
          const newComments = { ...prev };
          delete newComments[selectedPost._id];
          return newComments;
        });
        
        setShowPostModal(false);
        setSelectedPost(null);
        setShowDeleteConfirm(false);
        
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
                  <button 
                    className={`follow-button ${isFollowing ? 'following' : ''} ${followLoading ? 'loading' : ''}`}
                    onClick={handleFollowClick}
                    disabled={followLoading}
                  >
                    {followLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
                  </button>
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

      {/* Unfollow confirmation dialog */}
      {showUnfollowDialog && (
        <div className="modal-overlay" onClick={() => setShowUnfollowDialog(false)}>
          <div className="unfollow-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="unfollow-dialog-header">
              <div className="unfollow-user-avatar">
                <img src={profileUser?.avatar || DEFAULT_AVATAR} alt={profileUser?.name} />
              </div>
              <h4>Unfollow @{profileUser?.name}?</h4>
              <p>Their posts will no longer appear in your home timeline. You can still view their profile.</p>
            </div>
            <div className="unfollow-dialog-actions">
              <button 
                className="unfollow-confirm-button"
                onClick={handleUnfollowConfirm}
                disabled={followLoading}
              >
                {followLoading ? 'Unfollowing...' : 'Unfollow'}
              </button>
              <button 
                className="unfollow-cancel-button"
                onClick={() => setShowUnfollowDialog(false)}
                disabled={followLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;