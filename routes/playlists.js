const express = require("express");
const router = express.Router();

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
router.get("/get-playlistnames", playlistController.get_playlistNames);

// get a playlist
router.post("/get-playlist", playlistController.get_playlist);

// playlist/song creation route
router.post("/create-playlist", playlistController.create_playlist);

// song deletion route
router.delete("/delete-song", playlistController.delete_song);

module.exports = router;
