const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify }= require('util');
const { transport, makeEmail }= require('../mail');

const Mutations = {
  async createItem(parent, args, ctx, info) {

    if(!ctx.request.userId) {
      throw new Error('must be logged in')
    }

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          user: { 
            connect:{
              id: ctx.request.userId
            }
          },
          ...args
        }
      },
      info
    );
    return item;
  },
  updateItem(parent, args, ctx, info){
    //copy updates
    const updates = {... args};
    // remove id
    delete updates.id;
    //run update
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id,
        },
      },
      info
    );
  },
  async deleteItem(parent, args, ctx, info){
    const where = { id: args.id };
    // 1. find the item
    const item = await ctx.db.query.item({ where }, `{ id title}`);
    // 2. Check if they own that item, or have the permissions
    // TODO
    // 3. Delete it!
    return ctx.db.mutation.deleteItem({ where }, info);
  },

  async signup(parent,args,ctx,info){
    //lower case
    args.email = args.email.toLowerCase();
    //salt pass
    const password = await bcrypt.hash(args.password, 10)
    // create user
    const user = await ctx.db.mutation.createUser({
      data: {
        ...args,
        password,
        permissions: { set: ['USER'] }
      }
    },info);
    //create token for login
    const token = jwt.sign({ userId: user.id}, process.env.APP_SECRET)
    // set jwt as cookie on response
    ctx.response.cookie('token', token,{
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
    return user;
  },
  
  async signin(parent, {email, password}, ctx, info){
    // find user
    const user = await ctx.db.query.user({ where : {email}})
    if(!user){
      throw new Error(`no such user found for email ${email}`)
    }
    // check pass
    const valid = await bcrypt.compare(password, user.password)
    if(!valid){
      throw new Error(`Invalid Password`)
    }
    // generate jwt
    const token = jwt.sign({ userId: user.id}, process.env.APP_SECRET)
    // set jwt
    ctx.response.cookie('token', token,{
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
    // retun user
    return user;
  },

  signout(parent, {email, password}, ctx, info){
    ctx.response.clearCookie('token');
    return { message: 'Goodbye!' };
  },

  async requestReset(parent, {email}, ctx, info){
    //check if real user
    const user = await ctx.db.query.user({ where : { email: email }});
    if(!user){
      throw new Error(`no user found for email ${email}`)
    }
    //set reset token and expiry
    const randomByteePromiseified = promisify(randomBytes);
    const resetToken = (await randomByteePromiseified(20)).toString('hex');
    const resetTokenExpiry = Date.now()  + 3600000; //1 hour
    
    const res = await ctx.db.mutation.updateUser({
      where: { email  },
      data: { resetToken, resetTokenExpiry },
    });

    const mailRes= await transport.sendMail({
      from:'areg@areg.com',
      to: email,
      subject: 'Password Reset Requested',
      html: makeEmail(`your password reset token is here! <a href='${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}'> click here</a>`)
    })


    return{ message: "thanks"}
  },
  async resetPassword(parent, {password, confirmPassword,email, resetToken}, ctx, info) {
    // check if the passwords match
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match");
    }
    // check token and expiry

    const [ user ] = await ctx.db.query.users({
      where: {
        resetToken: resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000,
      },
    });
  
    if (!user) {
      throw new Error('This token is either invalid or expired!');
    }
    // Hash their new password
    const newPassword = await bcrypt.hash(password, 10);
    // Save the new password to the user and remove old resetToken fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // 6. Generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    // 7. Set the JWT cookie
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
    // 8. return the new user
    return updatedUser;
  },
};

module.exports = Mutations;