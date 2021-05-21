const mongoose = require('mongoose');

const spotifyPlaylistSchema = new mongoose.Schema({

    _id: {
        type: String
    },

    songs: {
        type: [ String ],
        required: true
    }

}, { collection : "SpotifyPlaylists", autoCreate: true });

module.exports = mongoose.model('SpotifyPlaylist', spotifyPlaylistSchema);