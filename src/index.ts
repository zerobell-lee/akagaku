// index.ts or index.js (with ESModules enabled)

import 'dotenv/config';

import readline from 'readline';
import { logger } from '../main/infrastructure/config/logger';
import Ghost from '../main/domain/ghost/ghost';

const isDev = process.env.NODE_ENV !== 'development';
const character_name = "minkee";

const main = async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const ghost = new Ghost(character_name);
    const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

    let welcomeMessage = undefined;
    if (await ghost.isNewRendezvous()) {
        welcomeMessage = await ghost.invoke({ isSystemMessage: true, input: "This is your first time to talk to the user. Please introduce yourself and gather user's information. Call 'update_user_info' tool if you need to store user's information." });
    } else {
        welcomeMessage = await ghost.invoke({ isSystemMessage: true, input: "User's PC booted up." });
    }

    logger.info(`${character_name}(${welcomeMessage?.emoticon}) : ${welcomeMessage?.message}`);
    while (true) {
        const input = await ask("당신: ");
        const response = await ghost.invoke({ isSystemMessage: false, input });
        logger.info(`${character_name}(${response?.emoticon}) : ${response?.message}`);
    }
}
main().catch(console.error);
