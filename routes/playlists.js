const express = require("express");
const router = express.Router();

const User = require("../models/user.js");
const Playlist = require("../models/playlist.js");
const playlistController = require("../controllers/playlistController.js");

// test route (playlist retrieval with ref population)
router.get("/", async (req, res, next) => {
  const playlists = await Playlist.find()
    .populate(["user", "songs"])
    .sort({ playlist: "asc" })
    .exec();
  res.json(playlists);
});

// create a new playlist or add a new song to an existing playlist
router.post("/create-playlist", playlistController.upload_playlistdata);

module.exports = router;
