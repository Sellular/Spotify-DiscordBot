const DiscordSpotifyUtils = require('../utils/DiscordSpotifyUtils');

module.exports = {
    name: 'guildCreate',
    async execute(guild) {
        try {
            await DiscordSpotifyUtils.checkPlaylistExists(guild);
        } catch (error) {
            console.error(error);
        }
    }
}