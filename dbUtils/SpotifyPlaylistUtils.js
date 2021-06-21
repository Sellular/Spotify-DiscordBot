const SpotifyPlaylist = require('../model/SpotifyPlaylist');

module.exports = {

    async getPlaylistById(playlistId) {
        const playlist = await SpotifyPlaylist.findById(playlistId);

        return playlist;
    },

    async createPlaylistWithId(id, songs) {
        return (await SpotifyPlaylist.create({_id: id, songs: songs}));
    }

};