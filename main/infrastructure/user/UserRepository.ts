import { logger } from '../config/logger';
import Store from 'electron-store'
import { IUserRepository } from 'main/domain/repositories/IUserRepository';
import { app } from 'electron';

const userStore = new Store({ name: 'user' });

class ElectronStoreUserRepository implements IUserRepository {
    getUserSetting(): any {
        const defaultProfile = `# User Profile

**Name:** (unknown)
**Birth Date:** (unknown)
**Occupation:** (unknown)
**Location:** (unknown)
**Languages:** ${app.getLocale()}

## Notes
No additional information yet.`;

        try {
            // Check if profile key exists (new format)
            if (userStore.has('profile')) {
                return userStore.get('profile') as string;
            }

            // Legacy migration: convert old JSON format to markdown
            if (userStore.has('user')) {
                const oldUser = userStore.get('user') as any;
                const migratedProfile = this.migrateOldFormat(oldUser);
                userStore.set('profile', migratedProfile);
                console.log('[UserRepository] Migrated old JSON format to markdown');
                return migratedProfile;
            }

            return defaultProfile;
        } catch (error) {
            console.error('[UserRepository] Error loading user setting:', error);
            return defaultProfile;
        }
    }

    async updateUserInfo(key: string, value: any): Promise<void> {
        // New format: key is always 'profile', value is markdown string
        if (key === 'profile' && typeof value === 'string') {
            userStore.set('profile', value);
            console.log('[UserRepository] Updated user profile (markdown format)');
        } else {
            // Legacy support: update old format
            const user = userStore.get('user') || {};
            user[key] = value;
            userStore.set('user', user);
            console.warn('[UserRepository] Updated using legacy key-value format:', key);
        }
    }

    private migrateOldFormat(oldUser: any): string {
        const name = oldUser.name || oldUser.user_name || '(unknown)';
        const birthDate = oldUser.birthDate || oldUser.user_birthDate || '(unknown)';
        const occupation = oldUser.occupation || oldUser.user_occupation || '(unknown)';
        const location = oldUser.location || oldUser.user_location || '(unknown)';
        const languages = oldUser.user_language_skills || oldUser.locale || '(unknown)';
        const hobbies = oldUser.user_hobby || oldUser.hobby || '';

        let profile = `# User Profile

**Name:** ${name}
**Birth Date:** ${birthDate}
**Occupation:** ${occupation}
**Location:** ${location}
**Languages:** ${languages}`;

        if (hobbies) {
            profile += `\n**Hobbies:** ${hobbies}`;
        }

        profile += `\n\n## Notes\nMigrated from old format.`;

        return profile;
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
