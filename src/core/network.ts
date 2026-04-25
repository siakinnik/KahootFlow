import { FetchClient } from '@telegraf-hardened/fetch';
import fs from 'fs';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';

interface TokenData {
    access_token: string;
    expires: number;
}

export class KahootNetwork {
    private client: FetchClient;
    private token: string | null = null;
    private readonly tokenFile: string;

    constructor() {
        this.client = new FetchClient({
            proxy: config.kahootProxy || undefined
        });
        this.tokenFile = path.resolve(config.tokenFile);
    }

    private async loadToken(): Promise<string> {
        if (this.token) return this.token;

        if (!fs.existsSync(this.tokenFile)) {
            logger.log('NETWORK | Token file missing. Initializing first refresh...', { level: 'warn' });
            return await this.refreshToken();
        }

        try {
            const data: TokenData = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));

            if (!data.access_token || !data.expires) {
                throw new Error('Invalid token structure in JSON');
            }

            if (Date.now() >= data.expires) {
                logger.log('NETWORK | Token expired. Refreshing...', { level: 'info' });
                return await this.refreshToken();
            }

            this.token = data.access_token;
            return this.token;
        } catch (err) {
            logger.log('NETWORK | Token file corrupted or invalid', { level: 'error', error: err });
            return await this.refreshToken();
        }
    }
    async refreshToken(): Promise<string> {
        try {
            const headers: Record<string, string> = {};
            if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

            const res = await this.client.fetch('https://create.kahoot.it/rest/authenticate', {
                method: 'GET',
                headers
            });

            if (!res.ok) {
                const errorMsg = `CRITICAL | Auth failed: ${res.status} ${res.statusText}`;
                logger.log(errorMsg, { level: 'critical' });
                throw new Error(errorMsg);
            }

            const data = await res.json();

            if (!data.access_token) {
                throw new Error('Kahoot response missing access_token');
            }

            const tokenData: TokenData = {
                access_token: data.access_token,
                expires: data.expires || (Date.now() + 3600 * 1000)
            };

            fs.writeFileSync(this.tokenFile, JSON.stringify(tokenData, null, 2));
            this.token = tokenData.access_token;

            logger.log('NETWORK | Token updated successfully', { level: 'info' });
            return this.token;
        } catch (err) {
            logger.log('NETWORK | Token refresh failed catastrophically', { level: 'critical', error: err });
            throw err;
        }
    }

    private async fetchJson(url: string): Promise<any> {
        const token = await this.loadToken();

        const res = await this.client.fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            logger.log('NETWORK | 401 Unauthorized during request. Forcing refresh...', { level: 'warn' });
            this.token = null;
            const newToken = await this.refreshToken();

            const retryRes = await this.client.fetch(url, {
                headers: { 'Authorization': `Bearer ${newToken}` }
            });

            if (!retryRes.ok) throw new Error(`Kahoot API retry failed: ${retryRes.status}`);
            return retryRes.json();
        }

        if (!res.ok) throw new Error(`Kahoot API error: ${res.status}`);
        return res.json();
    }

    async getQuizData(uuid: string) {
        return this.fetchJson(`https://create.kahoot.it/rest/kahoots/${uuid}/card/?includeKahoot=true`);
    }

    async searchQuizzes(query: string) {
        return this.fetchJson(`https://create.kahoot.it/rest/kahoots/?query=${encodeURIComponent(query)}&limit=20`);
    }
}