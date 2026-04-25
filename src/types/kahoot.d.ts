declare module 'kahoot.js-latest' {
    import { EventEmitter } from 'events';

    class Kahoot extends EventEmitter {
        constructor();
        join(pin: number | string, name: string, team?: string[]): Promise<any>;
        answer(choice: number | number[] | string): Promise<any>;
        leave(): void;
        private _message(msg: string): void;
    }

    export default Kahoot;
}