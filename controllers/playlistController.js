const multer = require("multer");
const { body, validationResult } = require("express-validator");
// import utility functions
const utils = require("../utils/utils.js");
// import models for playlist-related database queries
const Song = require("../models/song.js");
const Playlist = require("../models/playlist.js");

// configure multer file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(
      null,
      file.mimetype.includes("image/") ? "public/images" : "public/audio"
    );
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
// create a multer instance for file/field parsing
const upload = multer({ storage: storage });
// create user id object to be passed as a reference to "verifyUser" (token verification function)
const userId = { _id: "" };

// get all playlist names for a verified user (as options rendered into a "select" container on the frontend)
exports.get_playlistNames = [
  (req, res, next) => utils.verifyUser(req, res, next, userId),
  async (req, res, next) => {
    try {
      const playlistNames = await Playlist.find(
        { user: userId._id },
        "playlist"
      ).exec();

      if (playlistNames.length) {
        res.status(200).json({
          success: "Playlist(s) loaded!",
          playlistNames: playlistNames,
        });
      } else {
        res
          .status(404)
          .json({ error: "No playlists found. Go and create a few!" });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
];

// get the full selected playlist for a logged in user (get a default list if no user is logged in)
exports.get_playlist = [
  (req, res, next) => utils.verifyUser(req, res, next, userId),
  upload.none(),
  async (req, res, next) => {
    try {
      const playlist = await Playlist.findOne({
        playlist: req.body.playlist,
        user: userId._id,
      })
        .populate("songs")
        .exec();
      if (playlist) {
        res.status(200).json({ playlist: playlist.songs });
      } else {
        res.status(404).json({ error: "No playlist found!" });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
];

// create a new playlist OR add a new song to an existing playlist (receive data via form upload by a verified user from the frontend)
exports.create_playlist = [
  (req, res, next) => utils.verifyUser(req, res, next, userId),
  // process uploaded files
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  // sanitize and validate uploaded playlist field values
  body("playlist")
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage("'Playlist' field must contain between 1 and 100 characters!"),
  body("song")
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage("'Song' field must contain between 1 and 100 characters!"),
  body("artist")
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage("'Artist' field must contain between 1 and 100 characters!"),
  body("genre")
    .trim()
    .escape()
    .isLength({ min: 1, max: 100 })
    .withMessage("'Genre' field must contain between 1 and 100 characters!"),
  // handle validation errors and song/playlist data creation
  async (req, res, next) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(400).json({ valErrors: errors.array() });
      } else {
        const uploadedimagePath = `${req.files.image[0].destination}/${req.files.image[0].filename}`;
        const uploadedAudioPath = `${req.files.audio[0].destination}/${req.files.audio[0].filename}`;
        const song = new Song({
          song: req.body.song,
          artist: req.body.artist,
          genre: req.body.genre,
          image: uploadedimagePath,
          audio: uploadedAudioPath,
        });
        // check if playlist already exists for the given user
        const existingPlaylist = await Playlist.findOne({
          playlist: req.body.playlist,
          user: userId._id,
        }).exec();
        // create new playlist
        if (!existingPlaylist) {
          const newPlaylist = new Playlist({
            playlist: req.body.playlist,
            user: userId._id,
            songs: [song._id],
          });

          await song.save();
          await newPlaylist.save();
          res.status(200).json({ success: "New playlist uploaded!" });
        }
        // update existing playlist
        else {
          existingPlaylist.songs.push(song._id);
          await song.save();
          await existingPlaylist.save();
          res.status(200).json({ success: "Song uploaded!" });
        }
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
];

// remove a song from a logged in user's playlist

// delete a logged in user's playlist
