const ServerPlaylistUtils = require('../dbUtils/ServerPlaylistUtils');
const SpotifyUtils = require('../utils/SpotifyUtils');

module.exports = {

    async checkPlaylistExists(guild) {
        let serverPlaylist = await ServerPlaylistUtils.getServerPlaylistByGuildId(guild.id);

        if (!serverPlaylist) {
            serverPlaylist = await this.createServer(guild);
        }
        
        return serverPlaylist;
    },

    async createServer(guild) {
        const createdPlaylist = await SpotifyUtils.createPlaylist(guild.name, true);

        // TODO: Get custom icon working
        // if (message.guild.icon) {
        //     request.get(message.guild.iconURL(), async (err, res, body) => {
        //         console.log(body.toString('base64'));
        //         await spotifyClient.uploadCustomPlaylistCoverImage(createdPlaylist.id, body.toString('base64'));
        //     });
        // }
        
        const serverPlaylist = await ServerPlaylistUtils.createServerPlaylist(guild.id, createdPlaylist.id);

        return serverPlaylist;
    },
}