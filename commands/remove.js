const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ServerPlaylistUtils = require('../dbUtils/ServerPlaylistUtils');
const SpotifyUtils = require('../utils/SpotifyUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription("Remove linked url item from server's spotify playlist")
        .addStringOption(option => 
            option.setName('url')
                .setDescription('Enter a spotify song/artist/album/playlist URL')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        try {
            const interactionUrlValue = interaction.options.getString('url');

            if (interactionUrlValue && interactionUrlValue != '') {
    
                const serverPlaylist = await ServerPlaylistUtils.getServerPlaylistByGuildId(interaction.guild.id)
                
                if (serverPlaylist) {
                    let spotifyUrl = SpotifyUtils.parseSpotifyURLFromString(interactionUrlValue);
    
                    if (spotifyUrl) {
                        let requestData = SpotifyUtils.parseLink(spotifyUrl);
    
                        let removePromise;
                        switch (requestData.type) {
                            case 'album': {
                                removePromise = SpotifyUtils.removeAlbumFromPlaylist(requestData.id, serverPlaylist.spotifyPlaylistId);
                            } break;
                            case 'track': {
                                removePromise = SpotifyUtils.removeSongFromPlaylist(requestData.id, serverPlaylist.spotifyPlaylistId);
                            } break;
                            case 'playlist': {
                                removePromise = SpotifyUtils.removePlaylistFromPlaylist(requestData.id, serverPlaylist.spotifyPlaylistId);
                            } break;
                            case 'artist': {
                                removePromise = SpotifyUtils.removeArtistFromPlaylist(requestData.id, serverPlaylist.spotifyPlaylistId);
                            } break;
                            default: return;
                        }
    
                        await removePromise;
    
                        interaction.reply({ content: "Successfully removed " + requestData.type + " from server playlist", ephemeral: true});
                    }
                }
            } else {
                interaction.reply({ content: "URL is required for command", ephemeral: true});
            }
        } catch(error) {
            console.error(error);
            interaction.reply({ content: "Error during removal. Contact the bot developer or server admin.", ephemeral: true});
        }
    }
}