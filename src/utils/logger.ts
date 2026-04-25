import fs from 'fs';
import path from 'path';
import config from '../config';
import { bot } from '../api/telegram';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

interface LoggerOptions {
    levels?: LogLevel[];
    defaultLevel?: LogLevel;
    files?: {
        enabled?: boolean;
        levelFiles?: Record<string, string>;
        rotate?: {
            enabled?: boolean;
            maxSize?: string;
            method?: 'deleteFromTop' | 'renameAndCreate' | 'archiveAndCreate';
        };
    };
    console?: {
        enabled?: boolean;
        colors?: boolean;
        levelColors?: Record<string, keyof typeof COLORS>;
    };
    telegram?: {
        enabled?: boolean;
        hashtags?: boolean;
    };
    format?: {
        timestamp?: boolean;
        order?: (keyof LogParts)[];
        json?: boolean;
        jsonConsole?: boolean;
        jsonLogFile?: boolean;
        jsonTelegram?: boolean;
        pretty?: boolean;
    };
}

interface LogParts {
    timestamp?: string;
    level?: string;
    msg?: string;
    meta?: any;
}

const COLORS = {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    reset: "\x1b[0m"
} as const;

export class Logger {
    private startupCalled = false;
    private constructorLogs: [any[], any][] = [];
    private defaultLevel: LogLevel;

    constructor(private options: LoggerOptions = {}) {
        this.defaultLevel = options.defaultLevel || 'info';
        
        if (this.options.files?.enabled && !this.options.files.levelFiles) {
            this.options.files.levelFiles = {
                debug: './logs/debug.log',
                info: './logs/info.log',
                warn: './logs/warn.log',
                error: './logs/error.log',
                critical: './logs/critical.log',
                other: './logs/other.log'
            };
        }
    }

    async startup() {
        if (this.startupCalled) return;
        this.startupCalled = true;

        try {
            await bot.telegram.getMe();
            await this.log('LOGGER SETUP | Telegram bot connected!', { level: 'info' });
        } catch (err) {
            if (this.options.telegram) this.options.telegram.enabled = false;
            await this.log('LOGGER SETUP | Invalid Telegram token - logging turned off.', {
                level: 'error',
                error: err
            });
        }
        if (this.constructorLogs.length > 0) {
            for (const [params, meta] of this.constructorLogs) {
                await this.log(...params, meta);
            }
            this.constructorLogs = [];
        }
    }

    private formatMessage(msg: string, meta: any = {}, formatFor: 'console' | 'file' | 'telegram'): string {
        const parts: LogParts = {};
        const level = (meta.level as string) || this.defaultLevel;

        if (this.options.format?.timestamp !== false) {
            parts.timestamp = new Date().toISOString();
        }
        parts.msg = msg;
        parts.level = level.toUpperCase();

        const shouldIncludeJson = 
            (formatFor === 'console' && this.options.format?.jsonConsole) ||
            (formatFor === 'file' && this.options.format?.jsonLogFile) ||
            (formatFor === 'telegram' && this.options.format?.jsonTelegram);

        const order = this.options.format?.order || ['timestamp', 'level', 'msg'];
        
        let header = order
            .map(key => parts[key])
            .filter(Boolean)
            .join(' | ');

        if (shouldIncludeJson && Object.keys(meta).length > 0 && !meta.noJson) {
            const jsonStr = this.options.format?.pretty 
                ? JSON.stringify(meta, null, 2) 
                : JSON.stringify(meta);
            header += `\nJSON:\n${jsonStr}`;
        }

        if (formatFor === 'telegram' && this.options.telegram?.hashtags) {
            header += `\n#${level}`;
        }

        return header;
    }

    private writeToFile(level: string, message: string) {
        if (!this.options.files?.enabled || !this.options.files.levelFiles) return;

        const filePath = this.options.files.levelFiles[level] || this.options.files.levelFiles.other;
        if (!filePath) return;

        const fullPath = path.resolve(filePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.appendFileSync(fullPath, message + '\n');
    }

    async log(...params: any[]) {
        if (!this.startupCalled) {
            const lastParam = params[params.length - 1];
            const meta = (typeof lastParam === 'object' && !Array.isArray(lastParam)) ? params.pop() : {};
            this.constructorLogs.push([params, meta]);
            return;
        }

        const logParams = (typeof params[params.length - 1] === 'object' && !Array.isArray(params[params.length - 1]))
            ? params.pop()
            : {};

        const level = logParams.level || this.defaultLevel;
        const message = params.join(' ');

        if (this.options.console?.enabled !== false) {
            const formatted = this.formatMessage(message, logParams, 'console');
            if (this.options.console?.colors) {
                const colorKey = this.options.console.levelColors?.[level] || 'reset';
                const colorCode = COLORS[colorKey as keyof typeof COLORS] || COLORS.reset;
                console.log(`${colorCode}${formatted}${COLORS.reset}`);
            } else {
                console.log(formatted);
            }
        }

        if (this.options.telegram?.enabled) {
            const formatted = this.formatMessage(message, logParams, 'telegram');
            await bot.telegram.sendMessage(config.logChannelId, formatted).catch(() => {
                console.error("CRITICAL: Logger failed to send message to Telegram.");
            });
        }

        const fileFormatted = this.formatMessage(message, logParams, 'file');
        this.writeToFile(level, fileFormatted);
    }
}

export default new Logger({
    format: { 
        jsonConsole: false, 
        jsonLogFile: true,
        pretty: true, 
        timestamp: true 
    },
    files: {
        enabled: true
    },
    console: {
        enabled: true,
        colors: true,
        levelColors: {
            debug: 'blue',
            info: 'green',
            warn: 'yellow',
            error: 'red',
            critical: 'magenta'
        }
    },
    telegram: {
        enabled: true,
        hashtags: true
    }
});