const crypto = require("crypto");
const { body, validationResult } = require("express-validator");

// import models for user-related database queries
const User = require("../models/user.js");

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
    .withMessage("Email must be well-formed!")
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
      res.render("error", { valErrors: errors.array() });
    } else {
      const { salt, hash } = hashPassword(req.body.password);

      const user = new User({
        username: req.body.username,
        email: req.body.email,
        password: hash,
        salt: salt,
      });

      await user.save();
      res.send(`Successful registration of ${user.username}!`);
    }
  },
];

// log in an existing user (sanitize data, verify password, create auth token)

// search for an existing email in the database (used for "forgot password" button on the frontend)

// send a message to the user's email address with a link for a password reset (create email transport, use ethereal smtp service plus credentials, send email to a user account with a tokenized password reset link)

// create a new password for a logged in user (sanitize and validate data, compare password and password repeat, hash new password, update user data)

// delete a logged in user (include user's playlists as well)
