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

// playlist name retrieval route
router.get("/get-playlists", playlistController.get_playlistnames);

// playlist/song creation route
router.post("/create-playlist", playlistController.upload_playlistdata);

module.exports = router;
