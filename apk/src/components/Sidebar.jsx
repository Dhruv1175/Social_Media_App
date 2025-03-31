import React, { useEffect, useState } from 'react';
import '../styles/Sidebar.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Instagram, Home, Compass, MessageCircle, Heart, PlusSquare, Menu, LogOut, User, Search } from 'lucide-react';
import axios from 'axios';

const Sidebar = ({ user: propUser }) => {
  const [user, setUser] = useState(propUser || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is provided as a prop, use that
    if (propUser) {
      setUser(propUser);
      return;
    }

    // Otherwise fetch user data
    const fetchUserData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!userId || !token) {
          console.error('User ID or token not found');
          return;
        }

        const response = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setUser(response.data.exist);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();
  }, [propUser]);

  const handleLogout = () => {
    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    
    // Redirect to login
    window.location.href = '/';
  };

  const handleCreate = (e) => {
    e.preventDefault();
    setShowCreateModal(true);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      <div className="sidebar">
        <div className="sidebar-logo">
          <Instagram className="logo-icon" />
          <span className="logo-text">Rizzit</span>
      </div>
        
        <nav className="sidebar-nav">
          <Link to="/home" className={`nav-item ${isActive('/home') ? 'active' : ''}`}>
            <Home className="nav-icon" />
            <span className="nav-text">Home</span>
          </Link>
          
          <Link to="/search" className={`nav-item ${isActive('/search') ? 'active' : ''}`}>
            <Search className="nav-icon" />
            <span className="nav-text">Search</span>
          </Link>
          
          <Link to="#" className="nav-item">
            <Compass className="nav-icon" />
            <span className="nav-text">Explore</span>
          </Link>
          
          <Link to="/messages" className={`nav-item ${isActive('/messages') ? 'active' : ''}`}>
            <MessageCircle className="nav-icon" />
            <span className="nav-text">Messages</span>
          </Link>
          
          <Link to="#" className="nav-item">
            <Heart className="nav-icon" />
            <span className="nav-text">Notifications</span>
          </Link>
          
          <a href="#" className="nav-item" onClick={handleCreate}>
            <PlusSquare className="nav-icon" />
            <span className="nav-text">Create</span>
          </a>
          
          <Link to="/profile" className={`nav-item ${isActive('/profile') ? 'active' : ''}`}>
            {user && user.avatar ? (
              <img src={user.avatar} alt="Profile" className="nav-icon profile-pic" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
            ) : (
              <User className="nav-icon" size={24} />
            )}
            <span className="nav-text">{user?.name || 'Profile'}</span>
          </Link>
        </nav>
        
        <div className="sidebar-footer">
          <Link to="#" className="nav-item" onClick={handleLogout}>
            <LogOut className="nav-icon" />
            <span className="nav-text">Logout</span>
          </Link>
          
          <Link to="#" className="nav-item">
            <Menu className="nav-icon" />
            <span className="nav-text">More</span>
          </Link>
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <CreatePostModal onClose={() => setShowCreateModal(false)} />
          </div>
        </div>
      )}
    </>
  );
};

// Create Post Modal Component
const CreatePostModal = ({ onClose }) => {
  const [postType, setPostType] = useState('post'); // 'post' for images, 'reel' for videos
  
  return (
    <div className="create-post-modal">
      <div className="modal-header">
        <h3>Create {postType === 'post' ? 'Post' : 'Reel'}</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="post-type-selector">
        <button 
          className={`type-button ${postType === 'post' ? 'active' : ''}`}
          onClick={() => setPostType('post')}
        >
          Post (Image)
        </button>
        <button 
          className={`type-button ${postType === 'reel' ? 'active' : ''}`}
          onClick={() => setPostType('reel')}
        >
          Reel (Video)
        </button>
      </div>
      
      {postType === 'post' ? (
        <ImagePostCreator onClose={onClose} />
      ) : (
        <VideoPostCreator onClose={onClose} />
      )}
    </div>
  );
};

