const DiscordServer = require('../model/DiscordServer');

module.exports = {

    async createServerWithId(id) {
        return (await DiscordServer.create({_id: id}));
    }

};