//connect remote prisma allows query with js

const { Prisma } = require('prisma-binding');



const db = new Prisma({
    typeDefs: 'src/generated/prisma.graphql',
    endpoint: 'https://us1.prisma.sh/areg-abrahamians-14cbb6/store-backend/dev',
    secret: process.env.PRISMA_SECRET,
    debug: false
})

module.exports = db;