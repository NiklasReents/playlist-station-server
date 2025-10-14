const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");

require("dotenv").config();

// import models for user-related database queries
const User = require("../models/user.js");
const EmailToken = require("../models/emailtoken.js");

// search existing username and/or email address (user registration validation)
async function searchExistingUser(field, input) {
  const existingUser = await User.findOne({ [field]: input }, field).exec();
  if (existingUser) {
    field = field[0].toUpperCase() + field.slice(1);
    throw new Error(field + " already in use!");
  }
}

// hash password upon user registration
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  // NOTE: use crypto.pbkdf2Sync() as alternative? Use asynchronous function variants instead?
  return { salt, hash };
}

// verify password upon user login
function verifyPassword(password, salt, hash) {
  const hashedPassword = crypto.scryptSync(password, salt, 64).toString("hex");
  return hashedPassword === hash;
}

// register a new user (sanitize and validate data, hash password, create new user)
exports.register_user = [
  // sanitize and validate registration field values
  // NOTE: create reusable function for validation chains?
  body("username")
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage("Username must contain between 1 and 100 characters!")
    .custom((username) => searchExistingUser("username", username)),
  body("email")
    .trim()
    .escape()
    .normalizeEmail()
    .isLength({ min: 1, max: 100 })
    .withMessage("Email must contain between 1 and 100 characters!")
    .isEmail()
    .withMessage("Email must be well-formed (e.g. example@company.com)!")
    .custom((email) => searchExistingUser("email", email)),
  body("password")
    .trim()
    .escape()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must contain between 8 and 128 characters!")
    .isStrongPassword()
    .withMessage(
      "Password must contain at least 1 lower case letter, 1 upper case letter, 1 number and 1 symbol!"
    ),
  // handle validation errors and user registration (with password hashing)
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({ valErrors: errors.array() });
    } else {
      const { salt, hash } = hashPassword(req.body.password);

      const user = new User({
        username: req.body.username,
        email: req.body.email,
        password: hash,
        salt: salt,
      });

      await user.save();
      res.status(200).json({
        message: `Successful registration of ${user.username}!`,
      });
    }
  },
];

// log in an existing user (sanitize data, verify password, create auth token)
exports.login_user = [
  // sanitize user input
  body("username").trim().escape(),
  body("password").trim().escape(),
  // search user and use password verification function
  async (req, res, next) => {
    const user = await User.findOne({
      username: req.body.username,
    }).exec();

    if (user) {
      const validUserData = verifyPassword(
        req.body.password,
        user.salt,
        user.password
      );
      // create jwt token and login message and send them to the frontend
      if (validUserData) {
        const token = jwt.sign(
          { username: user.username, email: user.email },
          process.env.AUTHKEY,
          { algorithm: "HS256", expiresIn: "1 day" }
        );
        const loginMessage = `${user.username} successfully logged in!`;
        res.status(200).json({ loginData: [token, loginMessage] });
      } else {
        res.status(400).json({ message: "Invalid user data!" });
      }
    } else {
      // NOTE: implement login lockout after a set number of attempts (id-related login exhaustion with blacklist?)?
      res.status(404).json({ message: "No user found!" });
    }
  },
];

// search for an existing email in the database (used for "forgot password" button on the frontend)
exports.forgot_password = [
  body("username").trim().escape(),
  // NOTE: experimental; email retrieval function might be subject to change
  async (req, res, next) => {
    const user = await User.findOne(
      { username: req.body.username },
      "email"
    ).exec();
    if (user) {
      res.send(user.email);
    } else {
      res.send("No user found!");
    }
  },
];

