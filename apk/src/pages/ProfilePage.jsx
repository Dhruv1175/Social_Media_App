import React, { useEffect, useState, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { Settings, Grid, Bookmark, X, Upload, Heart, MessageCircle, Image, Edit, Trash2, MoreHorizontal, Video, Film, Share2, BookmarkCheck, Send, User } from 'lucide-react';
import '../styles/ProfilePage.css';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../utils/firebaseConfig';

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';
const DEFAULT_POST = '/assets/default-post.svg';
const DEFAULT_VIDEO = '/assets/default-video.svg';

const PostOptions = ({ post, onEdit, onDelete }) => {
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef(null);
  
  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target)) {
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Check if post is owned by logged in user
  const isOwnPost = () => {
    const userId = localStorage.getItem('userId');
    return post?.user?._id === userId || post?.userId === userId || post?.user === userId;
  };
  
  // Only show options to post creator
  if (!isOwnPost()) return null;
  
  return (
    <div className="post-options-container" ref={optionsRef}>
      <button 
        className="post-options-button" 
        onClick={(e) => {
          e.stopPropagation();
          setShowOptions(!showOptions);
        }}
      >
        <MoreHorizontal size={20} />
      </button>
      
      {showOptions && (
        <div className="post-options-menu">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(e);
              setShowOptions(false);
            }}
          >
            <Edit size={16} /> Edit
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
              setShowOptions(false);
            }} 
            className="delete-option"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [editPostMode, setEditPostMode] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const shareMenuRef = useRef(null);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    avatar: ''
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [newFileUpload, setNewFileUpload] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadType, setUploadType] = useState('');
  const fileInputRef = useRef(null);
  
  // New comment states
  const [postComments, setPostComments] = useState({}); // { postId: [comments] }
  const [newCommentText, setNewCommentText] = useState({}); // { postId: text }
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const [commentUsers, setCommentUsers] = useState({}); // Cache for user data
  const [postCommentCounts, setPostCommentCounts] = useState({}); // { postId: count }

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Check if we have cached data first for immediate display
        const cachedPosts = localStorage.getItem('cachedPosts');
        const cachedSavedPosts = localStorage.getItem('cachedSavedPosts');
        const userLikedPosts = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
        const userId = localStorage.getItem('userId');
        
        if (cachedPosts) {
          const parsedPosts = JSON.parse(cachedPosts);
          
          // Ensure likes array is properly initialized and contains current user if liked
          const processedPosts = parsedPosts.map(post => {
            const likes = post.likes || [];
            const isLikedByUser = userLikedPosts.includes(post._id);
            
            // Make sure user ID is in likes array if it should be
            if (isLikedByUser && !likes.includes(userId)) {
              return {
                ...post,
                likes: [...likes, userId]
              };
            }
            // Make sure user ID is not in likes array if it shouldn't be
            else if (!isLikedByUser && likes.includes(userId)) {
              return {
                ...post,
                likes: likes.filter(id => id !== userId)
              };
            }
            // No change needed
            return post;
          });
          
          setPosts(processedPosts);
        }
        
        if (cachedSavedPosts) {
          const parsedSavedPosts = JSON.parse(cachedSavedPosts);
          
          // Apply the same likes consistency to saved posts
          const processedSavedPosts = parsedSavedPosts.map(post => {
            const likes = post.likes || [];
            const isLikedByUser = userLikedPosts.includes(post._id);
            
            if (isLikedByUser && !likes.includes(userId)) {
              return {
                ...post,
                likes: [...likes, userId]
              };
            }
            else if (!isLikedByUser && likes.includes(userId)) {
              return {
                ...post,
                likes: likes.filter(id => id !== userId)
              };
            }
            return post;
          });
          
          setSavedPosts(processedSavedPosts);
        }
        
        const token = localStorage.getItem('accessToken');

        if (!userId || !token) {
          console.error('User ID or token not found');
          setLoading(false);
          return;
        }

        const authHeader = { Authorization: `Bearer ${token}` };

        // Fetch user profile
        const userResponse = await axios.get(
          `http://localhost:30801/user/profile/${userId}`,
          { headers: authHeader }
        );

        // Fetch user posts
        const postsResponse = await axios.get(
          `http://localhost:30801/user/${userId}/post/userpost/get`,
          { headers: authHeader }
        );

        // Fetch saved posts
        const savedPostsResponse = await axios.get(
          `http://localhost:30801/user/post/${userId}/saved`,
          { headers: authHeader }
        );

        // NEW: Fetch like counts for all posts
        let likeCounts = {};
        try {
          const likeCountsResponse = await axios.get(
            `http://localhost:30801/api/posts/likeCounts`,
            { headers: authHeader }
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
            `http://localhost:30801/user/${userId}/likes`,
            { headers: authHeader }
          );
          
          if (userLikesResponse.data && userLikesResponse.data.success) {
            // Update from server if available
            likedPostIds = userLikesResponse.data.likedPosts.map(post => post._id);
            localStorage.setItem('userLikedPosts', JSON.stringify(likedPostIds));
          }
        } catch (error) {
          console.warn('Could not fetch user likes, using cached likes', error);
        }

        // Set user data
        if (userResponse.data && userResponse.data.exist) {
          setUser(userResponse.data.exist);
        } else {
          console.error('No user data found in response');
        }
        
        // Process posts and get their like information
        if (postsResponse.data && postsResponse.data.data) {
          // Initialize post data with likes as arrays and saved status
          const processedPosts = postsResponse.data.data.map(post => {
            // Get like count from likeCounts API or fallback to array length
            const serverLikeCount = likeCounts[post._id] || post.likes?.length || 0;
            
            // Start with base post data
            const processedPost = {
              ...post,
              // Use server like count to populate likes array if available
              likes: Array(serverLikeCount).fill(null).map((_, index) => 
                likedPostIds.includes(post._id) && index === 0 ? userId : `like-${index}`
              ),
              isSaved: false,
              // Store the actual count separately for display
              likeCount: serverLikeCount
            };
            
            // Ensure user ID is in likes array if it should be
            if (likedPostIds.includes(post._id) && !processedPost.likes.includes(userId)) {
              processedPost.likes = [userId, ...processedPost.likes.slice(1)];
            }
            
            return processedPost;
          });
          
          // Mark saved posts
          if (savedPostsResponse.data && savedPostsResponse.data.data) {
            const savedIds = savedPostsResponse.data.data
              .filter(item => item.post)
              .map(item => item.post._id);
              
            // Mark saved posts
            processedPosts.forEach(post => {
              if (savedIds.includes(post._id)) {
                post.isSaved = true;
              }
            });
          }
          
          setPosts(processedPosts);
          // Also cache the processed posts for persistence
          localStorage.setItem('cachedPosts', JSON.stringify(processedPosts));
        } else {
          console.warn('No posts data found in response');
          setPosts([]);
        }
        
        // Transform saved posts - ensure we're handling the data structure correctly
        if (savedPostsResponse.data && savedPostsResponse.data.data) {
          const transformedSavedPosts = savedPostsResponse.data.data
            .filter(item => item.post) // Ensure post exists
            .map(item => {
              const serverLikeCount = likeCounts[item.post._id] || item.post.likes?.length || 0;
              
              const savedPost = {
                ...item.post,
                isSaved: true,
                // Use server like count to populate likes array if available
                likes: Array(serverLikeCount).fill(null).map((_, index) => 
                  likedPostIds.includes(item.post._id) && index === 0 ? userId : `like-${index}`
                ),
                // Store the actual count separately for display
                likeCount: serverLikeCount,
                // Ensure user data is available
                user: item.post.user || userResponse.data.exist
              };
              
              // Ensure like status consistency
              if (likedPostIds.includes(item.post._id) && !savedPost.likes.includes(userId)) {
                savedPost.likes = [userId, ...savedPost.likes.slice(1)];
              }
              
              return savedPost;
            });
        
          setSavedPosts(transformedSavedPosts);
          // Cache saved posts for persistence
          localStorage.setItem('cachedSavedPosts', JSON.stringify(transformedSavedPosts));
        } else {
          console.warn('No saved posts data found in response');
          setSavedPosts([]);
        }
        
        // Initialize form data with user data
        if (userResponse.data && userResponse.data.exist) {
          setFormData({
            name: userResponse.data.exist?.name || '',
            bio: userResponse.data.exist?.bio || '',
            avatar: userResponse.data.exist?.avatar || ''
          });
          setAvatarPreview(userResponse.data.exist?.avatar || '');
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  // Fetch comment counts when posts change
  useEffect(() => {
    const fetchCommentCounts = async () => {
      if (!posts || posts.length === 0) return;
      
      const token = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');
      if (!token || !userId) return;
      
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

  // Fetch comment counts for saved posts
  useEffect(() => {
    const fetchSavedPostCommentCounts = async () => {
      if (!savedPosts || savedPosts.length === 0) return;
      
      const token = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');
      if (!token || !userId) return;
      
      const counts = {};
      
      try {
        // Fetch counts for all saved posts in parallel
        await Promise.all(
          savedPosts.map(async (post) => {
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
              console.error(`Error fetching comments for saved post ${post._id}:`, error);
              counts[post._id] = 0;
            }
          })
        );
        
        setPostCommentCounts(prev => ({ ...prev, ...counts }));
      } catch (error) {
        console.error('Error fetching saved post comment counts:', error);
      }
    };
    
    if (savedPosts.length > 0) {
      fetchSavedPostCommentCounts();
    }
  }, [savedPosts]);

  // --- COMMENT FUNCTIONS FOR MODAL ---

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
        const userData = response.data.exist;
        setCommentUsers(prev => ({
          ...prev,
          [userId]: userData
        }));
        return userData;
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
      
      if (response.data.success && response.data.comdata) {
        // Process comments to ensure proper user data
        const processedComments = await Promise.all(
          response.data.comdata.map(async (comment) => {
            let userData = null;
            let userIdFromComment = null;
            
            // Extract user ID from comment
            if (typeof comment.user === 'string') {
              userIdFromComment = comment.user;
            } else if (comment.user && comment.user._id) {
              userIdFromComment = comment.user._id;
            } else if (comment.userId) {
              userIdFromComment = comment.userId;
            }
            
            // Try to get user data from cache or fetch it
            if (userIdFromComment) {
              // Check if we have cached user data
              userData = commentUsers[userIdFromComment];
              
              // If not in cache, fetch it
              if (!userData) {
                userData = await fetchCommentUser(userIdFromComment);
              }
            }
            
            // Fallback user object if we couldn't get user data
            const safeUserData = userData || {
              _id: userIdFromComment || 'unknown',
              name: 'User',
              avatar: DEFAULT_AVATAR
            };
            
            return {
              ...comment,
              user: safeUserData,
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
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    
    if (!commentText || !userId || !token) return;

    // Optimistic update
    const tempCommentId = `temp_${Date.now()}`;
    const optimisticComment = {
      _id: tempCommentId,
      text: commentText,
      user: {
        _id: userId,
        name: user?.name || 'You',
        avatar: user?.avatar
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
        `http://localhost:30801/user/${userId}/post/userpost/${postId}/comment/add`,
        { text: commentText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
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

      if (response.data.success) {
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

      if (response.data.success) {
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
    if (!comment || !comment.user) return 'User';
    
    if (typeof comment.user === 'string') {
      return 'User';
    }
    
    return comment.user.name || comment.user.username || 'User';
  };

  // Get user ID safely
  const getCommentUserId = (comment) => {
    if (!comment || !comment.user) return null;
    
    if (typeof comment.user === 'string') {
      return comment.user;
    }
    
    return comment.user._id || comment.user.id;
  };

  // Get user avatar safely
  const getCommentUserAvatar = (comment) => {
    if (!comment || !comment.user || typeof comment.user === 'string') {
      return DEFAULT_AVATAR;
    }
    
    return comment.user.avatar || comment.user.profilePicture || DEFAULT_AVATAR;
  };

  // Handle comment user click
  const handleCommentUserClick = (comment, e) => {
    e.stopPropagation();
    const userId = getCommentUserId(comment);
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  // Check if Firebase is properly initialized
  useEffect(() => {
    // Try to verify Firebase storage is accessible
    try {
      if (storage) {
        console.log('Firebase storage initialized successfully');
        
        // Test creating a reference to verify the storage connection
        try {
          const testRef = ref(storage, 'test');
          console.log('Test storage reference created successfully:', testRef);
        } catch (refError) {
          console.error('Error creating test storage reference:', refError);
          alert('Warning: Media uploads may not work properly. Please check your internet connection.');
        }
      } else {
        console.warn('Firebase storage not available or not initialized');
        // Don't show an alert here as it might be disruptive on initial load
      }
    } catch (error) {
      console.error('Error checking Firebase storage:', error);
    }
  }, []);

  const handleOpenEditModal = () => {
    // Initialize form data with current user data
    setFormData({
      name: user?.name || '',
      bio: user?.bio || '',
      avatar: ''
    });
    
    // Set avatar preview to current user avatar
    setAvatarPreview(user?.avatar || '');
    
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
        setFormData({
          ...formData,
          avatar: file
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('accessToken');
      
      // First update basic profile info without avatar
      const updateData = {
        name: formData.name,
        bio: formData.bio
      };
      
      console.log('Updating profile data:', updateData);
      
      // Update basic profile information
      const profileResponse = await axios({
        method: 'patch',
        url: `http://localhost:30801/user/update/${userId}`,
        data: updateData,
        headers: { 
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('Profile update response:', profileResponse.data);

      // If we have a new avatar file, upload it to Firebase
      let newAvatarUrl = user?.avatar || '';
      
      if (formData.avatar && formData.avatar instanceof File) {
        try {
          console.log('Uploading new avatar file to Firebase:', formData.avatar.name);
          
          // Create a unique filename for the avatar
          const safeFileName = formData.avatar.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const fileName = `avatars/${userId}_${Date.now()}_${safeFileName}`;
          
          // Create Firebase storage reference
          const storageRef = ref(storage, fileName);
          
          // Upload file to Firebase
          const uploadTask = uploadBytesResumable(storageRef, formData.avatar);
          
          // Handle upload progress and completion
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log('Avatar upload progress:', progress);
            },
            (error) => {
              console.error('Error uploading avatar to Firebase:', error);
              throw error;
            }
          );
          
          // Wait for upload to complete
          await uploadTask;
          
          // Get the download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('Avatar uploaded successfully, URL:', downloadURL);
          
          // Update user profile with the Firebase URL
          const avatarUpdateResponse = await axios({
            method: 'patch',
            url: `http://localhost:30801/user/update/${userId}`,
            data: { avatar: downloadURL },
            headers: { 
              Authorization: `Bearer ${token}`
            }
          });
          
          console.log('Avatar update response:', avatarUpdateResponse.data);
          
          if (avatarUpdateResponse.data && avatarUpdateResponse.data.success) {
            newAvatarUrl = downloadURL;
          }
        } catch (avatarError) {
          console.error('Error uploading avatar to Firebase:', avatarError);
          if (avatarError.response) {
            console.error('Error response:', avatarError.response.data);
          }
          alert('Profile updated but avatar upload failed. Please try again later.');
        }
      }
      
      // If basic profile update was successful
      if (profileResponse.data && profileResponse.data.success) {
        // Update local user state with all changes
        setUser({
          ...user,
          name: formData.name,
          bio: formData.bio,
          avatar: newAvatarUrl
        });

        // Also update cached user data
        const cachedUser = JSON.parse(localStorage.getItem('cachedUser') || '{}');
        localStorage.setItem('cachedUser', JSON.stringify({
          ...cachedUser,
          name: formData.name,
          bio: formData.bio,
          avatar: newAvatarUrl
        }));

        alert('Profile updated successfully!');
        setShowEditModal(false);
      } else {
        alert('Failed to update profile: ' + (profileResponse.data?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      let errorMessage = 'Error updating profile';
      
      if (error.response) {
        console.error('Error response:', error.response.data);
        errorMessage += ': ' + (error.response.data?.message || error.message);
      } else if (error.request) {
        console.error('No response received:', error.request);
        errorMessage += ': Server not responding';
      } else {
        errorMessage += ': ' + error.message;
      }
      
      alert(errorMessage);
    }
  };

  // Open a specific post
  const handleOpenPost = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
    setEditPostMode(false);
    setEditedCaption(post.text || '');
    setShowPostOptions(false);
    setShowDeleteConfirm(false);
  };

  // Close post modal
  const handleClosePostModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
  };

  // Toggle post options menu
  const togglePostOptions = () => {
    setShowPostOptions(!showPostOptions);
  };

  // Toggle edit post mode
  const toggleEditMode = () => {
    if (editPostMode) {
      // If exiting edit mode, reset file upload state
      resetFileUpload();
    } else {
      // If entering edit mode, set caption from current post
      setEditedCaption(selectedPost?.text || '');
    }
    setEditPostMode(!editPostMode);
    setShowPostOptions(false);
  };

  // Handle caption change
  const handleCaptionChange = (e) => {
    setEditedCaption(e.target.value);
  };

  // Handle like functionality
  const handleLikePost = async (postId, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      const token = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');
      
      // First update UI optimistically for better user experience
      const updatedPosts = posts.map(post => {
        if (post._id === postId) {
          const isLiked = post.likes?.includes(userId);
          const newLikeCount = isLiked ? (post.likeCount || post.likes?.length || 0) - 1 : (post.likeCount || post.likes?.length || 0) + 1;
          
          return {
            ...post,
            likes: isLiked 
              ? (post.likes || []).filter(id => id !== userId) 
              : [...(post.likes || []), userId],
            likeCount: newLikeCount
          };
        }
        return post;
      });
      
      setPosts(updatedPosts);
      
      // If the post is selected in modal, update it too
      if (selectedPost && selectedPost._id === postId) {
        const isLiked = selectedPost.likes?.includes(userId);
        const newLikeCount = isLiked ? (selectedPost.likeCount || selectedPost.likes?.length || 0) - 1 : (selectedPost.likeCount || selectedPost.likes?.length || 0) + 1;
        
        setSelectedPost({
          ...selectedPost,
          likes: isLiked 
            ? (selectedPost.likes || []).filter(id => id !== userId) 
            : [...(selectedPost.likes || []), userId],
          likeCount: newLikeCount
        });
      }
      
      // Update saved posts if the liked/unliked post is in saved posts too
      const updatedSavedPosts = savedPosts.map(post => {
        if (post._id === postId) {
          const isLiked = post.likes?.includes(userId);
          const newLikeCount = isLiked ? (post.likeCount || post.likes?.length || 0) - 1 : (post.likeCount || post.likes?.length || 0) + 1;
          
          return {
            ...post,
            likes: isLiked 
              ? (post.likes || []).filter(id => id !== userId) 
              : [...(post.likes || []), userId],
            likeCount: newLikeCount
          };
        }
        return post;
      });
      
      setSavedPosts(updatedSavedPosts);
      
      // Save the updated posts and savedPosts to localStorage for persistence
      localStorage.setItem('cachedPosts', JSON.stringify(updatedPosts));
      localStorage.setItem('cachedSavedPosts', JSON.stringify(updatedSavedPosts));
      
      // Also store user's liked posts IDs separately for quick reference
      const likedPostsCache = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
      const isCurrentlyLiked = updatedPosts.find(p => p._id === postId)?.likes?.includes(userId);
      
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
        `http://localhost:30801/user/${userId}/post/userpost/${postId}/like`,
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
        localStorage.setItem('cachedSavedPosts', JSON.stringify(updatedSavedPostsWithServerCount));
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
      const userId = localStorage.getItem('userId');
      
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
      // The route is: route.post("/user/post/:userid/:postid/save",verifyToken,savedPost);
      const response = await axios.post(
        `http://localhost:30801/user/post/${userId}/${postId}/save`,
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
    const userId = localStorage.getItem('userId');
    return post.likes.includes(userId);
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
      
      // Note: There is no /share route in the backend based on the code we've seen
      // So we're not making an API call for tracking shares
      
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
    
    // Note: There is no /share route in the backend based on the code we've seen
    // So we're not making an API call for tracking shares
    
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

  // Filter posts based on active tab
  const getFilteredPosts = () => {
    if (!posts || posts.length === 0) return [];
    
    switch (activeTab) {
      case 'saved':
        return savedPosts || [];
      case 'reels':
        // First check postType field, then fall back to checking for videoUrl
        return posts.filter(post => post.postType === 'reel' || (!post.postType && post.video));
      default:
        // For posts tab, show only regular posts (exclude reels)
        return posts.filter(post => post.postType === 'post' || (!post.postType && !post.video));
    }
  };

  // Render post grid items
  const renderPostsGrid = (postsToDisplay) => {
    if (!postsToDisplay || postsToDisplay.length === 0) {
      let message = '';
      if (activeTab === 'posts') message = 'No Posts Yet';
      else if (activeTab === 'reels') message = 'No Reels Yet';
      else message = 'No Saved Posts';
      
      let subtitle = '';
      if (activeTab === 'posts') subtitle = 'Share your first moment!';
      else if (activeTab === 'reels') subtitle = 'Create your first reel!';
      else subtitle = 'Save posts to see them here';
      
      let icon = <Image size={48} />;
      if (activeTab === 'reels') icon = <Film size={48} />;
      
      return (
        <div className="no-posts">
          <div className="no-posts-icon">
            {icon}
          </div>
          <h3>{message}</h3>
          <p>{subtitle}</p>
        </div>
      );
    }

    return (
      <div className="posts-grid">
        {postsToDisplay.map((post) => (
          <div 
            key={post._id} 
            className="post-grid-item"
          >
            <div className="post-grid-content" onClick={() => handleOpenPost(post)}>
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
                    onEdit={(e) => {
                      handleDirectEdit(post, e);
                    }}
                    onDelete={(e) => {
                      handleDirectDelete(post, e);
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

  // Toggle delete confirmation
  const toggleDeleteConfirm = () => {
    setShowDeleteConfirm(!showDeleteConfirm);
    setShowPostOptions(false);
  };

  // Delete post
  const handleDeletePost = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');
      
      if (!token || !userId) {
        console.error('Authentication required');
        alert('Please log in to delete posts');
        return;
      }

      // First verify if the user owns the post
      if (!isOwnPost(selectedPost)) {
        console.error('Unauthorized: User does not own this post');
        alert('You can only delete your own posts');
        return;
      }
      
      // Using the correct route from the backend with proper authentication
      const response = await axios.delete(
        `http://localhost:30801/user/post/userpost/${selectedPost._id}/delete`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.status === 200) {
        // Remove post from local state
        const updatedPosts = posts.filter(post => post._id !== selectedPost._id);
        setPosts(updatedPosts);
        
        // Update localStorage
        localStorage.setItem('cachedPosts', JSON.stringify(updatedPosts));
        
        // If the post was saved, remove from saved posts too
        const updatedSavedPosts = savedPosts.filter(post => post._id !== selectedPost._id);
        if (savedPosts.length !== updatedSavedPosts.length) {
          setSavedPosts(updatedSavedPosts);
          localStorage.setItem('cachedSavedPosts', JSON.stringify(updatedSavedPosts));
        }
        
        // Also remove any comments for this post
        setPostComments(prev => {
          const newComments = { ...prev };
          delete newComments[selectedPost._id];
          return newComments;
        });
        
        // Remove comment count for this post
        setPostCommentCounts(prev => {
          const newCounts = { ...prev };
          delete newCounts[selectedPost._id];
          return newCounts;
        });
        
        // Close modal and reset states
        setShowPostModal(false);
        setSelectedPost(null);
        setShowDeleteConfirm(false);
        
        console.log('Post deleted successfully:', response.data);
      } else {
        console.error('Failed to delete post:', response);
        alert('Failed to delete post. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      if (error.response) {
        // Handle specific error cases
        switch (error.response.status) {
          case 401:
            alert('Your session has expired. Please log in again.');
            // Optionally redirect to login
            break;
          case 403:
            alert('You do not have permission to delete this post.');
            break;
          case 404:
            alert('Post not found.');
            break;
          default:
            alert('An error occurred while deleting the post. Please try again.');
        }
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      } else {
        alert('Network error. Please check your connection and try again.');
      }
    }
  };

  // Check if post is owned by logged in user
  const isOwnPost = (post) => {
    const userId = localStorage.getItem('userId');
    return post?.user?._id === userId || post?.userId === userId || post?.user === userId;
  };

  // Handle file change for image/video updates
  const handleFileChange = (e) => {
    try {
      console.log('File input change detected');
      const file = e.target.files[0];
      
      if (!file) {
        console.log('No file selected');
        return;
      }
      
      console.log('File selected:', file.name, 'type:', file.type, 'size:', file.size);
      
      // Validate file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        alert(`File too large. Maximum size is 10MB.`);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      // Check if it's an image or video
      const fileType = file.type.split('/')[0];
      if (fileType !== 'image' && fileType !== 'video') {
        alert('Please select an image or video file.');
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      setUploadType(fileType);
      console.log('Setting upload type:', fileType);
      
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('File preview created');
        setUploadPreview(reader.result);
      };
      reader.onerror = (error) => {
        console.error('Error creating file preview:', error);
        alert('Failed to preview file. Please try a different file.');
        resetFileUpload();
      };
      
      reader.readAsDataURL(file);
      
      // Store the file for upload
      setNewFileUpload(file);
      console.log('File ready for upload');
    } catch (error) {
      console.error('Error handling file change:', error);
      alert('An error occurred while processing the file. Please try again.');
      resetFileUpload();
    }
  };
  
  // Reset all file upload state
  const resetFileUpload = () => {
    setNewFileUpload(null);
    setUploadPreview('');
    setUploadProgress(0);
    setUploadType('');
    // Reset file input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload file to Firebase and update post
  const uploadFileToFirebase = async (file, postId) => {
    return new Promise((resolve, reject) => {
      try {
        // Check if Firebase is available
        if (!storage) {
          const error = new Error('Firebase storage not available');
          console.error(error);
          alert('Media upload service is currently unavailable. Please try again later.');
          reject(error);
          return;
        }

        // Check if file is valid
        if (!file || !file.name) {
          const error = new Error('Invalid file object');
          console.error('Invalid file object', file);
          alert('Invalid file selected. Please try again with a different file.');
          reject(error);
          return;
        }

        // Create a simple path to avoid path resolution issues
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `posts/${Date.now()}_${safeFileName}`;
        
        console.log('Creating storage reference for path:', fileName);
        try {
          const storageRef = ref(storage, fileName);
          
          console.log('Starting upload task');
          const uploadTask = uploadBytesResumable(storageRef, file);
          
          // Monitor upload progress
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log('Upload progress:', progress);
              setUploadProgress(progress);
            },
            (error) => {
              console.error('Error during upload:', error);
              // Show user-friendly error
              switch (error.code) {
                case 'storage/unauthorized':
                  alert('You don\'t have permission to upload files.');
                  break;
                case 'storage/canceled':
                  alert('Upload was canceled.');
                  break;
                case 'storage/unknown':
                default:
                  alert('An error occurred during upload. Please try again.');
                  break;
              }
              reject(error);
            },
            async () => {
              try {
                // Get download URL after upload completes
                console.log('Upload completed, getting download URL');
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log('File uploaded successfully, URL:', downloadURL);
                resolve(downloadURL);
              } catch (urlError) {
                console.error('Error getting download URL:', urlError);
                alert('File uploaded but unable to get download URL. Please try again.');
                reject(urlError);
              }
            }
          );
        } catch (refError) {
          console.error('Error creating storage reference:', refError);
          alert('Failed to initialize upload. Please try again later.');
          reject(refError);
        }
      } catch (error) {
        console.error('Error initiating upload:', error);
        alert('Failed to start upload. Please try again.');
        reject(error);
      }
    });
  };

  // Enhanced save edited post function
  const handleSaveEditedPost = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');
      
      if (!token || !userId) {
        alert('You must be logged in to edit posts.');
        return;
      }
      
      setUploadProgress(0);
      
      let updatedMediaUrl = selectedPost.image || selectedPost.video || '';
      let mediaType = selectedPost.video ? 'video' : 'image';
      let postType = selectedPost.postType || (selectedPost.video ? 'reel' : 'post');
      
      // If there's a new file to upload
      if (newFileUpload) {
        try {
          // Validate file object
          if (!newFileUpload || !newFileUpload.name) {
            console.error('Invalid file object:', newFileUpload);
            alert('Invalid file selected. Please try again with a different file.');
            return;
          }
          
          console.log('Preparing to upload file:', newFileUpload.name, 'type:', newFileUpload.type);
          
          // Try uploading to Firebase first
          try {
            updatedMediaUrl = await uploadFileToFirebase(newFileUpload, selectedPost._id);
            mediaType = uploadType;
            // Update postType based on media type
            postType = mediaType === 'video' ? 'reel' : 'post';
            console.log('Media uploaded successfully to Firebase:', updatedMediaUrl);
          } catch (firebaseError) {
            console.error('Firebase upload failed, trying fallback upload method:', firebaseError);
            
            // Fallback: Upload through backend API
            try {
              const formData = new FormData();
              formData.append('media', newFileUpload);
              formData.append('type', uploadType); // 'image' or 'video'
              
              const response = await axios.post(
                `http://localhost:30801/uploads/media`,
                formData,
                {
                  headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                  },
                  onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                  }
                }
              );
              
              if (response.data && response.data.url) {
                updatedMediaUrl = response.data.url;
                console.log('Media uploaded successfully using fallback:', updatedMediaUrl);
              } else {
                throw new Error('No URL returned from fallback upload');
              }
            } catch (fallbackError) {
              console.error('Fallback upload also failed:', fallbackError);
              alert('Failed to upload media. Please try again later or use a different file.');
              return;
            }
          }
        } catch (uploadError) {
          console.error('Failed to upload media:', uploadError);
          alert('Failed to upload new media. Please try again.');
          return;
        }
      }
      
      // Prepare the update data
      const updateData = {
        text: editedCaption,
        userId: userId, // Ensure userId is included for authentication
        postType: postType
      };
      
      // Add media information if we have it
      if (updatedMediaUrl) {
        if (mediaType === 'video') {
          updateData.video = updatedMediaUrl;
          // Create a thumbnail if needed
          updateData.image = selectedPost.thumbnail || selectedPost.image || '';
        } else {
          updateData.image = updatedMediaUrl;
          // If changing from video to image, remove video URL
          if (selectedPost.video) {
            updateData.video = null;
          }
        }
      }
      
      // Update the post using API
      const response = await axios.patch(
        `http://localhost:30801/user/post/userpost/${selectedPost._id}/update`,
        updateData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      if (response.data && response.status === 200) {
        // Create updated post object
        const updatedPost = { 
          ...selectedPost, 
          text: editedCaption, 
          postType: postType
        };
        
        // Add updated media URLs
        if (updatedMediaUrl) {
          if (mediaType === 'video') {
            updatedPost.video = updatedMediaUrl;
          } else {
            updatedPost.image = updatedMediaUrl;
            // If changing from video to image, remove video URL
            if (selectedPost.video) {
              updatedPost.video = null;
            }
          }
        }
        
        // Update selected post
        setSelectedPost(updatedPost);
        
        // Update posts array
        const updatedPosts = posts.map(post => 
          post._id === selectedPost._id ? updatedPost : post
        );
        setPosts(updatedPosts);
        localStorage.setItem('cachedPosts', JSON.stringify(updatedPosts));
        
        // Update saved posts if needed
        const updatedSavedPosts = savedPosts.map(post => 
          post._id === selectedPost._id ? updatedPost : post
        );
        setSavedPosts(updatedSavedPosts);
        localStorage.setItem('cachedSavedPosts', JSON.stringify(updatedSavedPosts));
        
        // Reset file upload state
        resetFileUpload();
        
        // Exit edit mode
        setEditPostMode(false);
        
        console.log('Post updated successfully:', response.data);
        alert('Post updated successfully!');
      } else {
        console.error('Failed to update post:', response);
        alert('Failed to update post. Please try again.');
      }
    } catch (error) {
      console.error('Error updating post:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        
        // Handle specific error cases
        switch (error.response.status) {
          case 401:
            alert('Your session has expired. Please log in again.');
            break;
          case 403:
            alert('You do not have permission to edit this post.');
            break;
          case 404:
            alert('Post not found.');
            break;
          default:
            alert('An error occurred while updating the post. Please try again.');
        }
      } else {
        alert('Network error. Please check your connection and try again.');
      }
    }
  };

  // Handle direct edit (without opening modal)
  const handleDirectEdit = (post, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    // Set the post as selected and toggle edit mode
    setSelectedPost(post);
    setEditedCaption(post.text || post.caption || '');
    setShowPostModal(true);
    
    // Add slight delay to allow modal to render before toggling edit mode
    setTimeout(() => {
      setEditPostMode(true);
    }, 100);
  };

  // Handle direct delete (without opening modal)
  const handleDirectDelete = (post, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    // Set the post as selected and show delete confirmation
    setSelectedPost(post);
    setShowDeleteConfirm(true);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Sidebar user={user} />
      <div className="profile-container">
        <div className="profile-section">
          <div className="profile-main">
            <div className="profile-header">
              <div className="profile-pic-container">
                <img
                  src={user?.avatar || DEFAULT_AVATAR}
                  alt="Profile"
                  className="profile-pic"
                />
              </div>
              <div className="profile-info">
                <div className="profile-top">
                  <h2>{user?.name || 'Username'}</h2>
                  <div className="action-buttons">
                    <button className="primary-button" onClick={handleOpenEditModal}>Edit Profile</button>
                    <button className="icon-button">
                      <Settings className="settings-icon" />
                    </button>
                  </div>
                </div>
                <div className="profile-stats">
                  <div className="stat">
                    <span className="stat-count">{posts.length}</span>
                    <span className="stat-label">posts</span>
                  </div>
                  <div 
                    className="stat clickable" 
                    onClick={() => navigate('/follows', { state: { filter: 'followers', userId: user?._id } })}
                  >
                    <span className="stat-count">{user?.followers?.length || 0}</span>
                    <span className="stat-label">followers</span>
                  </div>
                  <div 
                    className="stat clickable" 
                    onClick={() => navigate('/follows', { state: { filter: 'following', userId: user?._id } })}
                  >
                    <span className="stat-count">{user?.following?.length || 0}</span>
                    <span className="stat-label">following</span>
                  </div>
                </div>
                <div className="bio">
                  <p>{user?.bio || 'Bio description here'}</p>
                </div>
              </div>
            </div>
            <div className="post-navigation">
              <button
                className={`tab-button ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                <Grid size={16} />
                <span>POSTS</span>
              </button>
              <button
                className={`tab-button ${activeTab === 'reels' ? 'active' : ''}`}
                onClick={() => setActiveTab('reels')}
              >
                <Video size={16} />
                <span>REELS</span>
              </button>
              <button
                className={`tab-button ${activeTab === 'saved' ? 'active' : ''}`}
                onClick={() => setActiveTab('saved')}
              >
                <Bookmark size={16} />
                <span>SAVED</span>
              </button>
            </div>
            <div className="posts-container">
              {renderPostsGrid(getFilteredPosts())}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="edit-profile-modal">
            <div className="modal-header">
              <h4>Edit Profile</h4>
              <button className="close-button" onClick={handleCloseEditModal}>
                <X />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="avatar-upload">
                <div className="preview-container">
                  <img 
                    src={avatarPreview || DEFAULT_AVATAR} 
                    alt="Avatar Preview" 
                    className="avatar-preview"
                  />
                </div>
                <label className="upload-button">
                  <Upload size={16} />
                  Change Profile Photo
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAvatarChange} 
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="name">Username</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows="4"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={handleCloseEditModal}>
                  Cancel
                </button>
                <button type="submit" className="save-button">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Post Modal */}
      {showPostModal && selectedPost && (
        <div className="modal-overlay" onClick={handleClosePostModal}>
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
                    <p>{selectedPost.text || selectedPost.caption || 'No caption'}</p>
                  </div>
                )}
              </div>
              <div className="post-modal-details">
                <div className="post-modal-header">
                  <div className="post-user-info">
                    <img 
                      src={selectedPost.user?.avatar || user?.avatar || DEFAULT_AVATAR} 
                      alt="User" 
                      className="post-user-avatar" 
                    />
                    <span className="post-username">{selectedPost.user?.name || user?.name || 'User'}</span>
                  </div>
                  
                  <PostOptions 
                    post={selectedPost}
                    onEdit={toggleEditMode}
                    onDelete={toggleDeleteConfirm}
                  />
                </div>
                
                <div className="post-modal-caption">
                  {editPostMode ? (
                    <div className="edit-post-container">
                      {uploadType === 'video' || (selectedPost.videoUrl && !uploadPreview) ? (
                        // Video editing preview
                        <div className="edit-media-preview video-preview">
                          {uploadPreview ? (
                            <video 
                              src={uploadPreview} 
                              controls
                              className="upload-preview-media"
                            />
                          ) : (
                            <video 
                              src={selectedPost.videoUrl}
                              controls
                              poster={selectedPost.thumbnail || selectedPost.image}
                              className="upload-preview-media"
                            />
                          )}
                        </div>
                      ) : uploadPreview || selectedPost.image ? (
                        // Image editing preview
                        <div className="edit-media-preview image-preview">
                          <img 
                            src={uploadPreview || selectedPost.image} 
                            alt="Media preview"
                            className="upload-preview-media"
                          />
                        </div>
                      ) : (
                        // Text-only post
                        <div className="edit-media-empty">
                          <p>No media</p>
                        </div>
                      )}
                      
                      {/* File upload and progress */}
                      <div className="edit-media-actions">
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleFileChange}
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          id="media-file-upload"
                        />
                        <button 
                          type="button" 
                          className="change-media-button"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.click();
                            } else {
                              console.error('File input reference is not available');
                              alert('Could not open file selector. Please try again.');
                            }
                          }}
                        >
                          <Upload size={16} />
                          Change {selectedPost.videoUrl ? 'Video' : selectedPost.image ? 'Image' : 'Media'}
                        </button>
                        
                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="upload-progress">
                            <div 
                              className="upload-progress-bar" 
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                            <span>{uploadProgress}%</span>
                          </div>
                        )}
                      </div>
                      
                      <textarea
                        value={editedCaption}
                        onChange={handleCaptionChange}
                        placeholder="Write a caption..."
                        rows="3"
                        className="edit-caption-textarea"
                      />
                      
                      <div className="edit-caption-actions">
                        <button 
                          onClick={toggleEditMode}
                          className="cancel-edit-button"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveEditedPost}
                          className="save-edit-button"
                          disabled={uploadProgress > 0 && uploadProgress < 100}
                        >
                          {uploadProgress > 0 && uploadProgress < 100 ? 'Uploading...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>{selectedPost.text || selectedPost.caption || 'No caption'}</p>
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
                    <button className="post-action-button" onClick={toggleShareMenu}>
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
                              <img 
                                src={userAvatar} 
                                alt={userName} 
                                className="comment-user-avatar"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = DEFAULT_AVATAR;
                                }}
                              />
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
            
            <button className="close-modal-button" onClick={handleClosePostModal}>
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="delete-confirmation-modal">
          <div className="delete-confirmation-content">
            <h4>Delete Post?</h4>
            <p>Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="delete-confirmation-actions">
              <button onClick={() => setShowDeleteConfirm(false)} className="cancel-delete-button">
                Cancel
              </button>
              <button onClick={handleDeletePost} className="confirm-delete-button">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;