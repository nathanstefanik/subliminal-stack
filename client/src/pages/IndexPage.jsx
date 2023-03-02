import Post from "../Post";
import {useEffect,useState} from "react";
import axios from "axios";

export default function IndexPage() {
  const [posts,setPosts] = useState([]);
  useEffect(() => {
    axios('/post').then(response => {
      response.json().then(posts => {
        setPosts(posts);
      });
    });
  }, []);
  return (
    <>
      {posts.length > 0 && posts.map(post => (
        <Post {...post} />
      ))}
    </>
  );
}
