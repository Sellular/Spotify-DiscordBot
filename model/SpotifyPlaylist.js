const mongoose = require('mongoose');

const spotifyPlaylistSchema = new mongoose.Schema({

    _id: {
        type: String
    }

}, { collection : "SpotifyPlaylists", autoCreate: true });

module.exports = mongoose.model('SpotifyPlaylist', spotifyPlaylistSchema);