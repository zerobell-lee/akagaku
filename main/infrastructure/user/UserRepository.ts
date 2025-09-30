import { logger } from '../config/logger';
import Store from 'electron-store'
import { IUserRepository } from 'main/domain/repositories/IUserRepository';
import { app } from 'electron';

const userStore = new Store({ name: 'user' });

class ElectronStoreUserRepository implements IUserRepository {
    getUserSetting(): any {
        const defaultUser = {
            name: '(unknown)',
            occupation: '(unknown)',
            birthDate: '(unknown)',
            location: '(unknown)',
            locale: app.getLocale(),
        }
        try {
            return userStore.get('user') || defaultUser;
        } catch (error) {
            return defaultUser;
        }
    }

    async updateUserInfo(key: string, value: any): Promise<void> {
        const user = this.getUserSetting();
        user[key] = value;
        userStore.set('user', user);
    }
}

// Singleton instance
const userRepository = new ElectronStoreUserRepository();

// Backward compatibility - keep old interface
export const getUserSetting = (): any => {
    return userRepository.getUserSetting();
}

export const updateUserInfo = async (key: string, value: any): Promise<void> => {
    return userRepository.updateUserInfo(key, value);
}

export { userRepository };
