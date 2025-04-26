import { logger } from '../config/logger';
import Store from 'electron-store'

const userStore = new Store({ name: 'user' });

export const getUserSetting = () => {
    const defaultUser = {
        name: '(unknown)',
        occupation: '(unknown)',
        birthDate: '(unknown)',
        location: '(unknown)',
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
    }
    try {
        return userStore.get('user') || defaultUser;
    } catch (error) {
        return defaultUser;
    }
}

export const updateUserInfo = async (key: string, value: any) => {
    const user = getUserSetting();
    user[key] = value;
    userStore.set('user', user);
}
