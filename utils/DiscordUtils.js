const { REST } = require('@discordjs/rest');
const { Collection, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const refreshRestCommands = async (commands, discordToken, discordId) => {
    const rest = new REST({ version: '10' }).setToken(discordToken);

    try {
        console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationCommands(discordId),
            // Routes.applicationGuildCommands(discordId, '839673797066096660'), // Testing server guild id
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    } 
};

module.exports = {
    initializeCommands(discordClient, discordToken, discordId) {
        discordClient.commands = new Collection();

        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        const commandsJSON = [];

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);

            commandsJSON.push(command.data.toJSON());
            discordClient.commands.set(command.data.name, command);
        }

        refreshRestCommands(commandsJSON, discordToken, discordId);
    },

    initializeEvents(client) {
        const eventsPath = path.join(__dirname, '..', 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);

            if (event.execute) {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }
    }
}