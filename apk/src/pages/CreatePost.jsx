import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import CreatePost from '../components/CreatePost';
import '../styles/CreatePost.css';

const CreatePostPage = () => {
  const navigate = useNavigate();

  const handlePostCreated = () => {
    // Navigate to home after successful post creation
    navigate('/');
  };

  const handleCancel = () => {
    // Navigate back when cancelled
    navigate(-1);
  };

  return (
    <div className="create-post-page">
      <Sidebar />
      <div className="create-post-content-wrapper">
        <CreatePost 
          onPostCreated={handlePostCreated} 
          onCancel={handleCancel} 
        />
      </div>
    </div>
  );
};

export default CreatePostPage; 