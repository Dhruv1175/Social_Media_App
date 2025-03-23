# Rizzit - A MERN Stack Social Media Platform

Rizzit is a full-stack social media platform built using the MERN (MongoDB, Express.js, React, Node.js) stack. It includes real-time features, user authentication, and a seamless UI similar to popular social media platforms.

## Features

### User Authentication
- Secure user authentication using JWT.
- Registration and login with email and password.
- Profile management.

### Instagram-like Posts
- **Create Posts**: Add text, images, and videos to your posts
- **Media Uploads**: Upload images and videos directly from your device using Firebase Storage
- **Post Management**: 
  - Edit post text after publishing
  - Delete unwanted posts with confirmation dialog
- **Interactive Elements**:
  - Like/unlike posts with real-time counter updates
  - Save/bookmark posts for later viewing
  - Comment on posts (view all comments)
- **Rich Media Support**:
  - Image display with responsive sizing
  - Video playback directly in the feed
- **User Experience**:
  - Instagram-style post layout
  - Optimistic UI updates for instant feedback

### Stories
- Users can upload and view stories.
- Unwatched stories are indicated with an orange circle.

### Database & Backend
- MongoDB for efficient NoSQL data storage.
- API authentication with headers for secure data fetching.
- Optimized queries for better performance.
- Firebase Storage integration for media files.

### UI & Frontend
- Clean and intuitive UI inspired by modern social media platforms.
- Sidebar with icons using `lucide-react`.
- Responsive design for mobile and desktop.

## Installation & Setup

### Prerequisites
Make sure you have the following installed:
- Node.js
- MongoDB
- npm or yarn
- Firebase account with Storage enabled

### Backend Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Dhruv1175/Social_Media_App.git
   cd Social_Media_App/backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file and configure your environment variables:
   ```env
   JWT_SECRET=your_secret_key
   PORT=your_backend_port
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend folder:
   ```bash
   cd ../apk
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up Firebase configuration:
   - Create a `.env` file with your Firebase credentials:
   ```
   REACT_APP_API_KEY=your_firebase_api_key
   ```
4. Start the React app:
   ```bash
   npm start
   ```

## Usage Guide

### Creating a Post
1. Navigate to the Feed page
2. Use the "Create Post" form at the top of your feed
3. Add text to describe your post
4. To include media:
   - Click the "Image" button to upload an image
   - Click the "Video" button to upload a video
5. Preview your media before posting
6. Click "Post" to publish to your feed
7. Your post will appear in the feed immediately

### Editing a Post
1. Find the post you want to edit in your feed
2. Click the three dots (⋯) menu in the top-right corner of your post
3. Select "Edit" from the dropdown menu
4. Modify the text as needed in the text editor
5. Click "Save" to update your post or "Cancel" to discard changes
6. Your post will be updated instantly

### Deleting a Post
1. Find the post you want to delete
2. Click the three dots (⋯) menu in the top-right corner of your post
3. Select "Delete" from the dropdown menu
4. Confirm deletion in the dialog that appears
5. The post will be permanently removed from your feed

### Interacting with Posts
- **Like**: Click the heart icon to like a post
- **Comment**: Click the comment icon to view or add comments
- **Save**: Click the bookmark icon to save a post for later viewing

## Tech Stack
- **Frontend:** React, Redux
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Real-Time:** Socket.IO
- **Authentication:** JWT
- **Storage:** Firebase Storage for media files

## Contribution
Contributions are welcome! Feel free to fork this repo, make changes, and submit a pull request.

## License
This project is licensed under the MIT License.



