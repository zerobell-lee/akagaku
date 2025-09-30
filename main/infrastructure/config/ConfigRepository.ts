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

export const configRepository = new ConfigRepository()
