const ServerPlaylistUtils = require('../dbUtils/ServerPlaylistUtils');

module.exports = {
    name: 'playlist',
    description: "Get server's spotify playlist link",
    execute(message, args) {
        ServerPlaylistUtils.getServerPlaylistByDiscordId(message.guild.id).then((serverPlaylist) => {
            console.log(serverPlaylist);

            if (serverPlaylist) {
                message.reply("This discord server's spotify playlist is: https://open.spotify.com/playlist/" + serverPlaylist.spotifyPlaylistId);
            }
        });
    }
};