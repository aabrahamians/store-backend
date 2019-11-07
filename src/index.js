const cookieParse = require('cookie-parser')
const jwt = require('jsonwebtoken');
require("dotenv").config({ path: "./variables.env", debug: process.env.DEBUG });
const createServer = require("./createServer");
const db = require("./db");

const server = createServer();

// populate current users
server.express.use(cookieParse());

//decode the json web token to use user id on each request
server.express.use((req,res,next)=>{
    const { token } = req.cookies;
  if(token){
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    // put the userId onto the req for future requests to access
    req.userId = userId;
  }
  next();
})

server.start(
  {
    cors: {
      credentials: true,
      origin: process.env.FRONTEND_URL
    }
  },
  serverReady => {
    console.log("fdafasfdasdf", process.env.PORT);
    debugger
    console.log(
      `Server is now running on port ${process.env.FRONTEND_URL}:${serverReady.port}`
    );
  }
);
