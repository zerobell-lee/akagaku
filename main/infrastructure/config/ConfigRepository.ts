import Store from 'electron-store'
import { IConfigRepository } from 'main/domain/repositories/IConfigRepository'
import { app } from 'electron'
import path from 'path'
import { dataPathManager } from './DataPathManager'

export class ConfigRepository implements IConfigRepository {
  private store: Store

  constructor() {
    const configPath = dataPathManager.getConfigPath('config.json');
    this.store = new Store({
      name: 'config',
      cwd: path.dirname(configPath)
    });
  }

  public getConfig(key: string) {
    return this.store.get(key)
  }

  public setConfig(key: string, value: any) {
    this.store.set(key, value)
  }
}

export const getDataDirectory = () => path.join(app.getAppPath(), 'data');

let _configRepository: ConfigRepository | null = null;

export const getConfigRepository = () => {
  if (!_configRepository) {
    _configRepository = new ConfigRepository();
  }
  return _configRepository;
}

// Don't create immediately - let background.ts create after setting userData path
export let configRepository: ConfigRepository;

export const initConfigRepository = () => {
  configRepository = getConfigRepository();
}
