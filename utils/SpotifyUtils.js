'use strict';

const SpotifyPlaylistUtils = require('../dbUtils/SpotifyPlaylistUtils');
const ServerPlaylistUtils = require('../dbUtils/ServerPlaylistUtils');

module.exports = class SpotifyUtils {

    #spotifyClient = null;

    constructor(spotifyClient) {
        this.#spotifyClient = spotifyClient;
    }

    async getPlaylistById(playlistId) {
        return (await this.#spotifyClient.getPlaylist(playlistId)).body;
    }

    async getSongById(songId) {
        return (await this.#spotifyClient.getTrack(songId)).body;
    }

    async getAlbumTracksById(albumId) {
        return (await this.#spotifyClient.getAlbumTracks(albumId)).body.items;
    }

    async getArtistById(artistId) {
        return (await this.#spotifyClient.getArtist(artistId)).body;
    }

    async getArtistTopTracksById(artistId, region) {
        return (await this.#spotifyClient.getArtistTopTracks(artistId, region)).body.tracks;
    }

    parseLink(spotifyUrl) {
        let urlParts = spotifyUrl.split('/');
        let typeIndex = urlParts.findIndex((part) => part.includes("open.spotify.com")) + 1;
        
        let requestType = urlParts[typeIndex];
        let requestData = urlParts[typeIndex + 1];

        let requestId = requestData.split('?')[0];

        return {
            type: requestType,
            id: requestId
        };
    }

    songsNotInPlaylist(songUris, playlist) {
        const playlistSongs = playlist.songs;
    
        let songsNotInPlaylist = [];
        songUris.forEach((songUri) => {
            if (!playlistSongs.includes(songUri)) {
                songsNotInPlaylist.push(songUri);
            }
        });
    
        return songsNotInPlaylist;
    }

    async insertSongsToPlaylist(songUris, spotifyPlaylistId) {
        let playlist = await SpotifyPlaylistUtils.getPlaylistById(spotifyPlaylistId);
    
        songUris = this.songsNotInPlaylist(songUris, playlist);
    
        if (!songUris.length == 0) {
            await this.#spotifyClient.addTracksToPlaylist(spotifyPlaylistId, songUris);
        
            playlist.songs.push({
                $each: songUris
            });
        
            await playlist.save();
        }
           
        return songUris.length;
    }

    async removeSongsFromPlaylist(songUris, playlistId) {
        
        if (songUris.length > 0) {
            let playlistObject = await SpotifyPlaylistUtils.getPlaylistById(playlistId);

            await this.#spotifyClient.removeTracksFromPlaylist(playlistId, songUris);

            songUris.forEach((trackUri) => {
                playlistObject.songs.splice(playlistObject.songs.indexOf(trackUri), 1);
            });

            await playlistObject.save();
        }
    }

    async removeSongFromPlaylist(songId, playlistId) {
        try {
            const track = await this.getSongById(songId);

            await this.removeSongsFromPlaylist([{uri: track.uri}], playlistId);

            return true;
        } catch (error) {
            return false;
        }
    }

    async removeAlbumFromPlaylist(albumId, playlistId) {
        try {
            const albumTracks = await this.getAlbumTracksById(albumId);

            let removeURIs = [];
            albumTracks.forEach((track) => {
                removeURIs.push({uri: track.uri});
            });
    
            await this.removeSongsFromPlaylist(removeURIs, playlistId);
    
            return true;
        } catch (error) {
            return false;
        }
    }

    async removeArtistFromPlaylist(artistId, playlistId) {
        try {
            const playlist = await this.getPlaylistById(playlistId);
            const tracks = playlist.tracks.items;

            const removeTracks = tracks.filter((track) => {
                const trackArtists = track.track.artists;
                let hasArtist = false;

                trackArtists.forEach((artist) => {
                    if (artist.id == artistId) hasArtist = true;
                });

                return hasArtist;
            });

            let removeURIs = [];
            removeTracks.forEach((track) => {
                removeURIs.push({uri: track.track.uri});
            });

            await this.removeSongsFromPlaylist(removeURIs, playlistId);

            return true;
        } catch (error) {
            return false;
        }
    }

    async removePlaylistFromPlaylist(removePlaylistId, playlistId) {
        try {
            const playlist = await this.getPlaylistById(removePlaylistId);
            const tracks = playlist.tracks.items;

            let removeURIs = [];
            tracks.forEach((track) => {
                removeURIs.push({uri: track.track.uri});
            });

            await this.removeSongsFromPlaylist(removeURIs, playlistId);

            return true;
        } catch (error) {
            return false;
        }
    }

    async removeExpiredSongsFromPlaylist(playlistId, expiryDate) {
        let spotifyPlaylist = await this.getPlaylistById(playlistId);
    
        let tracks = spotifyPlaylist.tracks.items;

        let removeUris = [];
        tracks.forEach((track) => {
            let trackDate = new Date(track.added_at);
            if (trackDate <= expiryDate) {
                removeUris.push({uri: track.track.uri});
                console.log('Removing track: ' + track.track.uri + ' from playlist: ' + playlistId);
            }
        });

        await this.removeSongsFromPlaylist(removeUris, playlistId);
    }

    async createPlaylist(guildName, isPublic) {
        return (await this.#spotifyClient.createPlaylist(guildName, {
            description: 'Conglomerate playlist for discord server: ' + guildName,
            public: isPublic
        })).body;
    }
}