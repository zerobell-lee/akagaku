import Store from 'electron-store'
import { IConfigRepository } from 'main/domain/repositories/IConfigRepository'

export class ConfigRepository implements IConfigRepository {
  private store: Store

  constructor() {
    this.store = new Store({ name: 'config' });
  }

  public getConfig(key: string) {
    return this.store.get(key)
  }

  public setConfig(key: string, value: any) {
    this.store.set(key, value)
  }
}

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
