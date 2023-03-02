import {Link} from "react-router-dom";
import {useEffect,useContext} from "react";
import {UserContext} from "./UserContext";
import axios from "axios";

export default function Header() {
  const {setUserInfo,userInfo} = useContext(UserContext);
  useEffect(() => {
    axios('/profile', {
      credentials: 'include',
    }).then(response => {
      response.json().then(userInfo => {
        setUserInfo(userInfo);
      });
    });
  }, []);

  // want to invalidate the cookie to logout
  function logout() {
    axios('/logout', {
      credentials: 'include',
      method: 'POST',
    });
    setUserInfo(null);
  }

  const username = userInfo?.username;

  return (
    <header>
      <Link to="/" className="logo">Movie Blog</Link>
      <nav>
    {username && (
      <>
        <span>Hello, {username}</span>
        <Link to='/create'>Create new post</Link>
        <a onClick={logout}>Logout</a>
      </>
    )}
    {!username && (
      <>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </>
    )}
      </nav>
    </header>
  );
}
