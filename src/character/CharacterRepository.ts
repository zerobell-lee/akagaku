import fs from 'fs';
import yaml from 'js-yaml';

const getCharacterSetting = (character_name: string) => {
    const character_setting = yaml.load(fs.readFileSync(`data/character/${character_name}.yaml`, 'utf8'));
    return character_setting;
}

export { getCharacterSetting };

