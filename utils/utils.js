const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../models/user.js");

// search existing username and/or email address (user registration validation)
exports.searchExistingUser = async function (field, input) {
  let valMessage;
  try {
    const existingUser = await User.findOne({ [field]: input }, field).exec();
    if (existingUser) {
      field = field[0].toUpperCase() + field.slice(1);
      valMessage = field + " already in use!";
      throw new Error(valMessage);
    }
  } catch (err) {
    throw new Error(
      valMessage ? valMessage : "Server error: user database query failed!"
    );
  }
};

// hash password upon user registration
exports.hashPassword = function (password) {
  try {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    // NOTE: use crypto.pbkdf2Sync() as alternative? Use asynchronous function variants instead?
    return { salt, hash };
  } catch (err) {
    throw new Error("Server error: password hashing failed!");
  }
};

// verify password upon user login
exports.verifyPassword = function (password, salt, hash) {
  try {
    const hashedPassword = crypto
      .scryptSync(password, salt, 64)
      .toString("hex");
    return hashedPassword === hash;
  } catch (err) {
    throw new Error("Server error: password verification failed!");
  }
};

// verify user via cookie token
exports.verifyUser = function (req, res, next, userId) {
  try {
    if (req.cookies.userToken) {
      userId._id = jwt.verify(req.cookies.userToken, process.env.AUTHKEY);
      next();
    } else {
      res.status(401).json({ error: "No valid token provided!" });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error: token verification failed!" });
  }
};
