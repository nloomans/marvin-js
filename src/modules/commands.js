import moment from 'moment';
import commands from '../providers/commands';
import { rtm } from '../slack';

import MessageHistory from '../database/models/message-history';

import * as vm from '../providers/vm';
import Factoid, { FactoidTypes } from '../database/models/factoid';

export function activate() {
    registerCommands();

    rtm.on('message', (message) => {
        const { text, user, channel } = message;
        // Skip messages that are from a bot or my own user ID, or are for factoids.
        if (!text || (message.subtype && message.subtype === 'bot_message') ||
            (!message.subtype && user === rtm.activeUserId) ||
            text.startsWith('!')) {
            return;
        }

        // Only listen to commands which are sent using @user and as a direct message.        
        if (channel.startsWith('D') || text.includes(`<@${rtm.activeUserId}>`)) {
            const command = text.replace(`<@${rtm.activeUserId}>`, '').trim();
            commands.parse(command, {
                message
            }, (err, argv, output) => {
                if (output) {
                    rtm.sendMessage(output, channel);
                }
            });
        }
    });
}

function registerCommands() {
    commands
        .command('ping', 'Pong!', {}, ({ message }) => {
            rtm.sendMessage('Pong!', message.channel);
        })
        .command('history', 'Show all history logs.', {}, (argv) => {
            MessageHistory.find({}).exec()
                .then((results) => {
                    results.forEach((message) => {
                        rtm.sendMessage(`${message.userId}: ${message.text}`, argv.message.channel);
                    })
                });
        })
        .command('server', 'List basic server / process information.', {}, (argv) => {
            const rssMB = process.memoryUsage().rss / (1024 * 1024);
            const uptime = moment.duration({
                seconds: process.uptime()
            });
            const uptimeString = `${uptime.days()} days, ${uptime.hours()} hours, ${uptime.minutes()} minutes, ${uptime.seconds()} seconds`;
            const stats = `Server statistics:\n` +
                `Platform: ${process.platform}\nNodeJS: ${process.version}\n` +
                `Uptime: ${uptimeString}\n` +
                `RSS Memory: ${rssMB} MB\n`;
            rtm.sendMessage(stats, argv.message.channel);
        })
        .command('*', false, {}, ({ message }) => {
            rtm.sendMessage('What do you mean? Don\'t talk to me about life.', message.channel);
        });
}