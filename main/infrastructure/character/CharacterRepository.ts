import fs from 'fs';
import yaml from 'js-yaml';
import { logger } from '../config/logger';
import { app } from 'electron';
import path from 'path';
import { AffectionAttitudeMap, CharacterAppearance, CharacterProperties, TouchableArea } from '@shared/types';

export interface CharacterSetting {
    character_id: string;
    character_name: string;
    description: string;
    available_emoticon: string[];
    touchable_area: TouchableArea | null;
}

const dataDirectory = path.join(app.getAppPath(), 'data');

const CharacterSettingLoader = {
    getCharacterSetting: (character_id: string): CharacterSetting => {
        const character_setting = yaml.load(fs.readFileSync(path.join(dataDirectory, `character/${character_id}/character_description.yaml`), 'utf8')) as CharacterSetting;
        return { ...character_setting, character_id };
    },

    calcAttitude: (character_name: string, affection: number) => {
        let affection_attitude_map;
        try {
            affection_attitude_map = yaml.load(fs.readFileSync(path.join(dataDirectory, `character/${character_name}/affection_attitude_map.yaml`), 'utf8')) as AffectionAttitudeMap;
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
    },

    getCharacterAppearance: (character_name: string): CharacterAppearance => {
        return yaml.load(fs.readFileSync(path.join(dataDirectory, `character/${character_name}/appearance.yaml`), 'utf8')) as CharacterAppearance;
    }
}
export { CharacterSettingLoader };

