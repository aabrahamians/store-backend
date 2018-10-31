require('dotenv').config({patch: 'variables.env'});
const createServer = require('./createServer');
const db = require('./db');

const server = createServer();

// handle cookies paopulate current users

server.start({
    cors: {
        credentials: true,
        origin: process.env.FRONTEND_URL,
    }
}, serverReady => {
    console.log(`Server is now running on port http:/localhost:${ServerReady.port}`)
});