import React from 'react'
import Register from './Register'
import {BrowserRouter,Routes,Route} from 'react-router-dom'
import Login from './Login';
import Home1 from './Home';
import ProfilePage from './ProfilePage';
import MessagingPage from './MessagingPage';
import SearchPage from './SearchPage';
import UserProfilePage from './UserProfilePage';
import FollowsPage from './FollowsPage';
import Settings from './Settings';

export default function Main() {
  return (
    <div className="app">
        <BrowserRouter>
        <Routes>
            <Route path={"/register"} element={<Register/>} />
            <Route path={"/"} element={<Login/>} />
            <Route path={"/home"} element={<Home1/>} />
            <Route path={"/profile"} element={<ProfilePage/>} />
            <Route path={"/profile/:userId"} element={<UserProfilePage/>} />
            <Route path={"/messages"} element={<MessagingPage/>} />
            <Route path={"/search"} element={<SearchPage/>} />
            <Route path={"/follows"} element={<FollowsPage/>} />
            <Route path={"/settings"} element={<Settings/>} />
        </Routes>
        </BrowserRouter>
    </div>
  )
}
