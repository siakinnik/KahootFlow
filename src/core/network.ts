import { FetchClient } from '@telegraf-hardened/fetch';
import fs from 'fs';

class KahootNetwork {
    private client: FetchClient;
    private token: string | null;
    private readonly tokenFile: string;
    constructor() {
        this.client = new FetchClient();
        this.token = null;
        this.tokenFile = '../token.json'; // TODO: database
    }

    async loadToken() {
        if (fs.existsSync(this.tokenFile)) {
            const data = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
            if (data.expires > Date.now()) {
                this.token = data.access_token;
                return;
            }
        }
        await this.refreshToken();
    }

    async refreshToken() {
        // TODO
    }

    async getQuizData(uuid: any) {
        await this.loadToken();
        const res = await this.client.fetch(`https://create.kahoot.it/rest/kahoots/${uuid}/card/?includeKahoot=true`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return res.json();
    }
}

module.exports = { KahootNetwork };