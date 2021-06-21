'use strict';

const Discord = require("discord.js");
const Spotify = require("spotify-web-api-node");
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const fs = require('fs');
const request = require('request').defaults({encoding: null});

const ServerPlaylist = require('./model/ServerPlaylist');
const SpotifyPlaylist = require('./model/SpotifyPlaylist');
const DiscordServer = require('./model/DiscordServer');

const DiscordSpotifyUtils = require('./utils/DiscordSpotifyUtils');
const SpotifyUtilsConstructor = require('./utils/SpotifyUtils');
const DiscordServerUtils = require("./dbUtils/DiscordServerUtils");

require('dotenv').config();

const discordClient = new Discord.Client();

const prefix = '!';

discordClient.login(process.env.DISCORD_TOKEN).then(() => {
    discordClient.commands = new Discord.Collection();
    discordClient.modCommands = new Discord.Collection();

    getDiscordCommands();
});

const spotifyClient = new Spotify({
    clientId: process.env.SPOTIFY_ID,
    clientSecret: process.env.SPOTIFY_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
});

const SpotifyUtils = new SpotifyUtilsConstructor(spotifyClient);

let interval;
const intervalFunction = function() {
    spotifyClient.refreshAccessToken().then((data) => {
        console.log('The access token has been refreshed!');
    
        spotifyClient.setAccessToken(data.body['access_token']);

        let expiration = data.body['expires_in'];

        if(interval) clearInterval(interval);

        interval = setInterval(intervalFunction, expiration * 1000);
    });
}

intervalFunction();

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
    {useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true},
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

const checkPlaylistExists = async function(guild) {
    let serverPlaylist = await ServerPlaylist.findOne({discordServerId: guild.id});

    if (!serverPlaylist) {
        serverPlaylist = await DiscordSpotifyUtils.createServer(guild);
    }
    
    return serverPlaylist;
};

discordClient.on('guildCreate', async (guild) => {
    await checkPlaylistExists(guild);
});

discordClient.on('guildDelete', async (guild) => {
    let serverPlaylist = await ServerPlaylist.findOne({discordServerId: guild.id});

    if (serverPlaylist) {

        await ServerPlaylist.findByIdAndDelete(serverPlaylist._id);
        await SpotifyPlaylist.findByIdAndDelete(serverPlaylist.spotifyPlaylistId);
        await DiscordServer.findByIdAndDelete(serverPlaylist.discordServerId);
    }
});

discordClient.on('message', async (message) => {

    if (message.guild) {
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            let commandObject;
            
            if (discordClient.commands.has(command)) {
                commandObject = discordClient.commands.get(command);
            } else if (message.guild.ownerID === message.author.id) {
                if (discordClient.modCommands.has(command)) {
                    commandObject = discordClient.modCommands.get(command);
                }
            }

            if (commandObject) {
                try {
                    let commandArgs = {
                        args: args
                    };

                    if (commandObject.isSpotify) commandArgs.spotifyUtils = SpotifyUtils;

                    commandObject.execute(message, commandArgs);
                } catch (error) {
                    console.error(error);
                    message.reply('There was an error trying to execute that command!');
                }
            }
        } else {
            let serverPlaylist = await checkPlaylistExists(message.guild);

            if (message.author.id !== discordClient.user.id && (message.content.includes('open.spotify.com/album') || message.content.includes('open.spotify.com/track') || message.content.includes('open.spotify.com/playlist') || message.content.includes('open.spotify.com/artist'))) {
    
                let spotifyUrl = DiscordSpotifyUtils.parseSpotifyURLFromMessage(message);
                let requestData = SpotifyUtils.parseLink(spotifyUrl);
        
                let songsAdded = 0;
                let numSongs = 0;
                switch(requestData.type) {
                    case 'album': {
                        let tracks = await SpotifyUtils.getAlbumTracksById(requestData.id);
                        
                        let songUris = [];
                        tracks.forEach((track) => {
                            songUris.push(track.uri);
                        });
        
                        numSongs = songUris.length;
                        
                        songsAdded = await SpotifyUtils.insertSongsToPlaylist(songUris, serverPlaylist.spotifyPlaylistId);
        
                    }; break;
                    case 'track': {
                        let song = await SpotifyUtils.getSongById(requestData.id);
        
                        songsAdded = await SpotifyUtils.insertSongsToPlaylist([song.uri], serverPlaylist.spotifyPlaylistId);
                    
                        numSongs = 1;
                    }; break;
                    case 'playlist': {
                        let playlist = await SpotifyUtils.getPlaylistById(requestData.id);
                        let playlistItems = playlist.tracks.items;
        
                        let songUris = [];
                        playlistItems.forEach((item) => {
                            songUris.push(item.track.uri);
                        });
        
                        numSongs = songUris.length;
        
                        songsAdded = await SpotifyUtils.insertSongsToPlaylist(songUris, serverPlaylist.spotifyPlaylistId);
                    }; break;
                    case 'artist': {
                        let artistTopTracks = await SpotifyUtils.getArtistTopTracksById(requestData.id, 'US');
                        
                        let songUris = [];
                        artistTopTracks.forEach((track) => {
                            songUris.push(track.uri);
                        });
        
                        numSongs = songUris.length;
        
                        songsAdded = await SpotifyUtils.insertSongsToPlaylist(songUris, serverPlaylist.spotifyPlaylistId);
                    } break;
                    default: return;
                }
        
                let messageString = songsAdded + " song" + (songsAdded === 1 ? "" : "s") + " added to the playlist.";
        
                let duplicateSongs = numSongs - songsAdded;        
                if(duplicateSongs > 0) {
                    messageString = messageString + " " + duplicateSongs + " song" + (duplicateSongs === 1 ? "" : "s") + " " + (duplicateSongs === 1 ? "was" : "were") + " already in the playlist.";
                }
        
                message.reply(messageString);
            }
        }
    } else {
        message.reply("This is not a discord server.");
    }

});

const expiredSongCheck = async function() {
    console.log('Starting Expiring Song Check');
    console.time("expireSongs");

    let allDBPlaylists = await SpotifyPlaylist.find({});

    const now = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(now.getDate() - 30);

    await Promise.all(allDBPlaylists.map(async (playlist) => {
        await SpotifyUtils.removeExpiredSongsFromPlaylist(playlist._id, monthAgo);
    }));

    console.timeEnd("expireSongs");
};

const getDiscordCommands = function() {
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    commandFiles.forEach((file) => {
        let command = require(`./commands/${file}`);

        discordClient.commands.set(command.name, command);
    });

    const modCommandFiles = fs.readdirSync('./modCommands').filter(file => file.endsWith('.js'));
    modCommandFiles.forEach((file) => {
        let modCommand = require(`./modCommands/${file}`);

        discordClient.modCommands.set(modCommand.name, modCommand);
    })
};

discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}`);
});