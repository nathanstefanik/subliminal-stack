const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3');
const multer = require('multer');
//const uploadMiddleware = multer({dest: 'uploads/'});
const uploadMiddleware = multer({dest: 'tmp/'});
const cookieParser = require('cookie-parser');
const fs = require('fs');
const app = express();
require('dotenv').config();

const salt = bcrypt.genSaltSync(10);
const secret = process.env.SECRET;
const bucket = 'subliminal-stack';

app.use(cors({credentials:true,origin:'http://localhost:3000'}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

//mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jgjfzkv.mongodb.net/?retryWrites=true&w=majority`)

async function uploadToS3(path, originalFileName, mimetype) {
  const client =new S3Client({
    region: 'us-east-2',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY, 
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    }
  });
  const parts = originalFileName.split('.');
  const ext = parts[parts.length - 1];
  const newFileName = Date.now() + '.' + ext;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Body: fs.readFileSync(path),
    Key: newFileName,
    ContentType: mimetype,
    ACL: 'public-read',
  }));
  return `https://${bucket}.s3.amazonaws.com/${newFileName}` 
}

app.post('/register', async (req,res) => {
  mongoose.connect(process.env.MONGO_URL);
  const {username,password} = req.body;
  try{
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch(e) {
    console.log(e);
    res.status(400).json(e);
  }
});

app.post('/login', async (req,res) => {
  mongoose.connect(process.env.MONGO_URL);
  const {username,password} = req.data;
  const userDoc = await User.findOne({username});
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    jwt.sign({username,id:userDoc._id}, secret, {}, (err,token) => {
      if (err) throw err;
      res.cookie('token', token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json('Incorrect credentials');
  }
});

app.get('/profile', (req,res) => {
  mongoose.connect(process.env.MONGO_URL);
  const {token} = req.cookies
  jwt.verify(token, secret, {}, (err,info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post('/logout', (req,res) => {
  mongoose.connect(process.env.MONGO_URL);
  res.cookie('token', '').json('ok');
});

app.post('/post', uploadMiddleware.single('files'), async (req,res) => {

  mongoose.connect(process.env.MONGO_URL);
  const {originalname,path,mimetype} = req.file;
  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const url = await uploadToS3(path,originalname,mimetype);
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      img:url,
      author:info.id,
    });
    res.json(postDoc);
  });
});

app.put('/post', uploadMiddleware.single('file'), async (req,res) => {

  mongoose.connect(process.env.MONGO_URL);
  let url = null;
  if (req.file) {
    const {originalname,path,mimetype} = req.file;
    url = await uploadToS3(path,originalname,mimetype);
    fs.renameSync(path, url);
  }
  console.log({url});

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {id,title,summary,content} = req.body;
    console.log({id,title,summary,content});
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('Editing is only allowed for the original author');
    }
    await postDoc.update({
      title,
      summary,
      content,
      img: url ? url : postDoc.img,
    });

    res.json(postDoc);
  });

});

app.get('/post', async (req,res) => {
  mongoose.connect(process.env.MONGO_URL);
  res.json(await Post.find()
    .populate('author', ['username'])
    .sort({createdAt: -1})
    .limit(20)
  );
});

app.get('/post/:id', async (req,res) => {
  mongoose.connect(process.env.MONGO_URL);
  const {id} = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc);
});

app.listen(4000);
