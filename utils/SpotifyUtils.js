const Spotify = require("spotify-web-api-node");

require('dotenv').config({ path: '../.env' });

const getSpotifyClient = async () => {

    const spotifyClient = new Spotify({
        clientId: process.env.SPOTIFY_ID,
        clientSecret: process.env.SPOTIFY_SECRET,
        redirectUri: process.env.SPOTIFY_REDIRECT,
        refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
    });

    const data = await spotifyClient.refreshAccessToken();

    spotifyClient.setAccessToken(data.body['access_token']);

    return spotifyClient;
}

module.exports = {

    async getPlaylistById(playlistId) {
        const spotifyClient = await getSpotifyClient();
        return (await spotifyClient.getPlaylist(playlistId)).body;
    },

    async getSongById(songId) {
        const spotifyClient = await getSpotifyClient();
        return (await spotifyClient.getTrack(songId)).body;
    },

    async getAlbumTracksById(albumId) {
        const spotifyClient = await getSpotifyClient();
        return (await spotifyClient.getAlbumTracks(albumId)).body.items;
    },

    async getArtistById(artistId) {
        const spotifyClient = await getSpotifyClient();
        return (await spotifyClient.getArtist(artistId)).body;
    },

    async getArtistTopTracksById(artistId, region) {
        const spotifyClient = await getSpotifyClient();
        return (await spotifyClient.getArtistTopTracks(artistId, region)).body.tracks;
    },

    parseSpotifyURLFromString(str) {
        let strParts = str.split(" ");
        let spotifyUrl = "";
        strParts.forEach((part) => {
            if(part.includes("open.spotify.com")) {
                spotifyUrl = part;
            }
        });

        return spotifyUrl;
    },

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
    },

    async getSongsNotInPlaylist(playlistID, songUris) {
        const spotifyClient = await getSpotifyClient();
        const playlistTracks = (await spotifyClient.getPlaylistTracks(playlistID)).body.items;
        
        if (playlistTracks) {
            const playlistURIs = playlistTracks.map((trackObject) => {
                return trackObject.track.uri;
            });

            const missingURIs = [];
            songUris.forEach((uri) => {
                if (!playlistURIs.includes(uri)) {
                    missingURIs.push(uri);
                }
            });

            return missingURIs;
        }
    },

    async insertSongsToPlaylist(songUris, spotifyPlaylistId) {
        const spotifyClient = await getSpotifyClient();

        const missingURIs = await this.getSongsNotInPlaylist(spotifyPlaylistId, songUris);
    
        if (missingURIs && missingURIs.length > 0) {
            spotifyClient.addTracksToPlaylist(spotifyPlaylistId, missingURIs);
        }
           
        return missingURIs.length;
    },

    async __removeSongsFromPlaylist(songUris, playlistId) {
        const spotifyClient = await getSpotifyClient();
        
        if (songUris.length > 0) {
            await spotifyClient.removeTracksFromPlaylist(playlistId, songUris);
        }
    },

    async removeSongFromPlaylist(songId, playlistId) {
        const track = await this.getSongById(songId);

        await this.__removeSongsFromPlaylist([{uri: track.uri}], playlistId);
    },

    async removeAlbumFromPlaylist(albumId, playlistId) {
        const albumTracks = await this.getAlbumTracksById(albumId);

        let removeURIs = [];
        albumTracks.forEach((track) => {
            removeURIs.push({uri: track.uri});
        });

        await this.__removeSongsFromPlaylist(removeURIs, playlistId);
    },

    async removeArtistFromPlaylist(artistId, playlistId) {
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

        await this.__removeSongsFromPlaylist(removeURIs, playlistId);
    },

    async removePlaylistFromPlaylist(removePlaylistId, playlistId) {
        const playlist = await this.getPlaylistById(removePlaylistId);
        const tracks = playlist.tracks.items;

        let removeURIs = [];
        tracks.forEach((track) => {
            removeURIs.push({uri: track.track.uri});
        });

        await this.__removeSongsFromPlaylist(removeURIs, playlistId);
    },

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

        await this.__removeSongsFromPlaylist(removeUris, playlistId);
    },

    async createPlaylist(guildName, isPublic) {
        const spotifyClient = await getSpotifyClient();

        return (await spotifyClient.createPlaylist(guildName, {
            description: 'Conglomerate playlist for discord server: ' + guildName,
            public: isPublic
        })).body;
    }
}