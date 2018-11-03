const Query = {
  items(parent, args, ctx, info) {
    global.dogs = global.dogs || [];
    return global.dogs;
  }
};

module.exports = Query;
