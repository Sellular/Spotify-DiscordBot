const mongoose = require('mongoose');

const discordServerSchema = new mongoose.Schema({

    _id: {
        type: String
    }   

}, { collection : "DiscordServers", autoCreate: true });

module.exports = mongoose.model('DiscordServer', discordServerSchema);