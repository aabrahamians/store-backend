const cookieParse = require('cookie-parser')
require("dotenv").config({ path: "./variables.env", debug: process.env.DEBUG });
const createServer = require("./createServer");
const db = require("./db");

const server = createServer();

// populate current users
server.express.use(cookieParse());

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
