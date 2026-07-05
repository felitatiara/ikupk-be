import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  userId?: number;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();
