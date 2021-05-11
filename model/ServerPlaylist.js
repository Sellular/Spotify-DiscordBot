const mongoose = require('mongoose');

const serverPlaylistSchema = new mongoose.Schema({

    serverId: String,
    playlistId: String

}, { collection : "ServerPlaylists"});

module.exports = mongoose.model('ServerPlaylist', serverPlaylistSchema);