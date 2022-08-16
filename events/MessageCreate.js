const DiscordSpotifyUtils = require('../utils/DiscordSpotifyUtils');
const SpotifyUtils = require('../utils/SpotifyUtils');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        const discordClient = message.client;
        if (!discordClient) return;

        if (message.author.id === discordClient.user.id) return;

        if (message.guild) {
            let serverPlaylist = await DiscordSpotifyUtils.checkPlaylistExists(message.guild);
    
            if (message.content.includes('open.spotify.com/album') 
                    || message.content.includes('open.spotify.com/track') 
                    || message.content.includes('open.spotify.com/playlist') 
                    || message.content.includes('open.spotify.com/artist')) {
    
                let spotifyUrl = SpotifyUtils.parseSpotifyURLFromString(message.content);
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
        
                    } break;
                    case 'track': {
                        let song = await SpotifyUtils.getSongById(requestData.id);
        
                        songsAdded = await SpotifyUtils.insertSongsToPlaylist([song.uri], serverPlaylist.spotifyPlaylistId);
                    
                        numSongs = 1;
                    } break;
                    case 'playlist': {
                        let playlist = await SpotifyUtils.getPlaylistById(requestData.id);
                        let playlistItems = playlist.tracks.items;
        
                        let songUris = [];
                        playlistItems.forEach((item) => {
                            songUris.push(item.track.uri);
                        });
        
                        numSongs = songUris.length;
        
                        songsAdded = await SpotifyUtils.insertSongsToPlaylist(songUris, serverPlaylist.spotifyPlaylistId);
                    } break;
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
        } else {
            message.reply("This is not a discord server.");
        }
    }
}