// Image Post Creator Component
const ImagePostCreator = ({ onClose }) => {
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = React.useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Check file size (limit to 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (file.size > maxSize) {
      alert(`File too large. Maximum size is 20MB.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const uploadImageToFirebase = async (file) => {
    const userId = localStorage.getItem('userId');
    
    try {
      // Import Firebase storage modules
      const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../utils/firebaseConfig');
      
      if (!storage) {
        throw new Error('Firebase storage not available');
      }
      
      // Create a unique filename
      const fileName = `posts/${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      
      // Create storage reference
      const storageRef = ref(storage, fileName);
      
      // Start upload
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        // Monitor upload progress
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(progress);
          },
          (error) => {
            console.error('Error uploading to Firebase:', error);
            reject(error);
          },
          async () => {
            // Get download URL after upload completes
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (urlError) {
              console.error('Error getting download URL:', urlError);
              reject(urlError);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error initializing Firebase upload:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      alert('Please select an image');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('accessToken');
      
      if (!userId || !token) {
        alert('You must be logged in to create a post');
        return;
      }

      let imageUrl = '';
      
      // Upload image to Firebase
      try {
        imageUrl = await uploadImageToFirebase(image);
        console.log('Image uploaded to Firebase:', imageUrl);
      } catch (firebaseError) {
        console.error('Firebase upload failed:', firebaseError);
        
        // Try direct server upload as fallback
        try {
          console.log('Trying direct server upload as fallback');
          
          // Create form data for direct server upload
          const formData = new FormData();
          formData.append('image', image);
          
          const uploadResponse = await axios.post(
            `http://localhost:3080/uploads/image`,
            formData,
            { 
              headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              },
              onUploadProgress: (progressEvent) => {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setProgress(progress);
              }
            }
          );
          
          if (uploadResponse.data && uploadResponse.data.url) {
            imageUrl = uploadResponse.data.url;
          } else {
            throw new Error('No URL returned from server upload');
          }
        } catch (serverError) {
          console.error('Server upload also failed:', serverError);
          alert('Failed to upload image. Please try again or use a smaller file.');
          setIsSubmitting(false);
          return;
        }
      }
      
      // Create post data - Specifically mark as a post (not reel)
      const postData = {
        text: caption,
        image: imageUrl,
        postType: 'post' // Explicitly mark as regular post
      };
      
      // Create post via API
      const response = await axios.post(
        `http://localhost:3080/user/${userId}/post/userpost/create`,
        postData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        // Show success animation instead of alert
        setIsSuccess(true);
        
        // Automatically close modal after success animation
        setTimeout(() => {
          onClose();
          
          // Refresh the feed to show the new post (but not the whole page)
          if (window.refreshFeed && typeof window.refreshFeed === 'function') {
            window.refreshFeed();
          } else {
            // Fallback to page reload if no refresh function is available
            window.location.reload();
          }
        }, 1500);
      } else {
        alert('Failed to create post. Please try again.');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Error creating post. Please try again.');
    } finally {
      if (!isSuccess) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <div className="post-creator">
        {isSuccess ? (
          <div className="success-animation">
            <div className="success-icon">✓</div>
            <p>Post created successfully!</p>
          </div>
        ) : (
          <>
            <div className="media-section">
              {preview ? (
                <div className="media-preview">
                  <img src={preview} alt="Preview" />
                  <button className="remove-media" onClick={() => {
                    setImage(null);
                    setPreview('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}>×</button>
                </div>
              ) : (
                <div className="upload-placeholder" onClick={() => fileInputRef.current.click()}>
                  <div className="upload-icon">+</div>
                  <p>Click to select an image</p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImageChange} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
        </div>
            
            <div className="caption-section">
              <textarea 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption..."
                rows={4}
              />
        </div>
            
            {progress > 0 && progress < 100 && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
            )}
          </>
        )}
        </div>
      
      {!isSuccess && (
        <div className="modal-actions">
          <button 
            className="cancel-button" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="publish-button" 
            onClick={handleSubmit}
            disabled={isSubmitting || !image}
          >
            {isSubmitting ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      )}
    </>
  );
};

// Video Post Creator Component
const VideoPostCreator = ({ onClose }) => {
  const [caption, setCaption] = useState('');
  const [video, setVideo] = useState(null);
  const [preview, setPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const [thumbnail, setThumbnail] = useState(null);

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file is a video
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }
    
    // Check file size (limit to 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      alert(`File too large. Maximum size is 100MB.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setVideo(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      
      // After preview is loaded, try to generate a thumbnail
      setTimeout(() => {
        if (videoRef.current) {
          try {
            // Set video to a specific time for thumbnail
            videoRef.current.currentTime = 1;
            
            // When time updates, capture the thumbnail
            videoRef.current.addEventListener('timeupdate', function onTimeUpdate() {
              // Create a canvas and draw the current video frame
              const canvas = document.createElement('canvas');
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              
              // Convert canvas to data URL
              const thumbnailDataUrl = canvas.toDataURL('image/jpeg');
              setThumbnail(thumbnailDataUrl);
              
              // Remove the event listener to avoid multiple calls
              videoRef.current.removeEventListener('timeupdate', onTimeUpdate);
            });
          } catch (error) {
            console.error('Error generating thumbnail:', error);
          }
        }
      }, 500);
    };
    reader.readAsDataURL(file);
  };

  const uploadVideoToFirebase = async (file) => {
    const userId = localStorage.getItem('userId');
    
    try {
      // Import Firebase storage modules
      const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../utils/firebaseConfig');
      
      if (!storage) {
        throw new Error('Firebase storage not available');
      }
      
      // Create a unique filename
      const fileName = `reels/${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      
      // Create storage reference
      const storageRef = ref(storage, fileName);
      
      // Start upload
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        // Monitor upload progress
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(progress);
          },
          (error) => {
            console.error('Error uploading to Firebase:', error);
            reject(error);
          },
          async () => {
            // Get download URL after upload completes
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (urlError) {
              console.error('Error getting download URL:', urlError);
              reject(urlError);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error initializing Firebase upload:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!video) {
      alert('Please select a video');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('accessToken');
      
      if (!userId || !token) {
        alert('You must be logged in to create a reel');
        return;
      }

      let videoUrl = '';
      
      // For larger videos, use Firebase storage
      try {
        videoUrl = await uploadVideoToFirebase(video);
        console.log('Video uploaded to Firebase:', videoUrl);
      } catch (firebaseError) {
        console.error('Firebase upload failed:', firebaseError);
        alert('Failed to upload video. Please try again or use a smaller file.');
        setIsSubmitting(false);
        return;
      }
      
      // Create post data - Specifically mark as a reel (not regular post)
      const postData = {
        text: caption,
        videoUrl: videoUrl,
        postType: 'reel' // Explicitly mark as reel
      };
      
      // Add thumbnail if we have one
      if (thumbnail) {
        // Convert data URL to blob for upload
        const response = await fetch(thumbnail);
        const blob = await response.blob();
        
        // Create a File object from the blob
        const thumbnailFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
        
        try {
          // Upload thumbnail to Firebase
          const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
          const { storage } = await import('../utils/firebaseConfig');
          
          const thumbnailRef = ref(storage, `thumbnails/${userId}/${Date.now()}_thumbnail.jpg`);
          const uploadTask = uploadBytesResumable(thumbnailRef, thumbnailFile);
          
          // Get download URL after upload completes
          await uploadTask;
          const thumbnailUrl = await getDownloadURL(thumbnailRef);
          
          // Add thumbnail URL to post data
          postData.image = thumbnailUrl;
        } catch (thumbnailError) {
          console.error('Error uploading thumbnail:', thumbnailError);
          // Continue without thumbnail
        }
      }
      
      // Create post via API
      const response = await axios.post(
        `http://localhost:3080/user/${userId}/post/userpost/create`,
        postData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        // Show success animation instead of alert
        setIsSuccess(true);
        
        // Automatically close modal after success animation
        setTimeout(() => {
          onClose();
          
          // Refresh the feed to show the new reel (but not the whole page)
          if (window.refreshFeed && typeof window.refreshFeed === 'function') {
            window.refreshFeed();
          } else {
            // Fallback to page reload if no refresh function is available
            window.location.reload();
          }
        }, 1500);
      } else {
        alert('Failed to create reel. Please try again.');
      }
    } catch (error) {
      console.error('Error creating reel:', error);
      alert('Error creating reel. Please try again.');
    } finally {
      if (!isSuccess) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <div className="post-creator">
        {isSuccess ? (
          <div className="success-animation">
            <div className="success-icon">✓</div>
            <p>Reel created successfully!</p>
          </div>
        ) : (
          <>
            <div className="media-section">
              {preview ? (
                <div className="media-preview">
                  <video 
                    ref={videoRef}
                    src={preview} 
                    controls 
                    className="video-preview"
                  />
                  <button className="remove-media" onClick={() => {
                    setVideo(null);
                    setPreview('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}>×</button>
                </div>
              ) : (
                <div className="upload-placeholder" onClick={() => fileInputRef.current.click()}>
                  <div className="upload-icon">+</div>
                  <p>Click to select a video</p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleVideoChange} 
                accept="video/*" 
                style={{ display: 'none' }} 
              />
            </div>
            
            <div className="caption-section">
              <textarea 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption for your reel..."
                rows={4}
              />
            </div>
            
            {progress > 0 && progress < 100 && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
            )}
          </>
        )}
      </div>
      
      {!isSuccess && (
        <div className="modal-actions">
          <button 
            className="cancel-button" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="publish-button" 
            onClick={handleSubmit}
            disabled={isSubmitting || !video}
          >
            {isSubmitting ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      )}
    </>
  );
};

export default Sidebar;
