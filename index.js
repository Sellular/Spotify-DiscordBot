const Discord = require("discord.js");
const Spotify = require("spotify-api.js");
const config = require("./config.json");

const spotifyClient = new Spotify.Client();
const discordClient = new Discord.Client();

discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}`);
});

discordClient.on('message', async (message) => {
    if (message.content.includes('open.spotify.com')) {
        let messageParts = message.content.split(" ");
        let spotifyUrl = "";
        messageParts.forEach((part) => {
            if(part.includes("open.spotify.com")) {
                spotifyUrl = part;
            }
        });

        let urlParts = spotifyUrl.split('/');
        let typeIndex = urlParts.findIndex((part) => part.includes("open.spotify.com")) + 1;
        
        let requestType = urlParts[typeIndex];
        let requestData = urlParts[typeIndex + 1];

        let requestId = requestData.split('?')[0];

        let typeClient = undefined;
        switch(requestType) {
            case 'album' : {
                typeClient = spotifyClient.albums;
            } break;

            case 'artist' : {
                typeClient = spotifyClient.artists;
            } break;

            case 'track' : {
                typeClient = spotifyClient.tracks;
            } break;
        }

        if (typeClient) {
            let name = (await typeClient.get(requestId)).name;
            message.reply(name);
        }
    }
});

spotifyClient.onReady = function() {
    console.log('Logged into Spotify successfully!');
}

discordClient.login(config.DISCORD_BOT_TOKEN);
spotifyClient.login(config.SPOTIFY_ID, config.SPOTIFY_SECRET);