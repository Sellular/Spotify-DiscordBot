module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (!interaction.isCommand()) return;

            const discordClient = interaction.client;
            if (!discordClient) return;

            const command = discordClient.commands.get(interaction.commandName);
            if (!command) return;

            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
        }
    }
}