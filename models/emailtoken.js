const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const EmailTokenSchema = new Schema({
  token: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expireAt: {
    type: Date,
    validate: [
      (v) => v - new Date() <= 1800000,
      "Token expires after 30 minutes.",
    ],
    default: () => new Date(Date.now() + 1800000),
  },
});

// TODO: fix bug(s) leading to premature token expiration (instead of intended automatic expiration after 30 minutes)

module.exports = mongoose.model("EmailToken", EmailTokenSchema);
