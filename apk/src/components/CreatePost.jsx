import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Video, X, Upload, Paperclip } from 'lucide-react';
import axios from 'axios';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../utils/firebaseConfig';
import '../styles/CreatePost.css';

const CreatePost = ({ onPostCreated }) => {
  const [text, setText] = useState('');
  const [media, setMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' or 'video'
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadMediaToFirebase = async (file) => {
    return new Promise((resolve, reject) => {
      const fileName = `posts/${Date.now()}_${file.name}`;
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
      };
      
      // Add media URL based on type
      if (mediaUrl) {
        if (mediaType === 'image') {
          postData.image = mediaUrl;
        } else if (mediaType === 'video') {
          postData.video = mediaUrl;
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
        // Reset form
        setText('');
        removeMedia();
        
        // Notify parent component
        if (typeof onPostCreated === 'function') {
          onPostCreated();
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

  return (
    <div className="create-post-container">
      <form onSubmit={handleSubmit} className="create-post-form">
        <div className="create-post-header">
          <h2>Create Post</h2>
        </div>
        
        <div className="create-post-content">
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="What's on your mind?"
            className="post-text-input"
            rows={4}
            disabled={isSubmitting}
          />
          
          {mediaPreview && (
            <div className="media-preview-container">
              {mediaType === 'image' ? (
                <img src={mediaPreview} alt="Preview" className="media-preview" />
              ) : (
                <video src={mediaPreview} controls className="media-preview" />
              )}
              <button 
                type="button" 
                className="remove-media-button"
                onClick={removeMedia}
                disabled={isSubmitting}
              >
                <X size={16} />
              </button>
            </div>
          )}
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="upload-progress">
              <div 
                className="upload-progress-bar" 
                style={{ width: `${uploadProgress}%` }}
              />
              <span className="upload-progress-text">{Math.round(uploadProgress)}%</span>
            </div>
          )}
        </div>
        
        <div className="create-post-actions">
          <div className="media-actions">
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
          </div>
          
          <button 
            type="submit" 
            className="post-button"
            disabled={isSubmitting || (!text.trim() && !media)}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost; 