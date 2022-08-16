const ServerPlaylist = require('../model/ServerPlaylist');

module.exports = {

    async createServerPlaylist(guildId, spotifyId) {
        return (await ServerPlaylist.create({
            discordServerId: guildId,
            spotifyPlaylistId: spotifyId
        }));
    },

    async getServerPlaylistByGuildId(guildId) {
        return (await ServerPlaylist.findOne({
            discordServerId: guildId
        }));
    }

}