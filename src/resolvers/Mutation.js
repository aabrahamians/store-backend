const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");

const { transport, makeEmail } = require("../mail");
const { hasPermission } = require("../utils");
const stripe = require("../stripe");

const Mutations = {
  async createItem(parent, args, ctx, info) {
    if (!ctx.request.userId) {
      throw new Error("must be logged in");
    }

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          user: {
            connect: {
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
  updateItem(parent, args, ctx, info) {
    //copy updates
    const updates = { ...args };
    // remove id
    delete updates.id;
    //run update
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id
        }
      },
      info
    );
  },
  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    // 1. find the item
    const item = await ctx.db.query.item({ where }, `{ id title user { id}}`);
    // 2. Check if they own that item, or have the permissions
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPerm = ctx.request.user.permissions.some(perm =>
      ["ADMIN", "ITEMDELETE"].includes(perm)
    );

    if (!ownsItem || !hasPerm) {
      throw new Error("you dont have permission to perform this task");
    }
    // 3. Delete it!
    return ctx.db.mutation.deleteItem({ where }, info);
  },

  async signup(parent, args, ctx, info) {
    //lower case
    args.email = args.email.toLowerCase();
    //salt pass
    const password = await bcrypt.hash(args.password, 10);
    // create user
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ["USER"] }
        }
      },
      info
    );
    const mailRes = await transport.sendMail({
      from: "postmaster@alwaysonsaleprinting.com",
      to: args.email,
      subject: "Account Created",
      html: makeEmail(
        `Congratulations ${args.name}, your account was created for alwaysonsaleprinting.com <a href='${process.env.FRONTEND_URL}/'> click here to login</a>  `
      )
    });
    //create token for login
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // set jwt as cookie on response
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
      domain: "alwaysonsaleprinting.com"
    });
    return user;
  },

  async signin(parent, { email, password }, ctx, info) {
    // find user
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`no such user found for email ${email}`);
    }
    // check pass
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error(`Invalid Password`);
    }
    // generate jwt
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // set jwt
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
      domain: "alwaysonsaleprinting.com"
    });
    // retun user
    return user;
  },

  signout(parent, { email, password }, ctx, info) {
    ctx.response.clearCookie("token", { domain: "alwaysonsaleprinting.com" });
    return { message: "Goodbye!" };
  },

  async requestReset(parent, { email }, ctx, info) {
    //check if real user
    const user = await ctx.db.query.user({ where: { email: email } });
    if (!user) {
      throw new Error(`no user found for email ${email}`);
    }
    //set reset token and expiry
    const randomByteePromiseified = promisify(randomBytes);
    const resetToken = (await randomByteePromiseified(20)).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; //1 hour

    const res = await ctx.db.mutation.updateUser({
      where: { email },
      data: { resetToken, resetTokenExpiry }
    });

    const mailRes = await transport.sendMail({
      from: "postmaster@alwaysonsaleprinting.com",
      to: email,
      subject: "Password Reset Requested",
      html: makeEmail(
        `your password reset token is here! <a href='${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}'> click here</a>`
      )
    });

    return { message: "thanks" };
  },
  async resetPassword(
    parent,
    { password, confirmPassword, email, resetToken },
    ctx,
    info
  ) {
    // check if the passwords match
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match");
    }
    // check token and expiry

    const [user] = await ctx.db.query.users({
      where: {
        resetToken: resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000
      }
    });

    if (!user) {
      throw new Error("This token is either invalid or expired!");
    }
    // Hash their new password
    const newPassword = await bcrypt.hash(password, 10);
    // Save the new password to the user and remove old resetToken fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    // 6. Generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    // 7. Set the JWT cookie
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
      domain: "alwaysonsaleprinting.com"
    });
    // 8. return the new user
    return updatedUser;
  },
  async updatePermissions(parent, { permissions, userId }, ctx, info) {
    // check if logged in

    if (!ctx.request.userId) {
      throw new Error("must be logged in");
    }

    //query current user
    const user = await ctx.db.query.user({ where: { id: userId } }, info);

    // check if they have permissions
    hasPermission(user, ["ADMIN", "PERMISSIONUPDATE"]);
    // update permissions
    const updatedUser = await ctx.db.mutation.updateUser({
      data: {
        permissions: {
          set: permissions
        }
      },
      where: { id: userId }
    });
    return user;
  },
  async updatePermissions(parent, { permissions, userId }, ctx, info) {
    // check if logged in

    if (!ctx.request.userId) {
      throw new Error("must be logged in");
    }

    //query current user
    const user = await ctx.db.query.user({ where: { id: userId } }, info);

    // check if they have permissions
    hasPermission(user, ["ADMIN", "PERMISSIONUPDATE"]);
    // update permissions
    const updatedUser = await ctx.db.mutation.updateUser({
      data: {
        permissions: {
          set: permissions
        }
      },
      where: { id: userId }
    });
    return user;
  },
  async addToCart(parent, args, ctx, info) {
    // check if logged in
    const { userId } = ctx.request;
    if (!userId) {
      throw new Error("must be logged in");
    }

    //does item exsist in users cart
    const [exsistingCartItem] = await ctx.db.query.cartItems(
      {
        where: {
          user: { id: userId },
          item: { id: args.id }
        }
      },
      info
    );

    if (exsistingCartItem) {
      return ctx.db.mutation.updateCartItem({
        where: {
          id: exsistingCartItem.id
        },
        data: {
          quantity: exsistingCartItem.quantity + 1
        }
      });
    }
    return ctx.db.mutation.createCartItem({
      data: {
        user: {
          connect: { id: userId }
        },
        item: {
          connect: { id: args.id }
        }
      }
    });
  },
  async removeFromCart(parent, args, ctx, info) {
    // find item
    const cartItem = await ctx.db.query.cartItem(
      {
        where: {
          id: args.id
        }
      },
      `{id, user { id }}`
    );
    // verify item
    if (!cartItem) throw new Error("Item not find");

    if (cartItem.user.id !== ctx.request.userId) {
      throw new Error("you dont own this");
    }

    return ctx.db.mutation.deleteCartItem({
      where: {
        id: args.id
      },
      info
    });
  },
  async changeQuantityInCart(parent, args, ctx, info) {
    // find item
    const { userId } = ctx.request;
    if (!userId) {
      throw new Error("must be logged in");
    }
    const cartItems = await ctx.db.query.cartItems(
      {
        where: {
          user: { id: userId }
        }
      },
      info
    );

    const editingItem = cartItems.find(item => item.id == args.id);

    return await ctx.db.mutation.updateCartItem({
      where: {
        id: args.id
      },
      data: {
        quantity: editingItem.quantity + args.quantity
      }
    });
  },
  async createOrder(parent, args, ctx, info) {
    // query current user for signed in
    const { userId } = ctx.request;
    if (!userId) throw new Error("you must be logged in");
    const user = await ctx.db.query.user(
      { where: { id: userId } },
      `
    {
      id
      name
      email
      cart {
        id
        quantity
        item {
          title
          price
          id
          description
          largeImage
          image}}}`
    );
    // recacl total for price
    const amount = user.cart.reduce((tally, cartItem) => {
      return tally + cartItem.quantity * cartItem.item.price;
    }, 0);
    // create stripe charge
    const charge = await stripe.charges.create({
      amount,
      currency: "usd",
      source: args.token
    });

    // convert cart items to order items
    const orderItems = user.cart.map(cartItem => {
      const orderItem = {
        ...cartItem.item,
        quantity: cartItem.quantity,
        user: { connect: { id: userId } }
      };

      delete orderItem.id;
      return orderItem;
    });

    // create order
    const order = await ctx.db.mutation.createOrder({
      data: {
        total: charge.amount,
        charge: charge.id,
        items: { create: orderItems },
        user: { connect: { id: userId } }
      }
    });

    const orders = await ctx.db.query.orders({
      where: {
        user: { id: userId }
      },
      info
    });

    // clear users cart
    const cartItemIds = user.cart.map(cartItem => cartItem.id);

    // delete cart items
    await ctx.db.mutation.deleteManyCartItems({
      where: {
        id_in: cartItemIds
      }
    });
    // return order to client
    return order;
  }
};

module.exports = Mutations;
