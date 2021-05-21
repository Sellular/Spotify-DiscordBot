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
    if (message.content.includes('open.spotify.com/album') || message.content.includes('open.spotify.com/track') || message.content.includes('open.spotify.com/playlist') || message.content.includes('open.spotify.com/artist')) {

        let serverPlaylist = await ServerPlaylist.findOne({discordServerId: message.guild.id});

        if (!serverPlaylist) {

            let createdPlaylist = (await spotifyClient.createPlaylist(message.guild.name, { 
                description: 'Conglomerate playlist for discord server: ' + message.guild.name,
                public: true
            })).body;

            await SpotifyPlaylist.create({_id: createdPlaylist.id, songs: []});
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

        let songsAdded = 0;
        switch(requestType) {
            case 'album': {
                let tracks = (await spotifyClient.getAlbumTracks(requestId)).body.items;
                
                let songUris = [];
                tracks.forEach((track) => {
                    songUris.push(track.uri);
                });
                
                songsAdded = await insertPossibleSongs(songUris, serverPlaylist.spotifyPlaylistId);

            }; break;
            case 'track': {
                let song = (await spotifyClient.getTrack(requestId)).body;

                songsAdded = await insertPossibleSongs([song.uri], serverPlaylist.spotifyPlaylistId);
            }; break;
            case 'playlist': {
                let playlist = (await spotifyClient.getPlaylist(requestId)).body;
                let playlistItems = playlist.tracks.items;

                let songUris = [];
                playlistItems.forEach((item) => {
                    songUris.push(item.track.uri);
                });

                songsAdded = await insertPossibleSongs(songUris, serverPlaylist.spotifyPlaylistId);
            }; break;
            case 'artist': {
                let artistTopTracks = (await spotifyClient.getArtistTopTracks(requestId, 'US')).body.tracks;
                
                let songUris = [];
                artistTopTracks.forEach((track) => {
                    songUris.push(track.uri);
                });

                songsAdded = await insertPossibleSongs(songUris, serverPlaylist.spotifyPlaylistId);
            } break;
            default: return;
        }

        message.reply(songsAdded + " songs added to the playlist");
    }
});

let insertPossibleSongs = async function(songUris, spotifyPlaylistId) {
    let playlist = await SpotifyPlaylist.findById(spotifyPlaylistId);
    
    songUris = songsNotInPlaylist(songUris, playlist);

    if (!songUris.length == 0) {
        await spotifyClient.addTracksToPlaylist(spotifyPlaylistId, songUris);
    
        playlist.songs.push({
            $each: songUris
        });
    
        await playlist.save();
    }
       
    return songUris.length;
}

let songsNotInPlaylist = function(songUris, playlist) {
    const playlistSongs = playlist.songs;

    let songsNotInPlaylist = [];
    songUris.forEach((songUri) => {
        if (!playlistSongs.includes(songUri)) {
            songsNotInPlaylist.push(songUri);
        }
    });

    return songsNotInPlaylist;
};

discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}`);
});