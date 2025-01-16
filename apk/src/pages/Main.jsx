import React from 'react'
import Register from './Register'
import {BrowserRouter,Routes,Route} from 'react-router-dom'
import Login from './Login';
import Home1 from './Home';


export default function Main() {
  return (
    <div>
        <BrowserRouter>
        <Routes>
            <Route path={"/register"} element={<Register/>} />
            <Route path={"/"} element={<Login/>} />
            <Route path={"/home"} element={<Home1/>} />
        </Routes>
        </BrowserRouter>
    </div>
  )
}
