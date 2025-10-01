import fs from 'fs';
import yaml from 'js-yaml';
import { logger } from '../config/logger';
import { app } from 'electron';
import path from 'path';
import { AffectionAttitudeMap, CharacterAppearance, CharacterProperties, TouchableArea } from '@shared/types';
import { ICharacterRepository } from 'main/domain/repositories/ICharacterRepository';
import { skinRepository } from './SkinRepository';

export interface CharacterSetting {
    character_id: string;
    character_name: string;
    description: string;
    available_emoticon: string[];
    touchable_area: TouchableArea | null;
}

const getDataDirectory = () => path.join(app.getAppPath(), 'data');

class YamlCharacterRepository implements ICharacterRepository {
    getCharacterSetting(character_id: string): CharacterSetting {
        const character_setting = yaml.load(fs.readFileSync(path.join(getDataDirectory(), `character/${character_id}/character_description.yaml`), 'utf8')) as CharacterSetting;
        return { ...character_setting, character_id };
    }

    calcAttitude(character_name: string, affection: number): string {
        let affection_attitude_map;
        try {
            affection_attitude_map = yaml.load(fs.readFileSync(path.join(getDataDirectory(), `character/${character_name}/affection_attitude_map.yaml`), 'utf8')) as AffectionAttitudeMap;
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

    getCharacterAppearance(character_name: string): CharacterAppearance {
        // Use skin repository to get appearance with active skin
        const activeSkinId = skinRepository.getActiveSkin(character_name);
        logger.info(`[CharacterRepository] Loading appearance for ${character_name} with skin ${activeSkinId}`);
        return skinRepository.getSkinAppearance(character_name, activeSkinId);
    }
}

// Singleton instance
const characterRepository = new YamlCharacterRepository();

// Backward compatibility - keep old interface
const CharacterSettingLoader = {
    getCharacterSetting: (character_id: string): CharacterSetting => {
        return characterRepository.getCharacterSetting(character_id);
    },

    calcAttitude: (character_name: string, affection: number): string => {
        return characterRepository.calcAttitude(character_name, affection);
    },

    getCharacterAppearance: (character_name: string): CharacterAppearance => {
        return characterRepository.getCharacterAppearance(character_name);
    }
}

export { CharacterSettingLoader, characterRepository };

