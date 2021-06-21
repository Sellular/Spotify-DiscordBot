const ServerPlaylist = require('../model/ServerPlaylist');

module.exports = {

    async createServerPlaylist(discordId, spotifyId) {
        return (await ServerPlaylist.create({
            discordServerId: discordId,
            spotifyPlaylistId: spotifyId
        }));
    },

    async getServerPlaylistByDiscordId(discordId) {
        return (await ServerPlaylist.findOne({
            discordServerId: discordId
        }));
    }

};