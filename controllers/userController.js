const multer = require("multer");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
// import utility functions
const utils = require("../utils/utils.js");
// import models for user-related database queries
const User = require("../models/user.js");
const EmailToken = require("../models/emailtoken.js");
const Playlist = require("../models/playlist.js");
// create a multer instance for file/field parsing
const upload = multer();

// register a new user (sanitize and validate data, hash password, create new user)
exports.register_user = [
  // parse form data upload (text only)
  upload.none(),
  // sanitize and validate registration field values
  body("username")
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage("Username must contain between 1 and 100 characters!")
    .custom((username) => utils.searchExistingUser("username", username)),
  body("email")
    .trim()
    .escape()
    .normalizeEmail()
    .isLength({ min: 1, max: 100 })
    .withMessage("Email must contain between 1 and 100 characters!")
    .isEmail()
    .withMessage("Email must be well-formed (e.g. example@company.com)!")
    .custom((email) => utils.searchExistingUser("email", email)),
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
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({ valErrors: errors.array() });
      } else {
        const { salt, hash } = utils.hashPassword(req.body.password);

        const user = new User({
          username: req.body.username,
          email: req.body.email,
          password: hash,
          salt: salt,
        });

        await user.save();
        res.status(200).json({
          registrationSuccess: `Successful registration of ${user.username}!`,
        });
      }
    } catch (err) {
      res.status(500).json({ error: err.message }); // NOTE: adjust error message?
    }
  },
];

// log in an existing user (sanitize data, verify password, create auth token)
exports.login_user = [
  // parse form data upload (text only)
  upload.none(),
  // sanitize user input
  body("username").trim().escape(),
  body("password").trim().escape(),
  // search user and use password verification function
  async (req, res, next) => {
    try {
      const user = await User.findOne({
        username: req.body.username,
      }).exec();

      if (user) {
        const validUserData = utils.verifyPassword(
          req.body.password,
          user.salt,
          user.password
        );
        // create jwt token and login message and send them to the frontend
        if (validUserData) {
          const token = jwt.sign({ _id: user._id }, process.env.AUTHKEY, {
            algorithm: "HS256",
            expiresIn: "1 day",
          });
          const loginMessage = `${user.username} successfully logged in!`;
          res.status(200).json({ loginData: [token, loginMessage] });
        } else {
          res.status(400).json({ error: "Invalid user data!" });
        }
      } else {
        // NOTE: implement login lockout after a set number of attempts (id-related login exhaustion with blacklist?)?
        res.status(404).json({ error: "No user found!" });
      }
    } catch (err) {
      res.status(500).json({ error: err.message }); // NOTE: adjust error message?
    }
  },
];

// search for an existing email in the database (used for "forgot password" button on the frontend)
exports.forgot_password = [
  body("username").trim().escape(),
  // NOTE: experimental; email retrieval function might be subject to change
  async (req, res, next) => {
    try {
      const user = await User.findOne(
        { username: req.query.user },
        "email"
      ).exec();

      if (user) {
        res.status(200).json({ email: user.email });
      } else {
        res.status(404).json({ error: "No user found!" });
      }
    } catch (err) {
      res.status(500).json({ error: "Server error: email query failed!" });
    }
  },
];

// send a message to the user's email address with a link for a password reset (create email transport, use ethereal smtp service plus credentials, send email to a user account with a tokenized password reset link)
exports.send_mail = async (req, res, next) => {
  try {
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
          res.status(250).json({ success: "Email sent: " + info.response });
        }
      });
    } else {
      res.status(404).json({ error: "No email attached!" });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error: email transmission failed!" });
  }
};

// create a new password for a logged in user (sanitize and validate data, compare password and password repeat, hash new password, update user data)
exports.reset_password = [
  // parse form data upload
  upload.none(),
  // sanitize and validate user input
  // NOTE: check whether newly entered password already exists in the database for that user?
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
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({ valErrors: errors.array() });
        return;
      }

      const loggedInUser = await User.findOne(
        {
          email: req.body.email,
        },
        "username"
      ).exec(); // NOTE: query with id instead (via token)?

      if (loggedInUser) {
        const { salt, hash } = utils.hashPassword(req.body.password);
        await User.updateOne(
          { username: loggedInUser.username },
          { password: hash, salt: salt }
        ).exec();
        res
          .status(200)
          .json({ success: `${loggedInUser.username}'s password updated!` });
      } else {
        res.status(400).json({ error: "No email provided!" });
      }
    } catch (err) {
      res.status(500).json({ error: err.message }); // NOTE: adjust error message?
    }
  },
];

// delete a logged in user (include user's playlists as well)
exports.delete_user = [
  // parse form data upload
  upload.none(),
  async (req, res, next) => {
    try {
      const userId = await User.findOne(
        { username: req.body.username },
        "_id"
      ).exec(); // NOTE: query with id instead (via token)?

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        res.status(404).json({ error: "No user found/invalid id!" });
      } else {
        // delete the given user and all their playlists
        await Playlist.deleteMany({ user: userId._id }).exec();
        await User.findOneAndDelete(userId).exec();
        res
          .status(200)
          .json({ success: `${req.body.username} was successfully deleted!` });
      }
    } catch (err) {
      res.status(500).json({ error: "Server error: user deletion failed!" });
    }
  },
];

// check if emailtoken exists, delete it and render a password reset page (after clicking on the link in the email sent to the user in order to reset their password)
exports.check_token = async (req, res, next) => {
  try {
    const token = await EmailToken.findOne(
      { token: req.params.id },
      "token"
    ).exec();

    const email = await User.findOne(
      { email: req.query.email },
      "email"
    ).exec();
    // delete the emailtoken and render the password reset page
    if (token && email) {
      await EmailToken.findByIdAndDelete(token._id).exec();

      res.status(200).render("password-reset", {
        email: email.email,
        serverURL: process.env.SERVER_URL,
        clientURL: process.env.CLIENT_URL,
      });
    } else {
      res.status(404).json({ error: "No valid token and/or email found!" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ error: "Server error: email token verification failed!" });
  }
};
