const cookieParse = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "./variables.env", debug: process.env.DEBUG });
const createServer = require("./createServer");
const db = require("./db");

const server = createServer();

// populate current users
server.express.use(cookieParse());

//decode the json web token to use user id on each request
server.express.use((req, res, next) => {
  const { token } = req.cookies;
  if (token) {
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    // put the userId onto the req for future requests to access
    req.userId = userId;
  }
  next();
});
// populate user on each request
server.express.use(async (req, res, next) => {
  if (!req.userId) return next();

  const where = {
    id: req.userId
  };
  const user = await db.query.user({ where }, "{id, permissions, email, name}");
  req.user = user;

  next();
});

server.start(
  {
    cors: {
      credentials: true,
      // origin: process.env.FRONTEND_URL
      origin: function(origin, callback) {
        // allow requests with no origin
        // (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (process.env.FRONTEND_CORS_ARRAY.indexOf(origin) === -1) {
          var msg =
            "The CORS policy for this site does not " +
            "allow access from the specified Origin.";
          return callback(new Error(msg), false);
        }
        return callback(null, true);
      }
    }
  },
  serverReady => {
    console.log(
      `Server is now running on port http://localhost:${serverReady.port}`
    );
  }
);
