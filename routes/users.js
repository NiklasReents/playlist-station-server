const express = require("express");
const router = express.Router();

const User = require("../models/user.js");
const userController = require("../controllers/userController.js");

// test route (user retrieval)
router.get("/", async (req, res, next) => {
  const users = await User.find().sort({ username: "asc" }).exec();
  res.json(users);
});

// user registration route
router.post("/register-user", userController.register_user);

// user login route
router.post("/login-user", userController.login_user);

module.exports = router;
