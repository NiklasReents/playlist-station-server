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

// email retrieval route (used for "forgot password" button)
router.get("/forgot-password", userController.forgot_password);

// email to user route (triggered by "forgot password button")
router.get("/send-mail", userController.send_mail);

// password reset route
router.post("/reset-password", userController.reset_password);

// user deletion route
router.delete("/delete-user", userController.delete_user);

// email token authentification route
router.get("/:id", userController.check_token);

module.exports = router;
