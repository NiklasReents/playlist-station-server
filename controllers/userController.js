const crypto = require("crypto");

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

// verify password on user login
function verifyPassword(password, salt, hash) {
  const hashedPassword = crypto.scryptSync(password, salt, 64).toString("hex");
  return hashedPassword === hash;
}

// register a new user (sanitize and validate data, hash password, create new user)

// log in an existing user (sanitize data, verify password, create auth token)

// search for an existing email in the database (used for "forgot password" button on the frontend)

// send a message to the user's email address with a link for a password reset (create email transport, use ethereal smtp service plus credentials, send email to a user account with a tokenized password reset link)

// create a new password for a logged in user (sanitize and validate data, compare password and password repeat, hash new password, update user data)

// delete a logged in user (include user's playlists as well)
