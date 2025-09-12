const express = require("express");
const router = express.Router();

const User = require("../models/user.js");

/* GET users listing. */
router.get("/", async function (req, res, next) {
  const users = await User.find().exec();
  res.json(users);
});

module.exports = router;
