const { Client, GatewayIntentBits } = require("discord.js");
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const fs = require('node:fs');
const request = require('request').defaults({encoding: null});

const ServerPlaylist = require('./model/ServerPlaylist');

const SpotifyUtils = require('./utils/SpotifyUtils');
const DiscordUtils = require('./utils/DiscordUtils');

require('dotenv').config();

const discordClient = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.MessageContent
]});

DiscordUtils.initializeEvents(discordClient);
discordClient.login(process.env.DISCORD_TOKEN).then(() => {
    DiscordUtils.initializeCommands(discordClient, process.env.DISCORD_TOKEN, process.env.DISCORD_ID);
});

// spotifyClient.authorizationCodeGrant(process.env.SPOTIFY_CODE).then((data) => {
//     console.log('access token: ' + data.body['access_token']);
//     console.log('refresh token: ' + data.body['refresh_token']);
// });

// console.log(spotifyClient.createAuthorizeURL([
//     'ugc-image-upload', 
//     'playlist-modify-public', 
//     'playlist-modify-private', 
//     'playlist-read-private', 
//     'playlist-read-collaborative', 
//     'user-follow-modify', 
//     'user-follow-read', 
//     'user-library-modify', 
//     'user-library-read'], 'user-read-playback-state')
// );

mongoose.connect(process.env.DB_CONNECT,
    {},
    (err) => {
        if(err)
            console.log(err);
        else
            console.log("Connected to DB");
    }
);

cron.schedule('0 0 * * *', () => {
    expiredSongCheck();
});


const expiredSongCheck = async function() {
    console.log('Starting Expiring Song Check');
    console.time("expireSongs");

    let allDBPlaylists = await ServerPlaylist.find({});

    const now = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(now.getDate() - 30);

    await Promise.all(allDBPlaylists.map(async (playlist) => {
        await SpotifyUtils.removeExpiredSongsFromPlaylist(playlist.spotifyPlaylistId, monthAgo);
    }));

    console.timeEnd("expireSongs");
};
