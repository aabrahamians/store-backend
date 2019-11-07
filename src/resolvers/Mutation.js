const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');
const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: check auth

    const item = await ctx.db.mutation.createItem(
      {
        data: {
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

};

module.exports = Mutations;