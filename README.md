# Rizzit - A MERN Stack Social Media Platform

Rizzit is a full-stack social media platform built using the MERN (MongoDB, Express.js, React, Node.js) stack. It includes real-time features, user authentication, and a seamless UI similar to popular social media platforms.

## Features

### User Authentication
- Secure user authentication using JWT.
- Registration and login with email and password.
- Profile management.

### Posts & Interactions
- Users can create, edit, and delete posts.
- Like and comment functionality for posts.
- Real-time updates using Socket.IO.

### Stories
- Users can upload and view stories.
- Unwatched stories are indicated with an orange circle.


### Database & Backend
- MongoDB for efficient NoSQL data storage.
- API authentication with headers for secure data fetching.
- Optimized queries for better performance.

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
3. Start the React app:
   ```bash
   npm start
   ```

## Tech Stack
- **Frontend:** React, Redux
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Real-Time:** Socket.IO
- **Authentication:** JWT

## Contribution
Contributions are welcome! Feel free to fork this repo, make changes, and submit a pull request.

## License
This project is licensed under the MIT License.



