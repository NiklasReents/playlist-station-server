const multer = require("multer");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

require("dotenv").config();

// verify user via cookie token
function verifyUser(req, res, next) {
  if (req.cookies.userToken) {
    userId = jwt.verify(req.cookies.userToken, process.env.AUTHKEY);
    next();
  } else {
    res.status(401).json({ message: "No valid token provided!" });
  }
}

// configure file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(
      null,
      file.mimetype.includes("image/") ? "./public/images" : "./public/audio"
    );
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });
let userId;

// import models for playlist-related database queries
const Song = require("../models/song.js");
const Playlist = require("../models/playlist.js");

// get all playlist names for a logged in user (as options rendered into a "select" container on the frontend)
exports.get_playlistnames = [
  verifyUser,
  async (req, res, next) => {
    const playlistNames = await Playlist.find(
      { user: userId._id },
      "playlist"
    ).exec();
    if (playlistNames.length) {
      res.status(200).json({ playlistNames: playlistNames });
    } else {
      res.status(404).json({ message: "No playlists found." });
    }
  },
];

// get the full selected playlist for a logged in user (get a default list if no user is logged in)

// create a new playlist OR add a new song to an existing playlist (receive data via form upload from the frontend)

exports.upload_playlistdata = [
  // verify user
  verifyUser,
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

  async (req, res, next) => {
    // handle validation errors and song/playlist data creation
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
        res.status(200).json({ message: "New playlist uploaded!" });
      }
      // update existing playlist
      else {
        existingPlaylist.songs.push(song._id);
        await song.save();
        await existingPlaylist.save();
        res.status(200).json({ message: "Song uploaded!" });
      }
    }
  },
];

// remove a song from a logged in user's playlist

// delete a logged in user's playlist
