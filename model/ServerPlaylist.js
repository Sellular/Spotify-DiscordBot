const mongoose = require('mongoose');

const serverPlaylistSchema = new mongoose.Schema({

    discordServerId: {
        type: String,
        required: true,
        index: true,
        unique: true
    },
    spotifyPlaylistId: {
        type: String,
        required: true,
        index: true,
        unique: true
    }

}, { collection : "ServerPlaylists", autoCreate: true });

module.exports = mongoose.model('ServerPlaylist', serverPlaylistSchema);