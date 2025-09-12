const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const EmailTokenSchema = new Schema({
  token: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: "30m",
  },
});

module.exports = mongoose.model("EmailToken", EmailTokenSchema);
