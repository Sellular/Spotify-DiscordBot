const ServerPlaylistUtils = require('../dbUtils/ServerPlaylistUtils');
const SpotifyPlaylistUtils = require('../dbUtils/SpotifyPlaylistUtils');
const DiscordSpotifyUtils = require('../utils/DiscordSpotifyUtils');

module.exports = {
    name: 'remove',
    description: "Remove linked item from server's spotify playlist",
    isSpotify: true,
    execute(message, args) {
        const spotifyUtils = args.spotifyUtils;

        if (spotifyUtils) {
            ServerPlaylistUtils.getServerPlaylistByDiscordId(message.guild.id).then((serverPlaylist) => {
                if (serverPlaylist) {
                    let spotifyUrl = DiscordSpotifyUtils.parseSpotifyURLFromMessage(message);

                    if (spotifyUrl) {
                        let requestData = spotifyUtils.parseLink(spotifyUrl);

                        let removePromise;
                        switch (requestData.type) {
                            case 'album': {
                                removePromise = spotifyUtils.removeAlbumFromPlaylist(requestData.id, serverPlaylist.spotifyPlaylistId);
                            }; break;
                            case 'track': {
                                removePromise = spotifyUtils.removeSongFromPlaylist(requestData.id, serverPlaylist.spotifyPlaylistId);
                            }; break;
                            case 'playlist': {
                                removePromise = spotifyUtils.removePlaylistFromPlaylist(requestData.id, serverPlaylist.spotifyPlaylistId);
                            }; break;
                            case 'artist': {
                                removePromise = spotifyUtils.removeArtistFromPlaylist(requestData.id, serverPlaylist.spotifyPlaylistId);
                            }; break;
                            default: return;
                        }

                        removePromise.then((success) => {
                            if (success) {
                                message.reply("Successfully removed " + requestData.type + " from playlist");
                            } else {
                                message.reply("Error removing " + requestData.type + " from playlist");
                            }
                        });
                    }
                }
            });
        } else {
            console.log('Spotify Utils was not supplied to command: ' + name);
        }
    }
};