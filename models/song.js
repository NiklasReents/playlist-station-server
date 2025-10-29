const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const songSchema = new Schema({
  song: { type: String, required: true, minLength: 1, maxLength: 100 },
  artist: { type: String, required: true, minLength: 1, maxLength: 100 },
  genre: { type: String, required: true, minLength: 1, maxLength: 100 },
  image: { type: String, required: true },
  audio: { type: String, required: true },
});

module.exports = mongoose.model("Song", songSchema);
