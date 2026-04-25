import Kahoot from 'kahoot.js-latest';
import logger from '../utils/logger';

export enum GameStatus {
    IDLE = 'IDLE',
    JOINING = 'JOINING',
    LOBBY = 'LOBBY', 
    PLAYING = 'PLAYING',
    DISCONNECTED = 'DISCONNECTED'
}

export class KahootClient {
    public client: Kahoot;
    public currentQuestion: any = null;
    public currentQuestionIndex: number = 0;
    public status: GameStatus = GameStatus.IDLE;

    constructor() {
        this.client = new Kahoot();
        this.patchMessageReceiver();
        this.setupForwarding();
    }

    public get isInGame(): boolean {
        return this.status === GameStatus.LOBBY || this.status === GameStatus.PLAYING;
    }

    public get canAnswer(): boolean {
        return this.status === GameStatus.PLAYING && this.currentQuestion !== null;
    }

    private patchMessageReceiver() {
        const originalMessage = (this.client as any)._message;
        const self = this;

        (this.client as any)._message = function(msg: string) {
            try {
                const arr = JSON.parse(msg);
                const pkt = Array.isArray(arr) ? arr[0] : arr;

                if (pkt.channel === "/service/player" && pkt.data?.content) {
                    const content = JSON.parse(pkt.data.content);
                    const questionText = content.firstGameBlockData?.question || content.nextGameBlockData?.question;
                    
                    if (questionText) {
                        self.client.emit("detectedQuestion", questionText);
                    }
                }
            } catch (e) {
                // Ignore parser errors: junk mostly
            }
            return originalMessage.call(this, msg);
        };
    }

    private setupForwarding() {
        this.client.on("Joined", () => {
            this.status = GameStatus.LOBBY;
            logger.log('KAHOOT | Successfully joined the lobby', { level: 'info' });
        });

        this.client.on("QuestionStart", (q: any) => {
            this.status = GameStatus.PLAYING;
            this.currentQuestion = q;
            this.currentQuestionIndex++;
        });

        this.client.on("QuestionEnd", () => {
            this.currentQuestion = null;
        });

        this.client.on("QuizEnd", () => {
            this.status = GameStatus.LOBBY; 
            logger.log('KAHOOT | Quiz ended', { level: 'info' });
        });

        this.client.on("Disconnect", (reason: string) => {
            this.status = GameStatus.DISCONNECTED;
            this.currentQuestionIndex = 0;
            this.currentQuestion = null;
            logger.log(`KAHOOT | Disconnected: ${reason}`, { level: 'warn' });
        });
    }

    public async join(pin: number | string, nick: string) {
        this.status = GameStatus.JOINING;
        logger.log(`KAHOOT | Joining ${pin} as ${nick}...`, { level: 'info' });
        try {
            return await this.client.join(pin, nick);
        } catch (err) {
            this.status = GameStatus.IDLE;
            throw err;
        }
    }

    public answer(index: number | number[]) {
        if (!this.canAnswer) {
            logger.log('KAHOOT | Attempted to answer but status is not PLAYING', { level: 'warn' });
            return;
        }
        return this.currentQuestion.answer(index);
    }
}