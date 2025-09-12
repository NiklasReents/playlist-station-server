const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const playlistSchema = new Schema({
  name: { type: String, required: true, minLength: 1, maxLength: 100 },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  songs: [{ type: Schema.Types.ObjectId, ref: "Song" }],
});

module.exports = mongoose.model("Playlist", playlistSchema);
