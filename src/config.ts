import dotenv from 'dotenv';
dotenv.config();

interface Config {
    // Telegram & Security
    token: string;
    ownerId: number;
    logChannelId: number;
    tokenFile: string;

    // Kahoot Specific
    kahootProxy: string | null;

    // Telegram Specific
    telegramProxy: string | null;
}

const config: Config = {
    token: process.env.BOT_TOKEN || '',
    ownerId: Number(process.env.OWNER_ID),
    logChannelId: Number(process.env.ERR_CHANNEL_ID),
    tokenFile: process.env.TOKEN_FILE || './token.json',

    kahootProxy: process.env.K_PROXY || null,
    telegramProxy: process.env.T_PROXY || null,
};

const required: (keyof Config)[] = ['token', 'ownerId', 'logChannelId', 'tokenFile'];

const missing = required.filter(key => !config[key]);

if (missing.length > 0) {
    console.error("\x1b[31m%s\x1b[0m", "CRITICAL ERROR: MISSING ENV PARAMETERS");
    console.error("Missing:", missing.join(", "));
    process.exit(1);
}

export default config;