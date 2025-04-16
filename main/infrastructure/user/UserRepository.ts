import { logger } from '../config/logger';
import Store from 'electron-store'
let user: any;

const userStore = new Store({ name: 'user' });

try {
    user = userStore.get('user') || {};
} catch (error) {
    user = {};
}

export const getUserSetting = () => {
    return user;
}

// Start of Selection
export const updateUserInfo = async (key: string, value: any) => {
    // Start of Selection
    user = { ...user, [key]: value };
    userStore.set('user', user);
}
