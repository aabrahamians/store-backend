require("dotenv").config({ path: "./variables.env", debug: process.env.DEBUG });
const createServer = require("./createServer");
const db = require("./db");

const server = createServer();

// handle cookies populate current users

server.start(
  {
    cors: {
      credentials: true,
      origin: process.env.FRONTEND_URL
    }
  },
  serverReady => {
    console.log("fdafasfdasdf", process.env.PORT);
    console.log(
      `Server is now running on port ${process.env.IP}:${serverReady.port}`
    );
  }
);
