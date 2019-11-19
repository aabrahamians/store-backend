const { forwardTo } = require('prisma-binding');
const { hasPermission } = require('../utils');

const Query = {
  items: forwardTo('db'),
  item: forwardTo('db'),
  itemsConnection: forwardTo('db'),
  me(parent, args, ctx, info) {
    // check if there is a current user ID
    if (!ctx.request.userId) {
      return null;
    }
    return ctx.db.query.user(
      {
        where: { id: ctx.request.userId },
      },
      info
    );
  },
  async users(parent, args, ctx, info) {
    //  Check if they are logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in!');
    }
    // Check if the user has the permissions to query all the users
    hasPermission(ctx.request.user, ['ADMIN','USER', 'PERMISSIONUPDATE']);

    // if they do, query all the users!
    return ctx.db.query.users({}, info);
  },
  async order(parent, args, ctx, info){
    // check login
    
    if(!ctx.request.userId) throw new Error('not logged in')
    
    // query currentorder 
    const order = await ctx.db.query.order({
      where: { id: args.id}
    }, info)
    
    //check permission
    const ownsOrder =  order.user.id === ctx.request.userId;
    const hasPermissionToViewOrder = ctx.request.user.permissions.includes('ADMIN')
    if(!ownsOrder || !hasPermissionToViewOrder){
      throw new Error('Not allowed to see this order')
    }
    return order
  },
  async orders(parent, args, ctx, info){
    const { userId } = ctx.request;

    if(!userId) throw new Error('you must be signed in')

    return ctx.db.query.orders(
      {
        where: {
          user: { id: userId },
        },
      },
      info
    );
  },
};

module.exports = Query;
