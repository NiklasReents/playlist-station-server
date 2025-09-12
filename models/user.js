const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: { type: String, required: true, minLength: 1, maxLength: 100 },
  email: { type: String, required: true, minLength: 1, maxLength: 100 },
  password: { type: String, required: true, minLength: 8, maxLength: 128 },
  salt: { type: String, required: true, minLength: 8, maxLength: 128 },
});

module.exports = mongoose.model("User", userSchema);
