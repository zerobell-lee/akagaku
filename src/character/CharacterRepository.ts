import fs from 'fs';
import yaml from 'js-yaml';
import { logger } from '../config/logger';

interface AffectionAttitudeMap {
    conditions: {
        if_above: number;
        attitude: string;
    }[];
}

const CharacterSettingLoader = {
    getCharacterSetting: (character_name: string) => {
        const character_setting = yaml.load(fs.readFileSync(`data/character/${character_name}/character_description.yaml`, 'utf8'));
        return character_setting;
    },

    calcAttitude: (character_name: string, affection: number) => {
        let affection_attitude_map;
        try {
            affection_attitude_map = yaml.load(fs.readFileSync(`data/character/${character_name}/affection_attitude_map.yaml`, 'utf8')) as AffectionAttitudeMap;
        } catch (e) {
            affection_attitude_map = { conditions: [{ if_above: 80, attitude: "유저에게 우호적" }, { if_above: 50, attitude: "neutral" }, { if_above: 0, attitude: "유저에게 적대적" }] };
        }

        affection_attitude_map.conditions.sort((a, b) => b.if_above - a.if_above)
        for (const condition of affection_attitude_map.conditions) {
            if (affection >= condition.if_above) {
                return condition.attitude;
            }
        }
        return affection_attitude_map.conditions[0].attitude;
    }
}
export { CharacterSettingLoader };

