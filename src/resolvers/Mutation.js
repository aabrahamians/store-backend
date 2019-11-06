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
};

module.exports = Mutations;