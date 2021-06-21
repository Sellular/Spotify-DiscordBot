const SpotifyPlaylistUtils = require('../dbUtils/SpotifyPlaylistUtils');
const DiscordServerUtils = require('../dbUtils/DiscordServerUtils');
const ServerPlaylistUtils = require('../dbUtils/ServerPlaylistUtils');

module.exports = {

    async createServer(guild, spotifyUtils) {
        let createdPlaylist = await spotifyUtils.createPlaylist(guild.name, true);

        // TODO: Get custom icon working
        // if (message.guild.icon) {
        //     request.get(message.guild.iconURL(), async (err, res, body) => {
        //         console.log(body.toString('base64'));
        //         await spotifyClient.uploadCustomPlaylistCoverImage(createdPlaylist.id, body.toString('base64'));
        //     });
        // }
        
        await SpotifyPlaylistUtils.createPlaylistWithId(createdPlaylist.spotifyPlaylistId, []);
        await DiscordServerUtils.createServerWithId(guild.id);

        let serverPlaylist = await ServerPlaylistUtils.createServerPlaylist(guild.id, createdPlaylist.id);

        let defaultChannel = '';
        guild.channels.cache.forEach((channel) => {
            if (channel.type == "text" && defaultChannel == '') {
                if (channel.permissionsFor(guild.me).has("SEND_MESSAGES")) {
                    defaultChannel = channel;
                }
            }
        });

        defaultChannel.send("Hello, I am Spotify-Discord Bot. This server's spotify playlist is: https://open.spotify.com/playlist/" + serverPlaylist.spotifyPlaylistId);

        return serverPlaylist;
    },

    parseSpotifyURLFromMessage(message) {
        let messageParts = message.content.split(" ");
        let spotifyUrl = "";
        messageParts.forEach((part) => {
            if(part.includes("open.spotify.com")) {
                spotifyUrl = part;
            }
        });

        return spotifyUrl;
    }

}