// send a message to the user's email address with a link for a password reset (create email transport, use ethereal smtp service plus credentials, send email to a user account with a tokenized password reset link)
exports.send_mail = async (req, res, next) => {
  const email = req.query.email;
  if (email) {
    // create unique token with an expiration date used in the password reset link accessed via email
    const mailId = crypto.randomBytes(32).toString("hex");
    // save the token for 30 minutes (see schema definition)
    await EmailToken.create({ token: mailId });
    // smpt service: https://ethereal.email/, username: Oceane Lowe
    const transport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: process.env.EMAILUSER,
        pass: process.env.EMAILPW,
      },
    });

    const mailOptions = {
      // NOTE: preliminary email content; may be subject to change (the link address in particular)
      from: process.env.EMAILUSER,
      to: email,
      subject: "Playlist Station - Change your password",
      text: `
    Hello, ${email}, 
    you requested to change your password. 
    Click <a href="${req.protocol}://${req.host}/users/${mailId}?email=${email}" target="_blank">here</a> to change it! 
    This link will be valid for half an hour.
    If you want to leave your password as it is, please ignore this email. 
    Best regards, Nik
    `,
      html: `
    <body>
      <h1>Hello ${email},</h1>
      <p>you requested to change your password. Click <a href="${req.protocol}://${req.host}/users/${mailId}?email=${email}" target="_blank">here</a> to change it!</p>
      <p>This link will be valid for half an hour.</p>
      <p>If you want to leave your password as it is, please ignore this email.</p>
      <h2>Best regards, Nik</h2>
    </body>
    `,
    };

    transport.sendMail(mailOptions, (err, info) => {
      if (err) {
        throw err;
      } else {
        res.send("Email sent: " + info.response);
      }
    });
  } else {
    res.send("No email attached!");
  }
};

// create a new password for a logged in user (sanitize and validate data, compare password and password repeat, hash new password, update user data)
exports.reset_password = [
  // sanitize and validate user input
  // NOTE: check whether newly entered password already exists in the database for that user
  body("password")
    .trim()
    .escape()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must contain between 8 and 128 characters!")
    .isStrongPassword()
    .withMessage(
      "Password must contain at least 1 lower case letter, 1 upper case letter, 1 number and 1 symbol!"
    ),
  body("password-repeat")
    .trim()
    .escape()
    .custom((value, { req }) => {
      if (value === req.body.password) {
        return true;
      } else {
        throw new Error("Passwords do not match!");
      }
    }),
  // handle validation errors and password update (with password hashing)
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render("error", { valErrors: errors.array() });
      return;
    }

    const loggedInUser = await User.findOne(
      {
        username: req.body.username,
      },
      "username"
    ).exec();
    // NOTE: send request with email instead of username?
    if (loggedInUser) {
      const { salt, hash } = hashPassword(req.body.password);
      await User.updateOne(
        { username: loggedInUser.username },
        { password: hash, salt: salt }
      ).exec();
      res.send(`${loggedInUser.username}'s password updated!`);
    } else {
      res.send("No username provided!");
    }
  },
];

// delete a logged in user (include user's playlists as well)
exports.delete_user = async (req, res, next) => {
  // NOTE: preliminary deletion function, may be subject to change
  const userId = await User.findOne(
    { username: req.body.username },
    "_id"
  ).exec();
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    res.send("No user found/invalid id!");
  } else {
    await User.findByIdAndDelete(userId).exec();
    // TODO: delete associated playlists
    res.send(`${req.body.username} was successfully deleted!`);
  }
};

// check if emailtoken exists, delete it and redirect to the front end (after clicking on the link in the email sent to the user in order to reset their password)
exports.check_token = async (req, res, next) => {
  const token = await EmailToken.findOne(
    { token: req.params.id },
    "token"
  ).exec();
  const email = await User.findOne({ email: req.query.email }, "email").exec();
  if (token && email) {
    // await EmailToken.findByIdAndDelete(token._id).exec();
    // NOTE: preliminary response -> 'res.redirect(<ROUTE TO PASSWORD RESET PAGE ON THE FRONT END + QUERY PARAMS>)'
    res.redirect("/");
  } else {
    // NOTE: preliminary response
    res.send("No valid token found!");
  }
};
