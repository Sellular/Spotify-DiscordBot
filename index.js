const Discord = require("discord.js");
const Spotify = require("spotify-web-api-node");
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const request = require('request').defaults({encoding: null});

const ServerPlaylist = require('./model/ServerPlaylist');
const SpotifyPlaylist = require('./model/SpotifyPlaylist');
const DiscordServer = require('./model/DiscordServer');

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

const checkServerExists = async function(guild) {
    let serverPlaylist = await ServerPlaylist.findOne({discordServerId: guild.id});

    if (!serverPlaylist) {

        let createdPlaylist = (await spotifyClient.createPlaylist(guild.name, { 
            description: 'Conglomerate playlist for discord server: ' + guild.name,
            public: true
        })).body;

        // TODO: Get custom icon working
        // if (message.guild.icon) {
        //     request.get(message.guild.iconURL(), async (err, res, body) => {
        //         console.log(body.toString('base64'));
        //         await spotifyClient.uploadCustomPlaylistCoverImage(createdPlaylist.id, body.toString('base64'));
        //     });
        // }
        
        await SpotifyPlaylist.create({_id: createdPlaylist.id, songs: []});
        await DiscordServer.create({_id: guild.id});

        serverPlaylist = await ServerPlaylist.create({
            discordServerId: guild.id,
            spotifyPlaylistId: createdPlaylist.id
        });

        let defaultChannel = '';
        guild.channels.cache.forEach((channel) => {
            if (channel.type == "text" && defaultChannel == '') {
                if (channel.permissionsFor(guild.me).has("SEND_MESSAGES")) {
                    defaultChannel = channel;
                }
            }
        });

        defaultChannel.send("Hello, I am Spotify-Discord Bot. This server's spotify playlist is: https://open.spotify.com/playlist/" + serverPlaylist.spotifyPlaylistId);
    }
    
    return serverPlaylist;
};

discordClient.on('guildCreate', async (guild) => {
    await checkServerExists(guild);
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

    if (message.author.id !== discordClient.user.id && (message.content.includes('open.spotify.com/album') || message.content.includes('open.spotify.com/track') || message.content.includes('open.spotify.com/playlist') || message.content.includes('open.spotify.com/artist'))) {

        let serverPlaylist = await checkServerExists(message.guild);

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
        let numSongs = 1;
        switch(requestType) {
            case 'album': {
                let tracks = (await spotifyClient.getAlbumTracks(requestId)).body.items;
                
                let songUris = [];
                tracks.forEach((track) => {
                    songUris.push(track.uri);
                });

                numSongs = songUris.length;
                
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

                numSongs = songUris.length;

                songsAdded = await insertPossibleSongs(songUris, serverPlaylist.spotifyPlaylistId);
            }; break;
            case 'artist': {
                let artistTopTracks = (await spotifyClient.getArtistTopTracks(requestId, 'US')).body.tracks;
                
                let songUris = [];
                artistTopTracks.forEach((track) => {
                    songUris.push(track.uri);
                });

                numSongs = songUris.length;

                songsAdded = await insertPossibleSongs(songUris, serverPlaylist.spotifyPlaylistId);
            } break;
            default: return;
        }

        let messageString = songsAdded + " songs added to the playlist.";

        if(songsAdded !== numSongs) {
            messageString = messageString + " " + numSongs + " songs were already in the playlist.";
        }

        message.reply(messageString);
    }
});

const insertPossibleSongs = async function(songUris, spotifyPlaylistId) {
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

const songsNotInPlaylist = function(songUris, playlist) {
    const playlistSongs = playlist.songs;

    let songsNotInPlaylist = [];
    songUris.forEach((songUri) => {
        if (!playlistSongs.includes(songUri)) {
            songsNotInPlaylist.push(songUri);
        }
    });

    return songsNotInPlaylist;
};

const expiredSongCheck = async function() {
    console.log('Starting Expiring Song Check');
    console.time("expireSongs");

    let allDBPlaylists = await SpotifyPlaylist.find({});

    const now = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(now.getDate() - 30);

    await Promise.all(allDBPlaylists.map(async (playlist) => {
        let spotifyPlaylist = (await spotifyClient.getPlaylist(playlist._id)).body;
    
        let tracks = spotifyPlaylist.tracks.items;

        let removeUris = [];
        tracks.forEach((track) => {
            let trackDate = new Date(track.added_at);
            if (trackDate <= monthAgo) {
                removeUris.push({uri: track.track.uri});
                console.log('Removing track: ' + track.track.uri + ' from playlist: ' + playlist._id);
            }
        });

        if (removeUris.length > 0) {
            await spotifyClient.removeTracksFromPlaylist(spotifyPlaylist.id, removeUris);

            removeUris.forEach((trackUri) => {
                playlist.songs.splice(playlist.songs.indexOf(trackUri), 1);
            });

            await playlist.save();
        }

    }));

    console.timeEnd("expireSongs");
};

discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}`);
});