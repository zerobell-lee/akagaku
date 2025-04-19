import yaml from 'js-yaml';
import fs from 'fs';

let user: any;
try {
    user = yaml.load(fs.readFileSync('data/user/user.yaml', 'utf8')) || {};
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
    fs.writeFile('data/user/user.yaml', yaml.dump(user), (err) => {
        if (err) {
            console.error('Error writing user.yaml:', err);
        } else {
            console.log('user.yaml updated successfully');
        }
    });
}
