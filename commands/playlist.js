const { SlashCommandBuilder } = require('@discordjs/builders');
const ServerPlaylistUtils = require('../dbUtils/ServerPlaylistUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription("Get server's spotify playlist link"),
    async execute(interaction) {
        try {
            const serverPlaylist = await ServerPlaylistUtils.getServerPlaylistByGuildId(interaction.guild.id)
            if (serverPlaylist) {
                await interaction.reply({ content: "This discord server's spotify playlist is: https://open.spotify.com/playlist/" + serverPlaylist.spotifyPlaylistId, ephemeral: true });
            }
        } catch(error) {
            console.error(error);
            await interaction.reply({ content: "Error during playlist retrieval. Contact bot developer or server admin.", ephemeral: true })
        }
    }
}