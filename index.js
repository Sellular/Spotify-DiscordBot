const Discord = require("discord.js");
const Spotify = require("spotify-web-api-node");
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const discordClient = new Discord.Client();

discordClient.login(process.env.DISCORD_TOKEN);

const spotifyClient = new Spotify({
    clientId: process.env.SPOTIFY_ID,
    clientSecret: process.env.SPOTIFY_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT
});

spotifyClient.setRefreshToken(process.env.SPOTIFY_REFRESH_TOKEN);

let interval;
let intervalFunction = function() {
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

const ServerPlaylist = require('./model/ServerPlaylist');
const SpotifyPlaylist = require('./model/SpotifyPlaylist');
const DiscordServer = require('./model/DiscordServer');

discordClient.on('message', async (message) => {
    if (message.content.includes('open.spotify.com/album') || message.content.includes('open.spotify.com/track') || message.content.includes('open.spotify.com/playlist')) {

        let serverPlaylist = await ServerPlaylist.findOne({discordServerId: message.guild.id});

        if (!serverPlaylist) {

            let createdPlaylist = (await spotifyClient.createPlaylist(message.guild.name, { 
                description: 'Conglomerate playlist for discord server: ' + message.guild.name,
                public: true})).body;

            await SpotifyPlaylist.create({_id: createdPlaylist.id});
            await DiscordServer.create({_id: message.guild.id});

            serverPlaylist = await ServerPlaylist.create({
                discordServerId: message.guild.id,
                spotifyPlaylistId: createdPlaylist.id
            });
        }

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

        switch(requestType) {
            case 'album': {
                let album = (await spotifyClient.getAlbum(requestId)).body;
                let songs = album.tracks.items;
                
                let songUris = [];
                songs.forEach((song) => {
                    songUris.push(song.uri);
                });

                await spotifyClient.addTracksToPlaylist(serverPlaylist.spotifyPlaylistId, songUris);
            }; break;
            case 'track': {
                let song = (await spotifyClient.getTrack(requestId)).body;
                await spotifyClient.addTracksToPlaylist(serverPlaylist.spotifyPlaylistId, [song.uri]);
            }; break;
            case 'playlist': {
                let playlist = (await spotifyClient.getPlaylist(requestId)).body;
                let playlistItems = playlist.tracks.items;

                let songUris = [];
                playlistItems.forEach((item) => {
                    songUris.push(item.track.uri);
                });

                await spotifyClient.addTracksToPlaylist(serverPlaylist.spotifyPlaylistId, songUris);
            }; break;
        }

        let capitalStr = requestType.charAt(0).toUpperCase() + requestType.slice(1);

        message.reply(capitalStr + " added to server playlist.");
    }
});

discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}`);
});