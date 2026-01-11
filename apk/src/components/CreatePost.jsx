import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Video, X, Upload, Paperclip, Film, Camera, Text, Clock } from 'lucide-react';
import axios from 'axios';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../utils/firebaseConfig';
import { useNavigate } from 'react-router-dom';
import '../styles/CreatePost.css';
import API from '../utils/api';

const CreatePost = ({ onPostCreated, onCancel }) => {
  const [text, setText] = useState('');
  const [media, setMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' or 'video'
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [postType, setPostType] = useState('post'); // 'post' or 'reel'
  const [activeTab, setActiveTab] = useState('post'); // 'post' or 'reel'
  const [aspectRatio, setAspectRatio] = useState('4:5'); // Default Instagram post ratio
  const [duration, setDuration] = useState(0); // For video duration in seconds
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const formRef = useRef(null);
  const submitButtonRef = useRef(null);
  const navigate = useNavigate();

  // Scroll detection for the form
  useEffect(() => {
    const handleScroll = () => {
      if (formRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = formRef.current;
        const isScrollable = scrollHeight > clientHeight;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        
        if (isScrollable) {
          formRef.current.classList.add('scrollable');
        } else {
          formRef.current.classList.remove('scrollable');
        }
        
        if (isAtBottom) {
          formRef.current.classList.add('at-bottom');
        } else {
          formRef.current.classList.remove('at-bottom');
        }
      }
    };

    const form = formRef.current;
    if (form) {
      form.addEventListener('scroll', handleScroll);
      // Initial check
      handleScroll();
    }

    return () => {
      if (form) {
        form.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Handle click on the scroll indicator to scroll to the submit button
  useEffect(() => {
    const handleScrollIndicatorClick = (e) => {
      if (e.target === formRef.current?.querySelector('::after') || 
          e.target.closest('.create-post-form::after')) {
        submitButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    document.addEventListener('click', handleScrollIndicatorClick);
    
    return () => {
      document.removeEventListener('click', handleScrollIndicatorClick);
    };
  }, []);

  // Create a manual scroll to bottom function
  const scrollToBottom = () => {
    submitButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Add click handler directly on the ::after pseudo-element using JavaScript
  useEffect(() => {
    const handleFormClick = (e) => {
      // Calculate if the click was on the area where the ::after pseudo-element is
      const form = formRef.current;
      if (!form) return;
      
      const rect = form.getBoundingClientRect();
      const isInRightBottomCorner = 
        e.clientX > rect.right - 60 && 
        e.clientX < rect.right - 20 &&
        e.clientY > rect.bottom - 140 && 
        e.clientY < rect.bottom - 100;
      
      if (isInRightBottomCorner) {
        scrollToBottom();
      }
    };

    const form = formRef.current;
    if (form) {
      form.addEventListener('click', handleFormClick);
    }

    return () => {
      if (form) {
        form.removeEventListener('click', handleFormClick);
      }
    };
  }, []);

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type
    const fileType = file.type.split('/')[0];
    if (fileType !== 'image' && fileType !== 'video') {
      alert('Please upload an image or video file.');
      return;
    }

    // Check video duration if it's a reel
    if (fileType === 'video' && activeTab === 'reel') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = function() {
        window.URL.revokeObjectURL(video.src);
        const durationSeconds = video.duration;
        
        // Instagram reels can be 3-90 seconds
        if (durationSeconds < 3) {
          alert('Reels must be at least 3 seconds long.');
          return;
        }
        
        if (durationSeconds > 90) {
          alert('Reels must be no longer than 90 seconds.');
          return;
        }
        
        setDuration(durationSeconds);
        processMedia(file, fileType);
      };
      
      video.src = URL.createObjectURL(file);
    } else {
      processMedia(file, fileType);
    }
  };
  
  const processMedia = (file, fileType) => {
    // Set media type
    setMediaType(fileType);
    setMedia(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setMedia(null);
    setMediaPreview(null);
    setMediaType(null);
    setUploadProgress(0);
    setDuration(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadMediaToFirebase = async (file) => {
    return new Promise((resolve, reject) => {
      const folder = postType === 'reel' ? 'reels' : 'posts';
      const fileName = `${folder}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Error uploading file:', error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!text.trim() && !media) {
      alert('Please add some text or media to your post.');
      return;
    }
    
    // For reels, a video is required
    if (postType === 'reel' && (!media || mediaType !== 'video')) {
      alert('Reels require a video.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('accessToken');
      
      if (!userId || !token) {
        alert('You must be logged in to create a post.');
        setIsSubmitting(false);
        return;
      }

      let mediaUrl = null;
      
      // Upload media to Firebase if present
      if (media) {
        mediaUrl = await uploadMediaToFirebase(media);
      }
      
      // Prepare post data
      const postData = {
        text: text.trim(),
        postType: postType, // Add postType to differentiate posts and reels
      };
      
      // Add aspect ratio for better display
      if (aspectRatio) {
        postData.aspectRatio = aspectRatio;
      }
      
      // Add media URL based on type
      if (mediaUrl) {
        if (mediaType === 'image') {
          postData.image = mediaUrl;
        } else if (mediaType === 'video') {
          postData.video = mediaUrl;
          if (duration) {
            postData.duration = duration;
          }
        }
      }
      
      // Create post via API
      const response = await API.post(
        `/user/${userId}/post/userpost/create`,
        postData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      if (response.data.success) {
        // Reset form
        setText('');
        removeMedia();
        
        // Notify parent component if provided
        if (typeof onPostCreated === 'function') {
          onPostCreated();
        } else {
          // Navigate to profile page if no callback was provided
          navigate(`/profile/${userId}`);
        }
      } else {
        alert('Failed to create post. Please try again.');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };
  
  // Set post type based on active tab
  useEffect(() => {
    setPostType(activeTab);
    // Clear media when switching tabs
    removeMedia();
  }, [activeTab]);
  
  // Get video duration when video is loaded
  useEffect(() => {
    if (videoRef.current && mediaType === 'video') {
      videoRef.current.onloadedmetadata = () => {
        setDuration(videoRef.current.duration);
      };
    }
  }, [mediaPreview, mediaType]);

  return (
    <div className="create-post-container">
      <form onSubmit={handleSubmit} className="create-post-form" ref={formRef}>
        <div className="create-post-header">
          <h2>{postType === 'reel' ? 'Create Reel' : 'Create Post'}</h2>
          {onCancel && (
            <button type="button" className="cancel-button" onClick={onCancel}>
              <X size={20} />
            </button>
          )}
        </div>
        
        <div className="create-post-tabs">
          <button 
            type="button"
            className={`tab-button ${activeTab === 'post' ? 'active' : ''}`}
            onClick={() => setActiveTab('post')}
          >
            <Camera size={18} />
            <span>Post</span>
          </button>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'reel' ? 'active' : ''}`}
            onClick={() => setActiveTab('reel')}
          >
            <Film size={18} />
            <span>Reel</span>
          </button>
        </div>
        
        <div className="create-post-content">
          {activeTab === 'reel' ? (
            <div className="reel-info">
              <Clock size={16} />
              <span>Reels must be 3-90 seconds long</span>
            </div>
          ) : null}
        
          {mediaPreview ? (
            <div className={`media-preview-container ${postType}`}>
              {mediaType === 'image' ? (
                <img src={mediaPreview} alt="Preview" className={`media-preview ${aspectRatio.replace(':', '-')}`} />
              ) : (
                <video 
                  src={mediaPreview} 
                  controls 
                  className={`media-preview ${aspectRatio.replace(':', '-')}`}
                  ref={videoRef}
                />
              )}
              <button 
                type="button" 
                className="remove-media-button"
                onClick={removeMedia}
                disabled={isSubmitting}
              >
                <X size={16} />
              </button>
              
              {mediaType === 'video' && duration > 0 && (
                <div className="video-duration">
                  {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
          ) : (
            <div className="upload-prompt">
              <div className="upload-icon">
                {activeTab === 'reel' ? <Film size={48} /> : <Upload size={48} />}
              </div>
              <p className="upload-text">
                {activeTab === 'reel' 
                  ? 'Upload a video for your reel' 
                  : 'Drag photos and videos here or click to upload'}
              </p>
              <label className="upload-button">
                {activeTab === 'reel' ? 'Select Video' : 'Select Media'}
                <input
                  type="file"
                  accept={activeTab === 'reel' ? "video/*" : "image/*,video/*"}
                  onChange={handleMediaChange}
                  disabled={isSubmitting}
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
          
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder={activeTab === 'reel' ? "Write a caption for your reel..." : "What's on your mind?"}
            className="post-text-input"
            rows={4}
            disabled={isSubmitting}
          />
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="upload-progress">
              <div 
                className="upload-progress-bar" 
                style={{ width: `${uploadProgress}%` }}
              />
              <span className="upload-progress-text">{Math.round(uploadProgress)}%</span>
            </div>
          )}
          
          {mediaType === 'image' && (
            <div className="aspect-ratio-selector">
              <span>Aspect Ratio:</span>
              <select 
                value={aspectRatio} 
                onChange={(e) => setAspectRatio(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="1:1">Square (1:1)</option>
                <option value="4:5">Portrait (4:5)</option>
                <option value="16:9">Landscape (16:9)</option>
              </select>
            </div>
          )}
        </div>
        
        <div className="create-post-actions">
          {!mediaPreview && (
            <div className="media-actions">
              {activeTab === 'post' ? (
                <>
                  <label className="media-button">
                    <ImageIcon size={20} />
                    <span>Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMediaChange}
                      disabled={isSubmitting || media !== null}
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                    />
                  </label>
                  
                  <label className="media-button">
                    <Video size={20} />
                    <span>Video</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleMediaChange}
                      disabled={isSubmitting || media !== null}
                      style={{ display: 'none' }}
                    />
                  </label>
                </>
              ) : (
                <label className="media-button">
                  <Film size={20} />
                  <span>Video</span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleMediaChange}
                    disabled={isSubmitting || media !== null}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
          )}
          
          <button 
            type="submit" 
            className="post-button"
            disabled={isSubmitting || 
              (!text.trim() && !media) || 
              (postType === 'reel' && (!media || mediaType !== 'video'))}
            ref={submitButtonRef}
          >
            {isSubmitting ? 'Posting...' : postType === 'reel' ? 'Share Reel' : 'Share Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost; 