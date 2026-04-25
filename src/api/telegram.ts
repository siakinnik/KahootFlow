import { Telegraf } from 'telegraf-hardened';
import config from '../config';

export const bot = new Telegraf(config.token, {
    telegram: {
        proxy: config.telegramProxy || undefined 
    }
});

export const launchBot = async () => {    
    return bot.launch({
        // For future telegraf-hardened release
        // polling: {
        //     retryOnConflict: true,
        //     maxRetryDelay: 30000
        // }
    });
};

export type BotContext = typeof bot extends Telegraf<infer C> ? C : never;